# ALGET Engineering Course and Intervention Readiness Audit

Audit date: 2026-08-15
Scope: Statics, Dynamics, Bio-Inspired Design, research design, IRB materials, Qualtrics, Unity labs, telemetry, data export, and learner-model extraction

## Executive decision

- Product release: PASS. The production build, release-readiness gate, 276 frontend tests, 126 backend tests, 19 Worker tests, and 20 research tests passed after assignment-runtime, research-identity, measurement, missing-data, learner-model, and guided-simulation hardening.
- Engineering content: PASS for a controlled pilot. Statics has 14 sections, Dynamics 11, and Bio-Inspired Design 10. All active sections have metadata, practice, misconception support, references, and authored visual coverage.
- Operational pilot: READY after database event/RLS reconciliation. The four Unity rebuild/deployment and ALGET-embedded browser gates now pass. Use 5 to 10 learners only for technical shake-down or 30 to 50 for feasibility and measurement work.
- Confirmatory intervention: NO-GO today. Outcome-form validation, scale permissions, IRB amendment, real pilot evidence, live data/RLS QA, and enrollment commitments are outstanding.
- Recommended primary study: Bio-Inspired Design, 6 to 8 weeks, adaptive agentic support versus fixed support, with the same textbook and simulations in both arms.
- Confirmatory recruitment target: current operational placeholder 300 for d = .30, with about 255 expected complete cases; 264 remains only the earlier normal-approximation screen.

## Evidence audited

| Area | Evidence | Finding |
|---|---|---|
| Frontend | Vitest, ESLint, and Vite production build | 63 files and 276 tests passed; targeted lint and production build passed |
| Backend | Pytest | 126 passed, 6 skipped; one dependency deprecation warning |
| Worker | Node test runner | 19 passed |
| Research | Pytest, dataset/trial-analysis/model-extraction smokes, package validator | 52 passed; all three synthetic smokes passed; package validator passes 61/61 checks including fail-closed live Qualtrics flow auditing, Unity preview/provenance, local Supabase 24-migration replay and 21/21 RLS/allocation/export QA, and IRB packet evidence |
| IRB packet | DOCX accessibility audit, PDF page/text checks, full-resolution visual review | 3 DOCX with zero accessibility findings; 13/13 pages reviewed with no clipping, overlap, broken tables, or missing glyphs; IRB approval remains pending |
| Release | `scripts/release_readiness.mjs` | Security headers, fallback, pause control, health, RLS contracts, citations, catalog, images, and secret scan passed |
| Engineering corpus | 35 active engineering sections | Statics 14, Dynamics 11, Bio-Inspired 10 |
| Research data | real-artifact validation status | No real learner export yet; current evidence is structural or synthetic |
| Existing IRB | protocol, surveys, interview guide, assessment items | Outdated single-group design; inactive course included; survey burden and assessment-key errors found |
| Unity | four Unity 6000.4.9f1 projects and WebGL builds | all four rebuilt and deployed; 34 EditMode tests plus two Gecko QA suites pass; four-app live browser smoke has zero console errors |
| Qualtrics | five generated QSF files, codebook, provisioning script, live manifest, and fail-closed authenticated read-only audit | Five authenticated projects remain inactive; pre/post-survey/gift flow contracts pass, while posttest and retention are correctly held for missing integrity-denial end branches. Replacement provisioner now injects both branches; scoring, sensitive-field permissions, IRB wording, mobile, and synthetic/export QA remain |
| ALGET preview | branch preview, deployed static payload, four embedded Unity frames, browser diagnostics | 13/13 authored labs present in deployed payload; all four Unity canvases load inside the textbook with exact parent origin; zero browser errors/warnings |
| Supabase | linked migration list, remote schema/RLS/grants, advisors | production unchanged; migration history divergent; no engineering object deployed; 12 security warnings and 177 performance notices require triage |

## Existing IRB defects that require controlled retirement

1. The old protocol is a single-group pre/post study and cannot support a strong causal efficacy claim.
2. It includes Mechanics of Materials, which is not an active ALGET course.
3. It retains template instructions and unsupported or outdated claims that require source verification.
4. The old monthly survey has approximately 30 items and creates unnecessary repeated burden.
5. The final UX survey is incomplete and contains placeholder language.
6. The interview guide is long, impact-leading, and poorly aligned with agentic governance and simulation traces.
7. The old assessment file contains multiple numerical answer-key errors, including centroid, modulus, and bending-stress items.

The old files should remain archived for provenance but must not be administered. The versioned `2026_revision` packet contains the replacement protocol, instruments, assessment blueprint, and Qualtrics package.

TrabeculaLabUnity is not currently a Git repository, so its source repair remains outside governed version control. The project was rebuilt with Brotli compression, passed 4/4 EditMode tests, deployed to `trabecula-lab-unity.pages.dev`, and passed live browser loading. Governance—not runtime build status—is now the remaining Trabecula-specific gate.

## Unity defects corrected locally

- Removed wildcard parent messaging from FinGrip and GeckoGrip.
- Changed PineMorph from same-window messaging to exact-origin parent messaging.
- Added a Trabecula browser telemetry bridge and normalized its schema version.
- Removed raw CER and transfer-rationale text from Trabecula telemetry in favor of length bands.
- Added ALGET receiver checks for exact origin, exact iframe window, source/simulation match, safe event names, field allow-lists, bounded text, and deduplication.
- Added default ALGET embedding for all four Unity labs and a guided mid-text activity frame for all 13 engineering simulations.
- Added a pseudonymous, allow-listed Supabase export view and a tested session-feature builder.
- Added a privacy-gated baseline versus telemetry-fused learner-model comparison with grouped stratified cross-validation, calibration metrics, model card, artifact fingerprints, a no-real-data gate, and an explicit live-deployment block.
- Added complete-case ANCOVA plus regression multiple-imputation, stabilized IPW, and differential-attrition delta-adjustment sensitivity analyses using no post-treatment covariates.
- Replaced caller-controlled deterministic assignment with a concealed permuted-block schedule, a service-role-only hashed allocation table, and a no-argument authenticated claim RPC.
- Removed Study-ID-derived research passwords and visible aliases. Research access now requires an administrator-bound invitation, a pre-provisioned schedule row, and an immutable restricted roster row; raw Study ID is excluded from session telemetry.
- Added fail-closed research-course assignment verification. Comparison learners receive only a fixed practice rail and no chat; treatment learners retain the adaptive path. Strict study deployment can reject non-treatment adaptive-policy requests at the Worker boundary.

## Remaining external gates

1. In the five inactive Qualtrics projects, configure scoring and sensitive-field permissions, replace IRB hold wording, and conduct synthetic-response/export QA.
2. Obtain IRB approval for compensation, duplicated pre/post PII collection, the separate contact table, recruitment, and revised outcomes.
3. Reconcile ALGET preview iframe events from all four deployed Unity labs, including origin-spoof, duplicate-event, and zero-PII export checks.
4. Reconcile the currently divergent local/remote Supabase migration histories before any push. Then apply the research migrations in an isolated preview/staging project, import a synthetic concealed allocation schedule, provision invitation-bound test accounts, set strict Worker enforcement, and validate treatment/comparison claim, self-enrollment denial, crossover prevention, RLS, and service-role-only export behavior using non-admin study accounts.
5. Complete expert review, cognitive interviews, and a 30 to 50 learner measurement pilot.
6. Re-estimate power from pilot data and preregister before viewing confirmatory outcomes.
7. Resolve repository/content licensing and third-party asset provenance before public data or software release.
8. Build pre-decision learner-state snapshots and validate the selected model on a later cohort or external site before any live adaptive use.

## Decision rule

Begin a technical shake-down only after preview event reconciliation passes. Begin a 30 to 50 learner feasibility pilot only after IRB approval and Qualtrics QA. Begin confirmatory recruitment only after every protocol go/no-go gate passes and the pilot-recalculated target is credibly available; the current operational placeholder is 300 recruits.

## Preview verification completed

The non-production ALGET preview at `engineering-study-qa-2026081.alget.pages.dev` now serves fresh Bio-Inspired snapshots rather than the stale August 3 snapshot. A new release gate compares engineering MDX with the deployed static substrate. ALGET CSP permits only the four exact Unity hosts. FinGrip, Trabecula, GeckoGrip, and PineMorph each created a WebGL canvas inside its authored textbook position, and browser diagnostics contained no errors or warnings. All 12 Unity binary responses (data, framework, WASM across four sites) now use Brotli, correct MIME types, and immutable caching. Database persistence is intentionally not claimed by this evidence.
