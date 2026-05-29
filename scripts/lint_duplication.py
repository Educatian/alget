#!/usr/bin/env python3
"""Duplication linter for the Summer-2026 supplement courses.

The three supplement courses (ail606-supplement, cat531-supplement,
cat100-supplement) were generated as one course reskinned three ways. Every
section reuses the same handful of practice MCQ stems, the same generic
workflow misconception patterns, and "Worked Example" prose that never contains
a concrete number, formula, or step. This linter quantifies that duplication so
it can be tracked across the differentiation work and gate CI afterward.

Per supplement course it computes:
  (a) unique-practice-stem ratio  (distinct stems / total stems)
  (b) pairwise near-duplicate practice items via shingle/Jaccard
      (>= 0.8 token-shingle similarity counts as a duplicate pair)
  (c) identical-misconceptions count: how many misconceptions.json files share
      the most-common misconception signature (same set of patterns)
  (d) count of sections whose "## Worked Example" prose contains NO digit or
      formula token

It prints a per-course summary and EXITS NONZERO if any course has
  - more than 50% duplicated practice stems, OR
  - more than 50% identical misconceptions files
so that after differentiation the linter passes and gates regressions in CI.

Stdlib only.

Usage:  python scripts/lint_duplication.py
"""
from __future__ import annotations

import json
import os
import re
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT_DIR = os.path.join(ROOT, "frontend", "content")

COURSES = (
    "ail606-supplement",
    "cat531-supplement",
    "cat100-supplement",
)

# Jaccard threshold over word shingles. Two practice stems with similarity at or
# above this value are treated as near-duplicates of each other.
JACCARD_THRESHOLD = 0.8
SHINGLE_SIZE = 3  # word-level n-gram size

# Gate thresholds. A course failing either gate makes the run exit nonzero.
DUP_STEM_GATE = 0.50  # > 50% of stems are duplicated
IDENTICAL_MISCONCEPTION_GATE = 0.50  # > 50% of misconception files identical

# A digit, or a genuine formula/step token, marks "concrete" worked-example
# content. Used to detect worked examples that show no number/formula/step.
#
# The detection is intentionally strict so that ordinary prose punctuation does
# NOT register as "concrete." A bare slash (as in "intrinsic/extraneous") or a
# hyphen (as in "evidence-based") is prose, not a formula, so neither counts.
# A formula must look like an equation or an arithmetic expression that joins
# operands with an operator; a step must be an explicitly numbered step; a
# spreadsheet cell reference (A1, =SUM(...)) or markup tag also counts as the
# concrete artifact the discipline archetypes require.
DIGIT_RE = re.compile(r"\d")

# operand <op> operand, an "=" assignment, a LaTeX macro, a numbered step, a
# spreadsheet cell or function, or an HTML/markup tag.
FORMULA_TOKEN_RE = re.compile(
    r"""
      \w+\s*[=+*^]\s*\w+        # x = y, a + b, n * m, 2^3 (excludes bare - and /)
    | \w+\s*[-/]\s*\d           # subtraction/division with a numeric operand
    | \d\s*[-/]\s*\w+           # numeric operand before - or /
    | =\s*[A-Za-z]+\s*\(        # spreadsheet/function call  =SUM(
    | \\[a-zA-Z]+               # LaTeX macro  \frac \sum \times
    | \b[A-Z]{1,3}\d+\b         # spreadsheet cell reference  A1, BC12
    | \bstep\s*\d               # explicitly numbered step
    | </?[a-zA-Z][\w-]*\s*[/>]  # HTML/markup tag  <td>, <li>, <br/>
    """,
    re.IGNORECASE | re.VERBOSE,
)


# ---------------------------------------------------------------------------
# Filesystem helpers
# ---------------------------------------------------------------------------
def course_dir(course: str) -> str:
    return os.path.join(CONTENT_DIR, course)


def iter_section_files(course: str, suffix: str):
    """Yield absolute paths of section files (e.g. '*.practice.json') for a course,
    sorted by chapter/section for stable output."""
    cdir = course_dir(course)
    if not os.path.isdir(cdir):
        return
    out = []
    for dirpath, _dirs, files in os.walk(cdir):
        for name in files:
            if name.endswith(suffix):
                out.append(os.path.join(dirpath, name))
    out.sort()
    for p in out:
        yield p


# ---------------------------------------------------------------------------
# (a) + (b) practice stems
# ---------------------------------------------------------------------------
def collect_stems(course: str):
    """Return a list of (relpath, stem_text) for every practice problem in a course."""
    stems = []
    for path in iter_section_files(course, ".practice.json"):
        rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
        try:
            data = json.load(open(path, encoding="utf-8"))
        except (OSError, ValueError):
            continue
        for prob in data.get("problems", []):
            text = prob.get("stem") or prob.get("statement")
            if text:
                stems.append((rel, text.strip()))
    return stems


def normalize(text: str):
    """Lowercase word tokens for shingling."""
    return re.findall(r"[a-z0-9]+", text.lower())


def shingles(tokens, size=SHINGLE_SIZE):
    """Word-level n-gram set. Falls back to the token set for short strings so a
    short stem still produces a usable signature."""
    if len(tokens) < size:
        return frozenset(tokens)
    return frozenset(
        tuple(tokens[i : i + size]) for i in range(len(tokens) - size + 1)
    )


def jaccard(a: frozenset, b: frozenset) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def unique_stem_ratio(stems):
    total = len(stems)
    if total == 0:
        return 0, 0, 0.0
    distinct = len({s for _, s in stems})
    return distinct, total, distinct / total


def near_duplicate_pairs(stems):
    """Count unordered pairs of practice items with Jaccard >= threshold, and the
    number of items that participate in at least one such pair."""
    sigs = [shingles(normalize(s)) for _, s in stems]
    n = len(sigs)
    pair_count = 0
    involved = set()
    for i in range(n):
        for j in range(i + 1, n):
            if jaccard(sigs[i], sigs[j]) >= JACCARD_THRESHOLD:
                pair_count += 1
                involved.add(i)
                involved.add(j)
    return pair_count, len(involved), n


# ---------------------------------------------------------------------------
# (c) identical misconception files
# ---------------------------------------------------------------------------
def misconception_signature(data) -> frozenset:
    """A file's signature is the frozenset of its misconception 'pattern' values
    (falling back to id-suffix when pattern is absent). Two files with the same
    signature are considered identical in misconception content."""
    pats = []
    for m in data.get("misconceptions", []):
        pat = m.get("pattern")
        if not pat:
            mid = m.get("id", "")
            pat = mid.rsplit("_", 1)[-1] if mid else ""
        pats.append(pat)
    return frozenset(pats)


def identical_misconception_stats(course: str):
    """Return (max_identical_count, total_files, signatures_counter)."""
    sigs = []
    for path in iter_section_files(course, ".misconceptions.json"):
        try:
            data = json.load(open(path, encoding="utf-8"))
        except (OSError, ValueError):
            continue
        sigs.append(misconception_signature(data))
    total = len(sigs)
    counter = Counter(sigs)
    max_identical = max(counter.values()) if counter else 0
    return max_identical, total, counter


# ---------------------------------------------------------------------------
# (d) worked examples without digit/formula
# ---------------------------------------------------------------------------
def extract_worked_example(mdx_text: str) -> str:
    """Return the prose body under a '## Worked Example' heading up to the next
    '## ' heading (or end of file). Empty string if no such heading."""
    lines = mdx_text.splitlines()
    body = []
    capturing = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("## "):
            heading = stripped[3:].strip().lower()
            if capturing:
                break  # next section heading ends the worked example
            if heading.startswith("worked example"):
                capturing = True
            continue
        if capturing:
            body.append(line)
    return "\n".join(body)


def worked_example_has_concrete(mdx_text: str) -> bool:
    body = extract_worked_example(mdx_text)
    if not body.strip():
        return False
    return bool(DIGIT_RE.search(body) or FORMULA_TOKEN_RE.search(body))


def worked_examples_without_concrete(course: str):
    """Return (count_without, total_sections)."""
    total = 0
    without = 0
    for path in iter_section_files(course, ".mdx"):
        try:
            text = open(path, encoding="utf-8").read()
        except OSError:
            continue
        total += 1
        if not worked_example_has_concrete(text):
            without += 1
    return without, total


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------
def analyze_course(course: str):
    stems = collect_stems(course)
    distinct, total_stems, uratio = unique_stem_ratio(stems)
    pair_count, involved, _ = near_duplicate_pairs(stems)
    dup_stem_ratio = (involved / total_stems) if total_stems else 0.0

    max_ident, total_misc, counter = identical_misconception_stats(course)
    ident_ratio = (max_ident / total_misc) if total_misc else 0.0

    we_without, we_total = worked_examples_without_concrete(course)

    return {
        "course": course,
        "distinct_stems": distinct,
        "total_stems": total_stems,
        "unique_stem_ratio": uratio,
        "near_dup_pairs": pair_count,
        "items_in_dup_pair": involved,
        "dup_stem_ratio": dup_stem_ratio,
        "max_identical_misconceptions": max_ident,
        "total_misconception_files": total_misc,
        "identical_misconception_ratio": ident_ratio,
        "distinct_misconception_signatures": len(counter),
        "worked_examples_without_concrete": we_without,
        "worked_examples_total": we_total,
    }


def print_course(r) -> bool:
    """Print a course summary. Return True if the course fails a gate."""
    fail_dup = r["dup_stem_ratio"] > DUP_STEM_GATE
    fail_misc = r["identical_misconception_ratio"] > IDENTICAL_MISCONCEPTION_GATE
    failed = fail_dup or fail_misc

    print(f"=== {r['course']} ===")
    print(
        f"  (a) unique-practice-stem ratio : {r['distinct_stems']}/{r['total_stems']} "
        f"= {r['unique_stem_ratio']:.1%} unique"
    )
    print(
        f"  (b) near-duplicate items       : {r['near_dup_pairs']} pair(s) >= "
        f"{JACCARD_THRESHOLD:.0%} Jaccard; {r['items_in_dup_pair']}/{r['total_stems']} "
        f"items duplicated ({r['dup_stem_ratio']:.1%})"
        + ("  [GATE: >50% duplicated]" if fail_dup else "")
    )
    print(
        f"  (c) identical misconceptions   : {r['max_identical_misconceptions']}/"
        f"{r['total_misconception_files']} files share one signature "
        f"({r['identical_misconception_ratio']:.1%}); "
        f"{r['distinct_misconception_signatures']} distinct signature(s)"
        + ("  [GATE: >50% identical]" if fail_misc else "")
    )
    print(
        f"  (d) worked examples w/o number/formula : "
        f"{r['worked_examples_without_concrete']}/{r['worked_examples_total']}"
    )
    print(f"  -> {'FAIL' if failed else 'PASS'}")
    print()
    return failed


def main() -> int:
    if not os.path.isdir(CONTENT_DIR):
        print(f"lint_duplication: content directory not found: {CONTENT_DIR}")
        return 2

    any_fail = False
    for course in COURSES:
        if not os.path.isdir(course_dir(course)):
            print(f"=== {course} ===")
            print("  (course directory not found; skipped)")
            print()
            continue
        result = analyze_course(course)
        if print_course(result):
            any_fail = True

    if any_fail:
        print(
            "lint_duplication: FAIL - at least one course exceeds a duplication "
            "gate (>50% duplicated practice stems or >50% identical misconceptions)."
        )
        return 1

    print("lint_duplication: OK - all courses within duplication gates.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
