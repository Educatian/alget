"""Admin control-plane primitives for course ingestion and governed agent runs."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from hashlib import sha256
from io import BytesIO
from pathlib import Path
import re
from typing import Any

try:
    from pypdf import PdfReader
except ImportError:  # PDF ingestion is optional for content-only local runs
    PdfReader = None


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
    if PdfReader is None:
        raise RuntimeError("PDF ingestion requires the optional pypdf dependency.")
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
    digest = sha256(data).hexdigest()

    # The edge converter returns this alongside the extraction; the local
    # runtime returned only the extraction, so an ingested PDF dead-ended at the
    # governed source record. A source too thin to structure leaves the
    # extraction usable on its own.
    # Structure the page text itself; the "## Page N" markers are ingestion
    # scaffolding and would otherwise be detected as course headings.
    source_text = "\n\n".join(page.text for page in pages if page.text)
    try:
        runtime_draft = build_google_doc_course_draft(source_text, f"pdf:{digest[:24]}", safe_name, source_kind="pdf")
    except ValueError:
        runtime_draft = None

    return {
        "status": "needs_review" if warnings else "converted",
        "filename": safe_name,
        "sha256": digest,
        "page_count": page_count,
        "total_characters": total_chars,
        "metadata": {
            "title": str(metadata.get("/Title") or ""),
            "author": str(metadata.get("/Author") or ""),
            "subject": str(metadata.get("/Subject") or ""),
        },
        "pages": [asdict(page) for page in pages],
        "markdown": markdown,
        "runtime_draft": runtime_draft,
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


_CONTENT_STOPWORDS = {
    "about", "after", "also", "because", "being", "between", "could", "from",
    "have", "into", "more", "most", "other", "over", "should", "than", "that",
    "their", "these", "this", "those", "through", "under", "using", "what",
    "when", "where", "which", "while", "with", "would", "your", "learners",
}


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", (value or "").lower()).strip("_")
    return slug[:80] or "course_concept"


def _concept_ids(heading: str, excerpt: str) -> list[str]:
    """Select a small, deterministic concept set for the learner knowledge graph."""
    terms: list[str] = []
    for raw in re.findall(r"[A-Za-z][A-Za-z-]{3,}", f"{heading} {excerpt}"):
        term = raw.lower().strip("-")
        if term in _CONTENT_STOPWORDS or term in terms:
            continue
        terms.append(term)
        if len(terms) == 3:
            break
    primary = _slug(heading)
    return list(dict.fromkeys([primary, *(_slug(term) for term in terms)]))[:4]


def _build_learning_assets(heading: str, excerpt: str, source_id: str, source_title: str) -> dict[str, Any]:
    """Build source-grounded reading, retrieval assets, and formative checks.

    This is intentionally deterministic and reviewable. When an AI provider is
    available its richer lesson can replace the reading prose, but the source
    chunk, concepts, and formative checks remain explicit in the draft so an
    instructor can inspect exactly what will be embedded in the runtime.
    """
    concepts = _concept_ids(heading, excerpt)
    clean_excerpt = re.sub(r"^#{1,6}\s+", "", excerpt.strip(), flags=re.MULTILINE)[:1200]
    reading_content = (
        f"## {heading}\n\n"
        f"### What this section is for\n\n"
        f"This section builds a source-grounded model of **{heading}**. Read the excerpt, "
        "then test your interpretation with the evidence and activity below. Keep the "
        "scope of your claim no broader than the source supports.\n\n"
        f"### Source-grounded reading\n\n{clean_excerpt}\n\n"
        "### Make the idea usable\n\n"
        "1. Name the central claim in one sentence.\n"
        "2. Point to the sentence, example, or data in the source that supports it.\n"
        "3. Record one boundary or unanswered question before you revise the claim.\n\n"
        "The tutor, practice item, and social cue all use this same source chunk. "
        "They are suggestions for learning and require instructor review before release."
    )
    reference = {
        "id": f"source-{_slug(source_id)}",
        "kind": "source_document",
        "title": source_title or "Instructor source",
        "locator": source_id,
        "verified": False,
    }
    practice = {
        "schema_version": "formative-assessment-v1",
        "problems": [
            {
                "id": f"draft_{_slug(source_id)}_{_slug(heading)}_mcq",
                "type": "multiple_choice",
                "difficulty": "easy",
                "stem": f"Which move best demonstrates understanding of {heading}?",
                "options": [
                    "State a bounded claim and connect it to evidence from the source.",
                    "Repeat the heading without checking the source.",
                    "Treat a confident opinion as proof.",
                    "Add an unrelated example to make the answer longer.",
                ],
                "correct_index": 0,
                "explanation": "A defensible interpretation makes the claim–evidence connection visible and keeps the scope bounded.",
                "concept_ids": concepts,
                "source_evidence": {"source_id": source_id, "excerpt": clean_excerpt[:360]},
            },
            {
                "id": f"draft_{_slug(source_id)}_{_slug(heading)}_teachback",
                "type": "conceptual",
                "difficulty": "medium",
                "stem": f"Explain {heading} in your own words and cite one source detail that would change your explanation.",
                "expected_answer": "A bounded explanation names the idea, cites a relevant source detail, and states how the detail supports or revises the explanation.",
                "explanation": "This is a low-stakes teach-back check; it should be reviewed with the section rubric rather than auto-graded.",
                "concept_ids": concepts,
                "source_evidence": {"source_id": source_id, "excerpt": clean_excerpt[:360]},
            },
        ],
    }
    knowledge_base = {
        "schema_version": "knowledge-base-v1",
        "retrieval_scope": "source-only-until-instructor-approval",
        "nodes": [
            {"id": concept, "label": concept.replace("_", " ").title(), "source_ids": [source_id], "evidence": clean_excerpt[:360]}
            for concept in concepts
        ],
        "chunks": [{"id": f"{_slug(source_id)}-chunk-1", "text": clean_excerpt, "source_id": source_id, "section": heading}],
    }
    return {"reading_content": reading_content, "concepts": concepts, "reference": reference, "practice": practice, "knowledge_base": knowledge_base}


def build_google_doc_course_draft(text: str, document_id: str, title: str = "", source_kind: str = "google_doc") -> dict[str, Any]:
    """Create a review-only course draft from source-grounded document text.

    The output is a complete *shadow* runtime package: lesson prose, a
    source-only knowledge base, formative checks, and the tutor/analytics/social
    contracts. Nothing becomes learner-visible until the instructor approves it.
    """
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
        source_id = str(document_id or "source")
        assets = _build_learning_assets(heading, excerpt, source_id, title.strip() or headings[0])
        sections.append({
            "section_id": f"draft-{index:02d}",
            "title": heading,
            "source_excerpt": excerpt,
            "concept_ids": assets["concepts"],
            "references": [assets["reference"]],
            "reading": {
                "estimated_minutes": max(4, min(18, round(len(excerpt.split()) / 180))),
                "purpose": f"Build source-grounded understanding of {heading}.",
                "content": assets["reading_content"],
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
            "tutor": {
                "mode": "evidence_coach",
                "prompt": f"Ask the learner to explain the evidence behind one claim about {heading} before giving a hint.",
                "guardrail": "Do not provide a final answer or grade the learner.",
            },
            "analytics": {
                "events": ["reading_completed", "claim_submitted", "evidence_attached", "revision_submitted"],
                "aggregation": "pseudonymous_cohort",
            },
            "social_dynamics": {
                "cues": ["peer_presence", "same_concept_peers", "share_one_evidence_based_revision"],
                "privacy": "pseudonymous-cohort-aggregate",
            },
            "practice": assets["practice"],
            "knowledge_base": assets["knowledge_base"],
        })

    source_hash = sha256(cleaned.encode("utf-8")).hexdigest()
    return {
        "schema_version": "google-doc-course-draft-v1",
        "source": {
            "kind": source_kind if source_kind in {"google_doc", "pdf", "url"} else "google_doc",
            "document_id": document_id,
            "title": title.strip() or headings[0],
            "sha256": source_hash,
            "characters": len(cleaned),
        },
        "learning_objectives": [f"Explain and apply the central ideas in {heading}." for heading in headings[:5]],
        "sections": sections,
        "runtime_package": {
            "version": "course-runtime-v1",
            "generated": ["reading", "activity", "simulation", "tutor", "analytics", "social_dynamics", "knowledge_base", "formative_assessment"],
            "approval_required": True,
            "retrieval_scope": "source-only-until-instructor-approval",
        },
        "quality": {
            "source_grounded": True,
            "human_approval_required": True,
            "student_visible": False,
            "automatic_publish": False,
            "content_pipeline": "deterministic-source-grounded-v1",
            "citation_verification": "not-verified",
            "warnings": [] if len(sections) >= 2 else ["Only one section was detected; review the document heading structure."],
        },
    }
