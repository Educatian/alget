from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
CONTENT_ROOT = ROOT / "frontend" / "content"
REPORT_PATH = Path(__file__).resolve().parent / "content_audit_report.md"

HEADING_RE = re.compile(r"^#{1,3}\s", re.M)
LIST_RE = re.compile(r"^[-*]\s", re.M)
WORD_RE = re.compile(r"\b\w+\b")
COMPONENT_RE = re.compile(r"<([a-zA-Z0-9-]+)")


def load_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def find_component_counts(text: str) -> Counter:
    counts: Counter[str] = Counter()
    for match in COMPONENT_RE.findall(text):
        counts[match] += 1
    return counts


def audit_section(course: str, chapter: str, section: str, files: dict[str, Path]) -> dict:
    content_path = files.get("content")
    meta_path = files.get("meta")
    practice_path = files.get("practice")
    misconceptions_path = files.get("misconceptions")
    text = load_text(content_path) if content_path else ""
    components = find_component_counts(text)
    words = len(WORD_RE.findall(text))
    headings = len(HEADING_RE.findall(text))
    lists = len(LIST_RE.findall(text))
    has_quiz = components.get("interactive-quiz", 0) > 0
    has_scenario = components.get("dynamic-scenario", 0) > 0
    has_visual = any(
        name in components
        for name in [
            "concept-diagram",
            "dynamic-scenario",
            "interactive-quiz",
            "gecko-adhesion-diagram",
            "directional-adhesion-diagram",
            "structural-color-diagram",
            "feedback-models-diagram",
            "rubric-design-diagram",
            "behaviorism-diagram",
            "constructivism-diagram",
            "cognitivism-diagram",
            "hierarchical-structure-diagram",
            "cellular-solid-diagram",
            "fluid-dynamics-diagram",
            "torque-diagram",
        ]
    )
    practice_count = 0
    if practice_path:
        try:
            practice_count = len(json.loads(load_text(practice_path)).get("problems", []))
        except json.JSONDecodeError:
            practice_count = -1

    findings: list[str] = []
    severity = 0

    if not meta_path:
        findings.append("Missing section metadata file.")
        severity += 4
    if not content_path:
        findings.append("Missing section content file.")
        severity += 5
    if words < 450:
        findings.append(f"Body is very short at {words} words.")
        severity += 3
    elif words < 750:
        findings.append(f"Body is somewhat thin at {words} words.")
        severity += 1
    if headings < 5:
        findings.append(f"Structure is shallow with only {headings} headings.")
        severity += 2
    if lists < 3:
        findings.append(f"Few list-based cues ({lists}) reduce scanability.")
        severity += 1
    if not practice_path:
        findings.append("No practice bank is attached to this section.")
        severity += 4
    elif practice_count <= 0:
        findings.append("Practice bank exists but has no usable problems.")
        severity += 4
    elif practice_count < 3:
        findings.append(f"Practice bank is light with only {practice_count} problems.")
        severity += 1
    if not misconceptions_path:
        findings.append("No misconception bank is attached to this section.")
        severity += 2
    if not has_quiz:
        findings.append("No inline formative quiz is embedded in the narrative.")
        severity += 2
    if not has_scenario:
        findings.append("No dynamic application scenario is embedded.")
        severity += 2
    if not has_visual:
        findings.append("No clear visual or interactive anchor was detected.")
        severity += 1

    return {
        "course": course,
        "chapter": chapter,
        "section": section,
        "word_count": words,
        "headings": headings,
        "lists": lists,
        "practice_count": practice_count,
        "has_practice": practice_path is not None,
        "has_misconceptions": misconceptions_path is not None,
        "has_quiz": has_quiz,
        "has_scenario": has_scenario,
        "has_visual": has_visual,
        "severity": severity,
        "findings": findings,
    }


def collect_sections() -> list[dict]:
    rows: list[dict] = []
    for course_dir in sorted(path for path in CONTENT_ROOT.iterdir() if path.is_dir()):
        for chapter_dir in sorted(path for path in course_dir.iterdir() if path.is_dir()):
            grouped: dict[str, dict[str, Path]] = defaultdict(dict)
            for file in chapter_dir.iterdir():
                stem = file.name.split(".")[0]
                if file.name.endswith(".meta.json"):
                    grouped[stem]["meta"] = file
                elif file.name.endswith(".practice.json"):
                    grouped[stem]["practice"] = file
                elif file.name.endswith(".misconceptions.json"):
                    grouped[stem]["misconceptions"] = file
                elif file.suffix in {".md", ".mdx"}:
                    grouped[stem]["content"] = file
            for section, files in sorted(grouped.items()):
                rows.append(audit_section(course_dir.name, chapter_dir.name, section, files))
    return rows


def render_report(rows: list[dict]) -> str:
    total_sections = len(rows)
    summary: dict[str, dict[str, int]] = defaultdict(lambda: {
        "sections": 0,
        "missing_practice": 0,
        "missing_misconceptions": 0,
        "thin_sections": 0,
        "high_priority": 0,
    })

    for row in rows:
        bucket = summary[row["course"]]
        bucket["sections"] += 1
        bucket["missing_practice"] += 0 if row["has_practice"] else 1
        bucket["missing_misconceptions"] += 0 if row["has_misconceptions"] else 1
        bucket["thin_sections"] += 1 if row["word_count"] < 750 else 0
        bucket["high_priority"] += 1 if row["severity"] >= 8 else 0

    top_rows = sorted(rows, key=lambda item: (-item["severity"], item["course"], item["chapter"], item["section"]))

    lines = [
        "# Content Sufficiency Audit",
        "",
        f"- Sections scanned: **{total_sections}**",
        f"- High-priority gaps (severity >= 8): **{sum(1 for row in rows if row['severity'] >= 8)}**",
        "",
        "## Course Summary",
        "",
        "| Course | Sections | Missing practice | Missing misconceptions | Thin sections | High priority |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]

    for course, values in sorted(summary.items()):
        lines.append(
            f"| {course} | {values['sections']} | {values['missing_practice']} | {values['missing_misconceptions']} | {values['thin_sections']} | {values['high_priority']} |"
        )

    lines.extend([
        "",
        "## Highest Priority Sections",
        "",
    ])

    for row in top_rows[:20]:
        lines.append(
            f"### {row['course']} {row['chapter']}.{row['section']}  (severity {row['severity']})"
        )
        lines.append(
            f"- Words: {row['word_count']}, headings: {row['headings']}, practice: {row['practice_count'] if row['practice_count'] >= 0 else 'invalid'}, misconceptions: {'yes' if row['has_misconceptions'] else 'no'}"
        )
        for finding in row["findings"]:
            lines.append(f"- {finding}")
        lines.append("")

    lines.extend([
        "## Full Section Checklist",
        "",
    ])

    for row in top_rows:
        flags = ", ".join(row["findings"]) if row["findings"] else "No major issues detected."
        lines.append(
            f"- `{row['course']}/{row['chapter']}/{row['section']}`: severity {row['severity']} | words {row['word_count']} | practice {row['practice_count'] if row['practice_count'] >= 0 else 'invalid'} | {flags}"
        )

    return "\n".join(lines) + "\n"


def main() -> None:
    rows = collect_sections()
    REPORT_PATH.write_text(render_report(rows), encoding="utf-8")
    print(f"Wrote content audit report to {REPORT_PATH}")


if __name__ == "__main__":
    main()
