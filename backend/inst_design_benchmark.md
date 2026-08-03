# Instructional Design Course Benchmark

This benchmark is generated from the current `frontend/content` tree and is
intended as a human-readable companion to `backend/content_audit_report.md`.
The audit report is the release gate; this document explains what the numbers
mean for the adaptive textbook experience. Last refreshed: **2026-08-03**.

## Current course-level comparison

| Course | Sections | Avg words | Avg headings | Avg inline quizzes | Avg dynamic scenarios | Practice coverage | Misconception coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| inst-design | 17 | 3455.6 | 19.1 | 1.06 | 1.18 | 100% | 100% |
| dynamics | 11 | 3521.9 | 26.3 | 1.82 | 1.00 | 100% | 100% |
| bio-inspired | 10 | 3762.6 | 20.2 | 1.40 | 1.10 | 100% | 100% |

The comparison set is deliberately internal: `dynamics` is the strongest
structural benchmark, while `bio-inspired` is the strongest narrative and
scenario benchmark. `inst-design` now has a complete learning loop rather
than the older article-library profile described in the superseded report.

## What the current evidence supports

- All 17 `inst-design` sections have a narrative, metadata, practice bank, and
  misconception bank.
- Every section contains an inline formative quiz and a dynamic application
  scenario; `01/01` has three scenarios and `05/01` has two quizzes.
- The content sufficiency audit scans 256 sections across eight courses with
  zero high-priority gaps, zero missing practice banks, and zero missing
  misconception banks.
- Static snapshot validation, duplication linting, and boilerplate linting
  are separate release checks; passing this benchmark does not replace them.

## Section-level profile (`inst-design`)

| Section | Words | Headings | Quizzes | Scenarios | Practice | Misconceptions |
| --- | ---: | ---: | ---: | ---: | :---: | :---: |
| 01/01 | 3518 | 16 | 1 | 3 | Yes | Yes |
| 01/02 | 3757 | 13 | 1 | 2 | Yes | Yes |
| 01/03 | 3445 | 19 | 1 | 1 | Yes | Yes |
| 02/01 | 3205 | 17 | 1 | 1 | Yes | Yes |
| 02/02 | 2740 | 17 | 1 | 1 | Yes | Yes |
| 02/03 | 3004 | 23 | 1 | 1 | Yes | Yes |
| 02/04 | 3439 | 18 | 1 | 1 | Yes | Yes |
| 02/05 | 3242 | 16 | 1 | 1 | Yes | Yes |
| 02/06 | 3460 | 27 | 1 | 1 | Yes | Yes |
| 02/07 | 3749 | 17 | 1 | 1 | Yes | Yes |
| 02/08 | 3415 | 19 | 1 | 1 | Yes | Yes |
| 03/01 | 3671 | 16 | 1 | 1 | Yes | Yes |
| 04/01 | 3468 | 18 | 1 | 1 | Yes | Yes |
| 05/01 | 3637 | 26 | 2 | 1 | Yes | Yes |
| 06/01 | 3588 | 16 | 1 | 1 | Yes | Yes |
| 07/01 | 3560 | 21 | 1 | 1 | Yes | Yes |
| 08/01 | 3848 | 26 | 1 | 1 | Yes | Yes |

## Remaining design work (not a release defect)

The course is release-ready on structural content gates. Continued research
work can still improve item discrimination, misconception specificity, and
scenario branching based on pilot data. Those are evaluation hypotheses, not
claims that the current course is missing its core practice or remediation
layer.
