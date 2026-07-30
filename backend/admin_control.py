"""Admin control-plane primitives for course ingestion and governed agent runs."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from hashlib import sha256
from io import BytesIO
from pathlib import Path
import re
from typing import Any

from pypdf import PdfReader


MAX_PDF_BYTES = 25 * 1024 * 1024
MAX_PDF_PAGES = 500


AGENT_MANIFEST = [
    {"id": "curriculum", "name": "Curriculum Agent", "stage": "structure", "approval": "required", "can_publish": False},
    {"id": "extraction", "name": "Document Extraction Agent", "stage": "ingestion", "approval": "automatic", "can_publish": False},
    {"id": "alignment", "name": "Outcome Alignment Agent", "stage": "curriculum", "approval": "required", "can_publish": False},
    {"id": "assessment", "name": "Assessment Agent", "stage": "assessment", "approval": "required", "can_publish": False},
    {"id": "accessibility", "name": "Accessibility Agent", "stage": "quality", "approval": "automatic", "can_publish": False},
    {"id": "validation", "name": "Validation Agent", "stage": "quality", "approval": "required", "can_publish": False},
    {"id": "release", "name": "Release Agent", "stage": "release", "approval": "required", "can_publish": True},
]


@dataclass(frozen=True)
class PdfPage:
    page: int
    characters: int
    heading_candidates: list[str]
    text: str


def _clean_text(value: str) -> str:
    value = value.replace("\x00", "").replace("\r\n", "\n").replace("\r", "\n")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def _heading_candidates(text: str) -> list[str]:
    candidates: list[str] = []
    for line in (part.strip() for part in text.splitlines()):
        if not 4 <= len(line) <= 120 or line.endswith(('.', '?', '!')):
            continue
        words = line.split()
        if len(words) > 14:
            continue
        title_like = line.isupper() or sum(word[:1].isupper() for word in words) >= max(1, len(words) // 2)
        numbered = bool(re.match(r"^(chapter|module|unit|section|\d+(?:\.\d+)*)\b", line, re.I))
        if title_like or numbered:
            candidates.append(line)
        if len(candidates) == 4:
            break
    return candidates


def convert_pdf_bytes(data: bytes, filename: str) -> dict[str, Any]:
    """Convert a validated PDF into a reviewable, page-addressable text package."""
    if not data or len(data) > MAX_PDF_BYTES:
        raise ValueError(f"PDF must be between 1 byte and {MAX_PDF_BYTES} bytes")
    if not data.startswith(b"%PDF-"):
        raise ValueError("File signature is not a PDF")

    try:
        reader = PdfReader(BytesIO(data), strict=False)
    except Exception as exc:
        raise ValueError("PDF could not be parsed") from exc

    if reader.is_encrypted:
        try:
            unlocked = reader.decrypt("")
        except Exception as exc:
            raise ValueError("Encrypted PDFs must be unlocked before ingestion") from exc
        if not unlocked:
            raise ValueError("Encrypted PDFs must be unlocked before ingestion")

    page_count = len(reader.pages)
    if page_count == 0:
        raise ValueError("PDF contains no pages")
    if page_count > MAX_PDF_PAGES:
        raise ValueError(f"PDF exceeds the {MAX_PDF_PAGES}-page ingestion limit")

    pages: list[PdfPage] = []
    warnings: list[str] = []
    for index, page in enumerate(reader.pages, start=1):
        try:
            text = _clean_text(page.extract_text() or "")
        except Exception:
            text = ""
            warnings.append(f"Page {index}: text extraction failed")
        if len(text) < 24:
            warnings.append(f"Page {index}: little or no extractable text; OCR review recommended")
        pages.append(PdfPage(index, len(text), _heading_candidates(text), text))

    metadata = reader.metadata or {}
    safe_name = Path(filename or "course-source.pdf").name
    markdown = "\n\n".join(
        f"## Page {page.page}\n\n{page.text or '[No extractable text]'}" for page in pages
    )
    total_chars = sum(page.characters for page in pages)

    return {
        "status": "needs_review" if warnings else "converted",
        "filename": safe_name,
        "sha256": sha256(data).hexdigest(),
        "page_count": page_count,
        "total_characters": total_chars,
        "metadata": {
            "title": str(metadata.get("/Title") or ""),
            "author": str(metadata.get("/Author") or ""),
            "subject": str(metadata.get("/Subject") or ""),
        },
        "pages": [asdict(page) for page in pages],
        "markdown": markdown,
        "warnings": warnings,
        "quality": {
            "extractable_page_ratio": round(sum(page.characters >= 24 for page in pages) / page_count, 4),
            "requires_ocr": any(page.characters < 24 for page in pages),
            "human_approval_required": True,
        },
    }


def build_governed_course_plan(course_id: str, source_id: str) -> dict[str, Any]:
    """Return a deterministic approval-gated plan; it does not execute agents."""
    stages = []
    for order, agent in enumerate(AGENT_MANIFEST, start=1):
        stages.append({
            "order": order,
            "agent_id": agent["id"],
            "agent_name": agent["name"],
            "status": "waiting",
            "approval": agent["approval"],
            "can_publish": agent["can_publish"],
        })
    return {
        "course_id": course_id,
        "source_id": source_id,
        "status": "planned",
        "release_gate": "human_approval_required",
        "stages": stages,
    }
