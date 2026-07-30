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
MAX_GOOGLE_DOC_CHARACTERS = 250_000


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


def extract_google_doc_id(url: str) -> str:
    """Return a Google Docs document id without accepting arbitrary fetch URLs."""
    match = re.fullmatch(
        r"https://docs\.google\.com/document/d/([A-Za-z0-9_-]{20,})/(?:edit|view)(?:[?#].*)?",
        (url or "").strip(),
    )
    if not match:
        raise ValueError("Enter a standard Google Docs document link")
    return match.group(1)


def build_google_doc_course_draft(text: str, document_id: str, title: str = "") -> dict[str, Any]:
    """Create a review-only course draft from source-grounded Google Doc text."""
    cleaned = _clean_text(text or "")
    if len(cleaned) < 80:
        raise ValueError("Google Doc contains too little readable course material")
    if len(cleaned) > MAX_GOOGLE_DOC_CHARACTERS:
        cleaned = cleaned[:MAX_GOOGLE_DOC_CHARACTERS]

    lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
    headings = _heading_candidates(cleaned)
    if not headings:
        headings = [title.strip() or lines[0][:100] or "Course module"]
    sections: list[dict[str, Any]] = []
    cursor = 0
    for index, heading in enumerate(headings[:8], start=1):
        start = cleaned.lower().find(heading.lower(), cursor)
        if start < 0:
            start = cursor
        next_heading = headings[index] if index < len(headings) else None
        end = cleaned.lower().find(next_heading.lower(), start + len(heading)) if next_heading else len(cleaned)
        if end < 0:
            end = min(len(cleaned), start + 5000)
        excerpt = cleaned[start + len(heading):end].strip()[:1200] or cleaned[start:start + 1200]
        cursor = max(end, start + len(heading))
        sections.append({
            "section_id": f"draft-{index:02d}",
            "title": heading,
            "source_excerpt": excerpt,
            "reading": {
                "estimated_minutes": max(4, min(18, round(len(excerpt.split()) / 180))),
                "purpose": f"Build source-grounded understanding of {heading}.",
            },
            "activity": {
                "type": "claim-evidence-revision",
                "prompt": f"Identify one claim about {heading}, attach evidence from the reading, and revise the claim after critique.",
                "evidence_collected": ["initial_claim", "source_evidence", "revision_rationale"],
            },
            "simulation": {
                "status": "proposed",
                "concept": heading,
                "interaction": "Change one input, predict the effect, observe the response, and explain the discrepancy.",
                "variables": ["input", "response", "constraint"],
                "evidence_collected": ["prediction", "observation", "explanation"],
            },
        })

    source_hash = sha256(cleaned.encode("utf-8")).hexdigest()
    return {
        "schema_version": "google-doc-course-draft-v1",
        "source": {
            "kind": "google_doc",
            "document_id": document_id,
            "title": title.strip() or headings[0],
            "sha256": source_hash,
            "characters": len(cleaned),
        },
        "learning_objectives": [f"Explain and apply the central ideas in {heading}." for heading in headings[:5]],
        "sections": sections,
        "quality": {
            "source_grounded": True,
            "human_approval_required": True,
            "student_visible": False,
            "automatic_publish": False,
            "warnings": [] if len(sections) >= 2 else ["Only one section was detected; review the document heading structure."],
        },
    }
