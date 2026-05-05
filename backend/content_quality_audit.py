from __future__ import annotations

import json
import re
from pathlib import Path
from statistics import mean


ROOT = Path(__file__).resolve().parents[1]
CONTENT_ROOT = ROOT / "frontend" / "content"
REPORT = ROOT / "backend" / "content_quality_audit_report.md"
COURSES = ["ail606-supplement", "cat531-supplement", "cat100-supplement"]


COURSE_TERMS = {
    "ail606-supplement": ["Mayer", "cognitive load", "storyboard", "prototype", "usability", "AI-USE", "WCAG", "multimedia"],
    "cat531-supplement": ["DTS", "Design Tension", "TeachGen", "Ethobot", "teacher", "classroom", "policy", "equity", "evaluation"],
    "cat100-supplement": ["Excel", "resume", "GitHub", "presentation", "digital citizenship", "privacy", "portfolio", "data"],
}


GENERIC_MARKERS = [
    "This section was added during the Summer 2026 ALGET course redevelopment pass",
    "The purpose here is not to replace Blackboard",
    "tool-centered completion",
    "purpose, constraint, evidence, revision",
]


def score_section(course: str, path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    terms = sum(1 for term in COURSE_TERMS[course] if re.search(re.escape(term), text, re.I))
    images = len(re.findall(r"!\[", text))
    downloads = len(re.findall(r"\]\(/downloads/", text))
    quiz = len(re.findall(r"<interactive-quiz", text))
    citations = len(re.findall(r"\b[A-Z][A-Za-z]+, 20\d{2}\b|\b[A-Z][A-Za-z]+, 19\d{2}\b|https?://|doi\.org", text))
    signal_terms = sum(1 for term in [
        "annotation type",
        "support action",
        "confidence before",
        "learner-model",
        "research trace",
        "revision quality",
    ] if re.search(term, text, re.I))
    generic = sum(text.count(marker) for marker in GENERIC_MARKERS)
    words = len(re.findall(r"[A-Za-z][A-Za-z'-]*", text))
    specificity = min(4, terms)
    artifact = 2 if downloads else 0
    research = min(3, signal_terms)
    evidence = min(3, citations)
    media = min(2, images)
    activity = 2 if quiz else 0
    penalty = min(4, generic)
    score = specificity + artifact + research + evidence + media + activity - penalty
    return {
        "path": str(path.relative_to(CONTENT_ROOT)),
        "course": course,
        "score": score,
        "words": words,
        "terms": terms,
        "images": images,
        "downloads": downloads,
        "citations": citations,
        "signal_terms": signal_terms,
        "generic_markers": generic,
    }


def main() -> None:
    rows = []
    for course in COURSES:
        for path in sorted((CONTENT_ROOT / course).rglob("*.mdx")):
            rows.append(score_section(course, path))
    REPORT.write_text(render(rows), encoding="utf-8")
    print(f"Wrote {REPORT}")
    print(json.dumps({
        "sections": len(rows),
        "mean_score": round(mean([r["score"] for r in rows]), 2),
        "below_8": sum(1 for r in rows if r["score"] < 8),
        "hardened_like": sum(1 for r in rows if r["downloads"] > 0 and r["signal_terms"] >= 3),
    }, indent=2))


def render(rows: list[dict]) -> str:
    by_course = {}
    for row in rows:
        by_course.setdefault(row["course"], []).append(row)
    lines = [
        "# ALGET Content Quality Audit",
        "",
        "This stricter audit checks research-readiness signals beyond structural completeness.",
        "",
        "| Course | Sections | Mean Score | Below 8 | Artifact Packets | Generic Marker Total |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for course, cr in by_course.items():
        lines.append(
            f"| {course} | {len(cr)} | {mean([r['score'] for r in cr]):.2f} | "
            f"{sum(1 for r in cr if r['score'] < 8)} | {sum(r['downloads'] for r in cr)} | "
            f"{sum(r['generic_markers'] for r in cr)} |"
        )
    lines.extend(["", "## Lowest Scoring Sections", ""])
    for row in sorted(rows, key=lambda r: (r["score"], r["terms"], -r["generic_markers"]))[:30]:
        lines.append(
            f"- `{row['path']}` score {row['score']} | terms {row['terms']} | "
            f"images {row['images']} | downloads {row['downloads']} | citations {row['citations']} | "
            f"signals {row['signal_terms']} | generic {row['generic_markers']}"
        )
    lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    main()
