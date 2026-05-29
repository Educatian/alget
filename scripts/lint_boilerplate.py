#!/usr/bin/env python3
"""Authoring linter: fail if machine-generated boilerplate survives in content.

During an early content-generation pass, an identical block was pasted into the
end of roughly fifty section .mdx files. It was headed "## Textbook Deepening"
(usually followed by "## Worked Transfer" and "## Common Failure Mode") and
always contained the verbatim sentence beginning

    "Start by naming the structure of the situation..."

That block is absent from the gold-standard section (statics/01/01) and reads as
generic filler regardless of the section's actual topic, so it undermines the
deployed-textbook credibility claim. This linter walks every section .mdx file
under frontend/content/ and flags any remaining occurrence of the literal
boilerplate phrases, then exits non-zero so CI and pre-commit hooks can block
the regression.

The match is intentionally narrow. It keys on the exact boilerplate strings, so
legitimate, concept-specific headings (for example a plural "## Common Failure
Modes" section with real content) are NOT flagged.

Usage:  python scripts/lint_boilerplate.py
Exit code is non-zero when any boilerplate phrase is found.
"""
from __future__ import annotations

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT_DIR = os.path.join(ROOT, "frontend", "content")

# Literal phrases that only appear in the pasted machine-generated block.
# Each entry is matched as a plain substring against each line of every .mdx.
BOILERPLATE_PHRASES = (
    "## Textbook Deepening",
    "Start by naming the structure of the situation",
)


def iter_mdx_files(root: str):
    for dirpath, _dirs, files in os.walk(root):
        for name in sorted(files):
            if name.endswith(".mdx"):
                yield os.path.join(dirpath, name)


def scan_file(path: str):
    """Return a list of (line_number, phrase, line_text) hits for one file."""
    hits = []
    with open(path, "r", encoding="utf-8") as fh:
        for lineno, line in enumerate(fh, start=1):
            for phrase in BOILERPLATE_PHRASES:
                if phrase in line:
                    hits.append((lineno, phrase, line.rstrip("\n")))
    return hits


def main() -> int:
    if not os.path.isdir(CONTENT_DIR):
        print(f"lint_boilerplate: content directory not found: {CONTENT_DIR}")
        return 2

    total = 0
    files_with_hits = 0
    for path in iter_mdx_files(CONTENT_DIR):
        hits = scan_file(path)
        if not hits:
            continue
        files_with_hits += 1
        rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
        for lineno, phrase, line in hits:
            total += 1
            print(f"{rel}:{lineno}: boilerplate phrase {phrase!r}")
            print(f"    {line.strip()}")

    print()
    if total:
        print(
            f"lint_boilerplate: FAIL - {total} boilerplate occurrence(s) "
            f"in {files_with_hits} file(s)."
        )
        return 1

    print("lint_boilerplate: OK - 0 boilerplate occurrences found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
