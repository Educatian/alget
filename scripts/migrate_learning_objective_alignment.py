#!/usr/bin/env python3
"""Backfill stable learning-objective IDs and item-level alignment links.

The migration is deterministic and safe to rerun. Existing objective statements
remain unchanged; only their representation and explicit assessment links change.
The lexical matcher provides a documented first-pass mapping for instructor
review, while the content validator enforces referential integrity and coverage.
"""
from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTENT_ROOT = ROOT / "frontend" / "content"
REPORT_PATH = ROOT / "research" / "LEARNING_OBJECTIVE_ALIGNMENT_AUDIT.md"

STOP_WORDS = {
    "a", "an", "and", "apply", "be", "by", "calculate", "describe", "determine",
    "evaluate", "explain", "for", "from", "how", "identify", "in", "interpret",
    "of", "on", "or", "the", "to", "use", "using", "what", "when", "why", "with",
}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def clean_markdown(text: str) -> str:
    text = re.sub(r"[`*_]", "", text)
    return re.sub(r"\s+", " ", text).strip().rstrip(".")


def objectives_from_mdx(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    match = re.search(
        r"^## Learning (?:Objectives|Targets)\s*$([\s\S]*?)(?=^---\s*$|^##\s)",
        text,
        re.MULTILINE,
    )
    if not match:
        return []
    objectives = []
    for line in match.group(1).splitlines():
        item = re.match(r"^\s*(?:\d+[.)]|[-*])\s+(.+?)\s*$", line)
        if item:
            objectives.append(clean_markdown(item.group(1)))
    return objectives


def tokens(value: object) -> set[str]:
    if isinstance(value, (list, tuple)):
        value = " ".join(str(item) for item in value)
    elif isinstance(value, dict):
        value = " ".join(f"{key} {item}" for key, item in value.items())
    words = re.findall(r"[a-z0-9]+", str(value).lower().replace("_", " "))
    return {word for word in words if len(word) > 2 and word not in STOP_WORDS}


def problem_text(problem: dict) -> str:
    fields = [
        problem.get("stem", ""),
        problem.get("statement", ""),
        problem.get("explanation", ""),
        problem.get("expected_answer", ""),
        problem.get("options", []),
        problem.get("concept_id", ""),
        problem.get("concept_ids", []),
    ]
    return " ".join(str(field) for field in fields)


def match_score(objective: str, problem: dict) -> tuple[int, int]:
    objective_tokens = tokens(objective)
    problem_tokens = tokens(problem_text(problem))
    overlap = objective_tokens & problem_tokens
    # Prefer concept-rich overlap, then a stable length-normalized tiebreaker.
    return (len(overlap), -abs(len(objective_tokens) - len(problem_tokens)))


def migrate_section(meta_path: Path) -> tuple[str, int, int, int]:
    base = Path(str(meta_path)[: -len(".meta.json")])
    mdx_path = base.with_suffix(".mdx")
    if not mdx_path.exists():
        mdx_path = base.with_suffix(".md")
    practice_path = Path(str(base) + ".practice.json")
    meta = load_json(meta_path)
    practice = load_json(practice_path)

    statements = []
    for objective in meta.get("learning_objectives", []):
        if isinstance(objective, str):
            statements.append(clean_markdown(objective))
        elif isinstance(objective, dict) and objective.get("statement"):
            statements.append(clean_markdown(objective["statement"]))
    if not statements:
        statements = objectives_from_mdx(mdx_path)
    if not statements:
        raise ValueError(f"No learning objectives found for {meta_path.relative_to(CONTENT_ROOT)}")

    relative = meta_path.relative_to(CONTENT_ROOT)
    course, chapter = relative.parts[0], relative.parts[1]
    section = meta_path.name[: -len(".meta.json")]
    objectives = [
        {
            "id": f"{course}-{chapter}-{section}-lo-{index:02d}",
            "statement": statement,
        }
        for index, statement in enumerate(statements, start=1)
    ]

    problems = practice.get("problems", [])
    if not problems:
        raise ValueError(f"No practice problems found for {practice_path.relative_to(CONTENT_ROOT)}")

    # If no existing item shares even one substantive term with an objective,
    # add a transparent direct-evidence prompt instead of claiming a false link.
    # These items are open-response checks suitable for rubric or instructor
    # review and remain deterministic on repeated runs.
    for index, objective in enumerate(objectives, start=1):
        best_overlap = max(match_score(objective["statement"], problem)[0] for problem in problems)
        if best_overlap > 0:
            continue
        problem_id = f"{course}_{chapter}_{section}_lo_{index:02d}_direct_check"
        existing = next((problem for problem in problems if problem.get("id") == problem_id), None)
        if existing is None:
            existing = {
                "id": problem_id,
                "type": "conceptual",
                "stem": f"Provide a concise response that demonstrates this learning objective: {objective['statement']}.",
                "expected_answer": (
                    f"The response accurately demonstrates the section objective: "
                    f"{objective['statement']}, using relevant section concepts, evidence, or calculations."
                ),
                "explanation": (
                    "This direct-evidence item is used when no closed-response item adequately samples "
                    "the objective. Score it with the section concepts and worked examples as the rubric."
                ),
                "difficulty": "medium",
            }
            problems.append(existing)
        if problem_id not in meta.get("practice_ids", []):
            meta.setdefault("practice_ids", []).append(problem_id)

    assignments: dict[str, list[str]] = {objective["id"]: [] for objective in objectives}
    problem_links: dict[str, list[str]] = {problem["id"]: [] for problem in problems}

    # Guarantee that every objective is assessed by its best matching problem.
    for objective in objectives:
        best = max(problems, key=lambda problem: match_score(objective["statement"], problem))
        assignments[objective["id"]].append(best["id"])
        problem_links[best["id"]].append(objective["id"])

    # Guarantee that every problem contributes evidence for at least one objective.
    for problem in problems:
        if problem_links[problem["id"]]:
            continue
        best = max(objectives, key=lambda objective: match_score(objective["statement"], problem))
        assignments[best["id"]].append(problem["id"])
        problem_links[problem["id"]].append(best["id"])

    objective_order = {objective["id"]: index for index, objective in enumerate(objectives)}
    for problem in problems:
        problem["learning_objective_ids"] = sorted(
            set(problem_links[problem["id"]]), key=objective_order.get
        )

    meta["learning_objectives"] = objectives
    meta["lo_practice_map"] = {
        objective["id"]: list(dict.fromkeys(assignments[objective["id"]]))
        for objective in objectives
    }
    meta["alignment_method"] = (
        "deterministic lexical mapping v2 with direct-evidence fallback; instructor review required"
    )

    write_json(meta_path, meta)
    write_json(practice_path, practice)
    direct_checks = sum(problem["id"].endswith("_direct_check") for problem in problems)
    return course, len(objectives), len(problems), direct_checks


def main() -> int:
    section_count = objective_count = problem_count = direct_check_count = 0
    by_course: dict[str, dict[str, int]] = {}
    for meta_path in sorted(CONTENT_ROOT.glob("*/*/*.meta.json")):
        course, objectives, problems, direct_checks = migrate_section(meta_path)
        section_count += 1
        objective_count += objectives
        problem_count += problems
        direct_check_count += direct_checks
        bucket = by_course.setdefault(
            course, {"sections": 0, "objectives": 0, "problems": 0, "direct_checks": 0}
        )
        bucket["sections"] += 1
        bucket["objectives"] += objectives
        bucket["problems"] += problems
        bucket["direct_checks"] += direct_checks
    lines = [
        "# Learning-Objective Alignment Audit",
        "",
        "Generated by `scripts/migrate_learning_objective_alignment.py`.",
        "Mappings are deterministic first-pass evidence links and remain subject to instructor review.",
        "",
        "| Course | Sections | Objectives | Practice items | Direct-evidence fallbacks |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    for course, values in sorted(by_course.items()):
        lines.append(
            f"| {course} | {values['sections']} | {values['objectives']} | "
            f"{values['problems']} | {values['direct_checks']} |"
        )
    lines.extend([
        "",
        f"- Total sections: **{section_count}**",
        f"- Total objectives: **{objective_count}**",
        f"- Total practice items: **{problem_count}**",
        f"- Direct-evidence fallback items: **{direct_check_count}**",
        "- Referential integrity and objective coverage: enforced by `scripts/validate_content.py`.",
        "",
    ])
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(
        f"Aligned {problem_count} problems to {objective_count} objectives "
        f"across {section_count} sections; {direct_check_count} direct checks."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
