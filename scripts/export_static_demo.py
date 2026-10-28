"""Export one course's read-only API responses as static files for the static demo build.

    cd frontend
    VITE_STATIC_DEMO=true VITE_API_BASE=/demo-api npm run build
    python ../scripts/export_static_demo.py dist            # course defaults to ai-literacy

Writes dist/demo-api/book/<course>/toc.json, .../<chapter>/<section>.json and
search/index.json (this course only), plus a Cloudflare Pages _redirects file that maps
the reader's extensionless API paths onto those files. Responses come from the real
FastAPI handlers, so the demo shows exactly what the backend would serve.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from fastapi.testclient import TestClient  # noqa: E402
from server import app  # noqa: E402

REDIRECTS = """\
/demo-api/book/:course/toc /demo-api/book/:course/toc.json 200
/demo-api/book/:course/:chapter/:section /demo-api/book/:course/:chapter/:section.json 200
/demo-api/search/index /demo-api/search/index.json 200
"""


def write(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def main(dist: Path, course: str) -> None:
    client = TestClient(app)
    api = dist / "demo-api"

    def get(url):
        res = client.get(url)
        res.raise_for_status()
        return res.json()

    toc = get(f"/api/book/{course}/toc")
    write(api / "book" / course / "toc.json", toc)
    count = 0
    for chapter in toc["chapters"]:
        for section in chapter["sections"]:
            ch, sec = str(chapter["id"]), str(section["id"])
            write(api / "book" / course / ch / f"{sec}.json", get(f"/api/book/{course}/{ch}/{sec}"))
            count += 1

    index = get("/api/search/index")
    entries = [e for e in index["items"] if e.get("course") == course]
    write(api / "search" / "index.json", {**index, "items": entries})

    (dist / "_redirects").write_text(REDIRECTS, encoding="utf-8")
    print(f"exported {course}: toc, {count} sections, {len(entries)} search entries -> {api}")


if __name__ == "__main__":
    main(Path(sys.argv[1]).resolve(), sys.argv[2] if len(sys.argv) > 2 else "ai-literacy")
