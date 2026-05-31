# ALGET Improvement Check

Date: 2026-05-31
Branch: `significant-upgrade`
Repository: `C:\Users\jewoo\Projects\alget`

## Current Read

ALGET has moved past the original 2026-05-28 "significant upgrade" backlog. The active improvement frame is no longer "add more content." The system now needs deployment hardening, provenance integrity, empirical pilot evidence, and selective server-side persistence where the current Cloudflare/static deployment intentionally degrades.

## Improvements Already Checked Off

- [x] Production grading no longer depends only on flat `expected_value`; solver coverage and grading data were expanded.
- [x] Metadata substrate exists across all 8 courses: concepts, prerequisite graph, practice ids, difficulty, misconception linkage.
- [x] The 192 Summer 2026 supplement sections are differentiated rather than reused boilerplate.
- [x] Content depth pass is complete across 256 sections.
- [x] Interactive MDX components are wired into all sections and use explicit close tags rather than self-closing custom tags.
- [x] Accessibility/UDL pass landed: dialogs, skip link, SVG labels, quiz/chat affordances, UDL reading prefs, TTS, reduced motion, and axe/e2e checks.
- [x] Design overhaul landed: token system, dark-mode parity, reading width, mobile navigation, clearer toolbar and affect labels.
- [x] Content trust verification landed: numeric/citation/artifact issues were fixed and documented.
- [x] Cloudflare Pages static hosting is live for the app.
- [x] Adaptive recommendation logic is ported to Cloudflare Worker and parity-checked against Python.
- [x] Static `/api/book/*` snapshots cover all 8 TOCs and 256 sections.
- [x] Hosted static snapshots now carry `content_version` descriptors for provenance.
- [x] CI scope has expanded from content/frontend/backend to include e2e, static snapshot verification, and Worker checks.
- [x] Current local gates passed on 2026-05-31:
  - `python scripts/validate_content.py` -> 256 sections, 0 hard errors, 0 soft warnings.
  - `python scripts/lint_boilerplate.py` -> 0 boilerplate occurrences.
  - `python scripts/lint_duplication.py` -> all supplement courses pass duplication gates.
  - `node scripts/verify_static_snapshot.mjs` -> 256 static sections across 8 courses.
  - `npm.cmd run lint` in `frontend/` -> pass.
  - `npm.cmd run test` in `frontend/` -> 32 files, 116 tests pass.
  - backend pinned pytest suite -> 56 passed, 1 skipped.
  - adaptive Worker parity -> 13/13 fixtures pass.
  - `npm.cmd run build` in `frontend/` -> pass.
  - Worker dry-runs for `adaptive-recommendation` and `llm-proxy` -> pass.
  - `npm.cmd run test:e2e` in `frontend/` -> 12 Playwright tests pass.

## Current Uncommitted Improvement Set

- [x] Add CI jobs for Playwright e2e, static snapshot integrity, and Worker parity/dry-runs.
- [x] Harden access-code validation: configured codes only by default, fallback codes gated by `ALLOW_FALLBACK_ACCESS_CODES=true`, case-insensitive compare.
- [x] Remove credentialed wildcard CORS from FastAPI and move to explicit allowlist plus `ALGET_ALLOWED_ORIGINS`.
- [x] Read JSON/MDX with `utf-8-sig` to tolerate BOM-marked generated files.
- [x] Add `content_version` descriptors to section payloads and static snapshots.
- [x] Make static export and grading-data bake fail loudly when generated artifacts are incomplete.
- [x] Add static snapshot verifier for Cloudflare Pages deployment safety.
- [x] Preserve adaptive Worker `decision_id` through the LLM proxy and forward `content_version`.
- [x] Improve markdown-authored quiz compatibility: `InteractiveQuiz` now accepts `correctIndex`, `correctindex`, and `correct-index`.
- [x] Improve `KnowledgeCheck` resilience for string options or option objects missing explicit ids.
- [x] Fix `ParameterExplorer` live-output semantics by wrapping `dl` inside a status region instead of putting `role=status` directly on `dl`.
- [x] Update Cloudflare hosting docs and contributor gate docs to match the current deployment model.
- [x] Ignore Playwright run artifacts (`frontend/test-results/`, `frontend/playwright-report/`) so e2e verification does not pollute review status.

## Recheck on 2026-05-31 15:00 PT

- [x] `node scripts/verify_static_snapshot.mjs` -> PASS, 256 sections across 8 courses.
- [x] `python scripts/validate_content.py` -> 256 sections, 0 hard errors, 0 soft warnings.
- [x] `npm.cmd run lint` in `frontend/` -> pass.
- [x] `npm.cmd run test` in `frontend/` -> 32 files, 116 tests pass.
- [x] backend pinned pytest suite -> 56 passed, 1 skipped.
- [x] adaptive Worker parity -> 13/13 fixtures pass.
- [x] `npm.cmd run build` in `frontend/` -> pass.
- [x] Worker dry-runs for `adaptive-recommendation` and `llm-proxy` -> pass.
- [x] `npm.cmd run test:e2e` in `frontend/` -> 12 Playwright tests pass.

## Remaining Improvement List

- [ ] Run the actual pilot protocol with real learners; the main A+ boundary is empirical evidence, not more content.
- [ ] Provision live Supabase social annotation tables and RLS from `backend/supabase_all_in_one.sql`.
- [ ] Configure Worker/Pages secrets and env vars in production:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ENGINEERING_ACCESS_CODE`
  - `EDUCATION_ACCESS_CODE`
  - `RESEARCHER_ACCESS_CODE`
- [ ] Verify Worker provenance writes against the live Supabase project after secrets are set.
- [ ] Persist artifact judgment-gate outputs to a trusted server table, not only UI/local traces.
- [ ] Collect artifact revision ratings with reliability evidence or a defensible rubric validation plan.
- [ ] Calibrate learner model and recommendation policy on real exported event traces.
- [ ] Decide whether full FastAPI features are needed in production; if yes, host FastAPI separately and point `VITE_API_BASE` to it.
- [ ] Add typed answer tables or materialized item-stat views after real event volume exists.
- [ ] Add publication snapshot boundaries only if reproducible cohort releases become a study requirement; current `content_version` stamping is the additive first step.

## Practical Next Move

Commit the current hardening set once reviewed, then deploy the Pages/Workers stack with production env vars. After deployment, the next meaningful work is a live end-to-end research-data smoke test: access gate -> section read -> annotation -> artifact trace -> adaptive decision -> provenance row -> anonymized export.
