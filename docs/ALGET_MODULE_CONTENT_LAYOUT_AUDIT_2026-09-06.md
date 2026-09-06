# ALGET module content and layout audit — 2026-09-06

## Scope

- 8 courses, 256 authored sections, 256 metadata records.
- Desktop reader paths at 1280px and representative mobile reader paths at 390px.
- Instructor ingestion path: Google Docs link, PDF upload, source parsing, shadow draft, review gate, publish, reader runtime.

## Findings

| Check | Result |
| --- | --- |
| Content schema / metadata | 256/256 valid; 0 hard errors; 0 soft warnings |
| Boilerplate leakage | 0 occurrences |
| Duplication gates | All supplement courses pass |
| Content depth | 256/256 sections ≥1,200 words; overall median 2,084 words |
| Static snapshot | 256/256 sections across 8 courses |
| Content sufficiency audit | 0 high-priority gaps; no missing practice or misconception coverage |
| Content quality audit | 192 audited supplement sections; mean 12.55/15; below 8: 0; LXD leaks: 0 |
| Browser reader sweep | 254/256 in the long single-browser sweep; the 2 failures were Chromium/Vite resource exhaustion (`ERR_NO_BUFFER_SPACE` / navigation timeout), not app assertions. Both failed routes passed fresh isolated retries with readable narrative, interactive components, and no page overflow. |

## Runtime changes

The instructor source parser now creates a governed, source-grounded runtime package for every detected section:

- learner-readable lesson text with an evidence boundary;
- source references and a source-only retrieval chunk;
- concept IDs for mastery and analytics;
- one multiple-choice and one teach-back formative item;
- tutor, activity, simulation, analytics, and social-dynamics contracts;
- explicit `approval_required`, `student_visible`, and citation-verification states.

Published section loading exposes the practice and knowledge-base artifacts to the reader. BigAL chat and rail assistance now receive the same approved retrieval chunks, while the backend and Cloudflare tutor prompts label source scope and uncertainty. Missing provider credentials use a generic evidence scaffold rather than a subject-specific hallucinated answer.

## Verification commands

- `npm test -- --run` — 71 files, 309 tests passed.
- `npm run lint` — passed with no warnings.
- `npm run build` — production build passed.
- `py -m pytest backend/test_*.py` (expanded by PowerShell) — 129 passed, 3 skipped.
- `node --test cloudflare/llm-proxy/src/*.test.mjs` — 23 passed.
- `node scripts/sweep_qa.mjs` — 254/256 on the resource-constrained long run; isolated retries for `/book/bio-inspired/06/01` and `/book/cat100-supplement/06/07` passed.

Representative captures are stored under `frontend/output/playwright/module-audit-2026-09-05/`.
