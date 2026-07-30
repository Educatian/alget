"""Honest, additive provenance metadata for learner-facing AI generations."""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import re
import uuid
from typing import Any


SCHEMA_VERSION = "generation-trace-v1"


def _excerpt(value: str, limit: int = 280) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def _content_version(value: Any) -> str | None:
    if isinstance(value, str):
        return value or None
    if isinstance(value, dict):
        return value.get("content_version") or value.get("hash")
    return None


def build_generation_trace(
    *,
    output: Any,
    model: str,
    prompt_version: str,
    section_id: str | None = None,
    section_title: str = "",
    content_version: Any = None,
    source_kind: str = "course_section",
    source_text: str = "",
    source_locator: str = "",
    provider: str = "google",
    review_status: str = "not_human_reviewed",
) -> dict[str, Any]:
    """Build a trace without implying that attached context is a verified citation."""
    serialized = output if isinstance(output, str) else json.dumps(output, sort_keys=True, default=str)
    excerpt = _excerpt(source_text)
    locator = source_locator or section_id or None
    sources = []
    if excerpt or locator:
        sources.append(
            {
                "source_id": section_id or f"{source_kind}:provided-context",
                "kind": source_kind,
                "title": section_title or section_id or "Provided generation context",
                "locator": locator,
                "excerpt": excerpt or None,
                "verification_status": "context_attached",
            }
        )

    return {
        "schema_version": SCHEMA_VERSION,
        "trace_id": str(uuid.uuid4()),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "provider": provider,
        "model": model,
        "prompt_version": prompt_version,
        "output_hash": hashlib.sha256(serialized.encode("utf-8")).hexdigest(),
        "section_id": section_id,
        "content_version": _content_version(content_version),
        "source_status": "context_attached" if sources else "no_source_context",
        "sources": sources,
        "verification": {
            "status": "context_attached" if sources else "unverified",
            "claim_level_citations": False,
        },
        "review": {"status": review_status},
        "limitations": [
            "The current section context was supplied, but individual claims were not independently citation-verified."
            if sources
            else "No source context was attached. Treat this output as an unverified AI draft."
        ],
    }
