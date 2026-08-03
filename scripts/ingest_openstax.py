"""Ingest OpenStax book sections into the reference index.

Generated modules cite open textbook passages and link back to them, so the
index stores one row per section with its canonical reader URL and the licence
of the book it came from.

    python scripts/ingest_openstax.py --list
    python scripts/ingest_openstax.py biology-2e college-physics-2e
    python scripts/ingest_openstax.py biology-2e --dry-run

Writing to the index needs the service-role key, which is read from
SUPABASE_SERVICE_ROLE_KEY and never written to disk. --dry-run needs no
credentials and prints what would be ingested.
"""
from __future__ import annotations

import argparse
import html
import os
import re
import sys
import time
from typing import Any, Iterable

import httpx

# Book titles carry characters the Windows console codepage cannot encode, and a
# progress line should never be what stops an ingest.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

CMS_BOOKS ="https://openstax.org/apps/cms/api/v2/pages/?type=books.Book&limit=300&fields=title,slug"
RELEASE = "https://openstax.org/rex/release.json"
BOOK_DETAIL = "https://openstax.org/apps/cms/api/v2/pages/{page_id}/"
READER_URL = "https://openstax.org/books/{book_slug}/pages/{page_slug}"

MIN_SECTION_CHARACTERS = 400
REQUEST_PAUSE_SECONDS = 0.2

# Sections that carry no teachable prose; indexing them only adds noise.
SKIP_TITLE_PATTERNS = re.compile(
    r"^(preface|index|answer key|chapter summary|key terms|review questions|"
    r"critical thinking questions|visual connection questions|test prep|"
    r"references|glossary)\b",
    re.I,
)

_TAG = re.compile(r"<[^>]+>")
_DROP_BLOCKS = re.compile(r"<(script|style)\b.*?</\1>", re.I | re.S)
_WS = re.compile(r"\s+")


def clean_html(raw: str) -> str:
    """Plain text from OpenStax page HTML, without style or script blocks."""
    without_blocks = _DROP_BLOCKS.sub(" ", raw or "")
    return _WS.sub(" ", html.unescape(_TAG.sub(" ", without_blocks))).strip()


def clean_title(raw: str) -> str:
    return _WS.sub(" ", html.unescape(_TAG.sub(" ", raw or ""))).strip()


def get_json(client: httpx.Client, url: str) -> Any:
    response = client.get(url, headers={"Accept": "application/json"}, timeout=60.0)
    response.raise_for_status()
    return response.json()


def list_books(client: httpx.Client) -> list[dict[str, Any]]:
    payload = get_json(client, CMS_BOOKS)
    return [
        {"page_id": item["id"], "title": item.get("title", ""), "slug": item["meta"]["slug"]}
        for item in payload.get("items", [])
    ]


def walk_tree(node: dict[str, Any]) -> Iterable[dict[str, str]]:
    """Yield leaf pages; container nodes hold contents, leaves do not."""
    contents = node.get("contents")
    if contents:
        for child in contents:
            yield from walk_tree(child)
        return
    identifier = str(node.get("id") or "")
    if not identifier:
        return
    yield {"page_uuid": identifier.split("@")[0], "title": clean_title(node.get("title", ""))}


def ingest_book(client: httpx.Client, slug: str, books: list[dict[str, Any]],
                archive: str, versions: dict[str, Any]) -> list[dict[str, Any]]:
    book = next((b for b in books if b["slug"] == slug), None)
    if not book:
        raise SystemExit(f"No OpenStax book with slug '{slug}'. Try --list.")

    detail = get_json(client, BOOK_DETAIL.format(page_id=book["page_id"]))
    uuid = detail.get("cnx_id")
    if not uuid:
        raise SystemExit(f"'{slug}' has no cnx_id; it may not be a published book.")
    version = (versions.get(uuid) or {}).get("defaultVersion")
    if not version:
        raise SystemExit(f"'{slug}' is not in the current REX release manifest.")

    license_url = detail.get("license_url") or ""
    license_name = detail.get("license_name") or ""
    book_ref = f"{uuid}@{version}"
    tree = get_json(client, f"{archive}/contents/{book_ref}.json").get("tree") or {}
    pages = [p for p in walk_tree(tree) if not SKIP_TITLE_PATTERNS.match(p["title"])]
    print(f"{slug}: {len(pages)} candidate sections (licence {license_name or license_url})")

    rows: list[dict[str, Any]] = []
    for index, page in enumerate(pages, start=1):
        try:
            payload = get_json(client, f"{archive}/contents/{book_ref}:{page['page_uuid']}.json")
        except httpx.HTTPError as error:
            print(f"  [{index}/{len(pages)}] {page['title'][:44]}: fetch failed ({error})")
            continue
        text = clean_html(payload.get("content", ""))
        if len(text) < MIN_SECTION_CHARACTERS:
            continue
        page_slug = payload.get("slug") or page["page_uuid"]
        rows.append({
            "book_slug": slug,
            "book_title": book["title"],
            "license_url": license_url,
            "license_name": license_name,
            "page_uuid": page["page_uuid"],
            "page_slug": page_slug,
            "title": clean_title(payload.get("title", "")) or page["title"],
            "url": READER_URL.format(book_slug=slug, page_slug=page_slug),
            "content": text[:200000],
            "characters": len(text),
            "archive_version": archive.rsplit("/", 1)[-1],
            "book_version": version,
        })
        if index % 25 == 0:
            print(f"  [{index}/{len(pages)}] {len(rows)} sections kept")
        time.sleep(REQUEST_PAUSE_SECONDS)
    return rows


def check_credentials(supabase_url: str, service_key: str) -> None:
    """Fail before the crawl, not after it, when the key cannot write."""
    if not service_key.isascii() or service_key.startswith("<"):
        raise SystemExit(
            "SUPABASE_SERVICE_ROLE_KEY still holds placeholder text, not a key. "
            "Copy the secret key from Project Settings -> API Keys."
        )
    endpoint = f"{supabase_url.rstrip('/')}/rest/v1/openstax_sections?select=id&limit=1"
    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
    try:
        response = httpx.get(endpoint, headers=headers, timeout=30.0)
    except httpx.HTTPError as error:
        raise SystemExit(f"Could not reach Supabase: {error}")
    if response.status_code == 401:
        raise SystemExit(
            "Supabase rejected the key (401). This project uses the newer API key "
            "format, so ingestion needs the secret key (sb_secret_...) from "
            "Project Settings -> API Keys, not the publishable key."
        )
    if response.status_code == 404:
        raise SystemExit(
            "No openstax_sections table. Apply "
            "supabase/migrations/20260801000000_openstax_reference_index.sql first."
        )
    if response.status_code >= 300:
        raise SystemExit(f"Supabase check failed ({response.status_code}): {response.text[:200]}")


def upload(rows: list[dict[str, Any]], supabase_url: str, service_key: str) -> None:
    endpoint = f"{supabase_url.rstrip('/')}/rest/v1/openstax_sections?on_conflict=book_slug,page_uuid"
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    with httpx.Client(timeout=120.0) as client:
        for start in range(0, len(rows), 25):
            batch = rows[start:start + 25]
            response = client.post(endpoint, headers=headers, json=batch)
            if response.status_code >= 300:
                raise SystemExit(f"Upload failed ({response.status_code}): {response.text[:300]}")
            print(f"  uploaded {start + len(batch)}/{len(rows)}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("slugs", nargs="*", help="OpenStax book slugs to ingest")
    parser.add_argument("--list", action="store_true", help="list available books and exit")
    parser.add_argument("--dry-run", action="store_true", help="fetch and report without uploading")
    args = parser.parse_args()

    if not args.list and not args.dry_run:
        supabase_url = os.environ.get("SUPABASE_URL", "").strip()
        service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        if not supabase_url or not service_key:
            raise SystemExit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to upload.")
        check_credentials(supabase_url, service_key)
        print("supabase credentials accepted")

    with httpx.Client(follow_redirects=True) as client:
        books = list_books(client)
        if args.list:
            for book in sorted(books, key=lambda b: b["slug"]):
                print(f"{book['slug']:<44} {book['title']}")
            return
        if not args.slugs:
            parser.error("give at least one book slug, or --list")

        release = get_json(client, RELEASE)
        archive = "https://openstax.org" + release["archiveUrl"]
        versions = release.get("books") or {}
        print(f"archive {archive}")

        rows: list[dict[str, Any]] = []
        for slug in args.slugs:
            rows.extend(ingest_book(client, slug, books, archive, versions))

    if not rows:
        raise SystemExit("No sections met the minimum length; nothing to upload.")
    total = sum(row["characters"] for row in rows)
    print(f"\n{len(rows)} sections, {total:,} characters")
    licences = sorted({row["license_url"] for row in rows})
    print("licences: " + ", ".join(licences))

    if args.dry_run:
        for row in rows[:8]:
            print(f"  {row['title'][:52]:<54} {row['url']}")
        print("dry run: nothing uploaded")
        return

    supabase_url = os.environ.get("SUPABASE_URL", "").strip()
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not supabase_url or not service_key:
        raise SystemExit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to upload.")
    upload(rows, supabase_url, service_key)
    print("done")


if __name__ == "__main__":
    sys.exit(main())
