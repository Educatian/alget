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
- [x] CI warning/noise hardening on 2026-05-31:
  - GitHub Actions upgraded to `actions/checkout@v6`, `actions/setup-node@v6`, and `actions/setup-python@v6`.
  - Latest pushed run `26726869657` for commit `704effa` passed all jobs with zero job annotations.
- [x] Live Cloudflare smoke verifier added:
  - `node scripts/live_research_smoke.mjs` checks the production Pages homepage, static book TOC/section payload, `content_version` stamping, Pages access gate, adaptive Worker response, and optional Supabase provenance row polling.
  - `node scripts/live_research_smoke.mjs --require-access` passed against `https://alget.pages.dev` after production Pages secrets were set.
- [x] Cloudflare Pages production access-code secrets configured:
  - `EDUCATION_ACCESS_CODE`
  - `ENGINEERING_ACCESS_CODE`
  - `RESEARCHER_ACCESS_CODE`
- [x] Adaptive Worker production `SUPABASE_URL` secret configured.
- [x] Adaptive Worker production `SUPABASE_SERVICE_ROLE_KEY` secret configured.
- [x] Worker provenance persistence aligned to the canonical `recommendation_decisions` research table.
- [x] Strict production provenance smoke passed:
  - `node scripts/live_research_smoke.mjs --require-access --require-provenance`
  - Verified `https://alget.pages.dev` homepage, access gate, static section `content_version`, adaptive Worker response, and Supabase `recommendation_decisions` row for the returned `decision_id`.
- [x] Live table drift check added to the smoke script:
  - `node scripts/live_research_smoke.mjs --require-access --require-provenance --check-tables`
  - Current live Supabase has `event_logs`, `interaction_events`, `recommendation_decisions`, and `human_ratings`.
  - Current live Supabase is still missing `section_annotations`, `annotation_replies`, `annotation_reactions`, `annotation_read_states`, and `artifact_revision_scores`.
- [x] Missing-table UX hardening:
  - Social annotations now fall back to local storage after detecting missing Supabase annotation tables, avoiding repeated remote calls.
  - Artifact trace scores still persist through `event_logs` and `interaction_events`; the optional `artifact_revision_scores` mirror is skipped after a missing-table response.
- [x] Live optional-table migration prepared:
  - `supabase/migrations/20260531234000_provision_optional_research_tables.sql` provisions `section_annotations`, `annotation_replies`, `annotation_reactions`, `annotation_read_states`, and `artifact_revision_scores` with indexes, RLS, grants, and summary views.
  - `scripts/provision_live_optional_research_tables.ps1` applies the migration through `SUPABASE_DB_URL` or Supabase CLI `SUPABASE_ACCESS_TOKEN`, then reruns the live smoke with table checks.
  - Direct live application is blocked in this Codex environment because Supabase CLI has no platform `SUPABASE_ACCESS_TOKEN`, no linked project, and no `SUPABASE_DB_URL`; the supplied service-role JWT is enough for REST provenance checks but not DDL.
- [x] Post-provisioning verification hardened:
  - `node scripts/live_research_smoke.mjs --require-access --require-provenance --require-tables --probe-optional-writes` now fails on missing live tables and performs synthetic insert/delete probes for the optional social annotation and artifact score persistence paths.

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
- [ ] Apply `supabase/migrations/20260531234000_provision_optional_research_tables.sql` to live Supabase with `SUPABASE_ACCESS_TOKEN` or `SUPABASE_DB_URL`.
- [ ] Re-run `node scripts/live_research_smoke.mjs --require-access --require-provenance --require-tables --probe-optional-writes` and confirm all optional research tables return 200 and accept synthetic writes.
- [ ] Persist artifact judgment-gate outputs to a trusted server table, not only UI/local traces.
- [ ] Collect artifact revision ratings with reliability evidence or a defensible rubric validation plan.
- [ ] Calibrate learner model and recommendation policy on real exported event traces.
- [ ] Decide whether full FastAPI features are needed in production; if yes, host FastAPI separately and point `VITE_API_BASE` to it.
- [ ] Add typed answer tables or materialized item-stat views after real event volume exists.
- [ ] Add publication snapshot boundaries only if reproducible cohort releases become a study requirement; current `content_version` stamping is the additive first step.

## Practical Next Move

The next meaningful work is now the broader learner study smoke after live schema provisioning: social annotation -> artifact trace -> adaptive decision -> provenance row -> anonymized export. Until the missing tables are provisioned, learner-facing annotation and artifact telemetry degrade locally/canonically without breaking the reading workflow. The access gate, section read, adaptive decision, and provenance row segment is already verified in production.
