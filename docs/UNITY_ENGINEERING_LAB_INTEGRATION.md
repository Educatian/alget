# Unity Engineering Lab Integration and Research Logging

Version: 1.0, 2026-08-15

## Current integration status

| Lab | Curriculum placement | Hosted build | ALGET behavior |
|---|---|---|---|
| FinGripLabUnity | Bio-Inspired 01/01, structural biomimicry | `https://fingrip-lab-unity.pages.dev/` | Embedded by default after the 2D structural lab |
| TrabeculaLabUnity | Bio-Inspired 01/01, cellular solids/load paths | `https://trabecula-lab-unity.pages.dev/` | Guided mid-text lab; URL can be overridden with `VITE_TRABECULA_UNITY_URL` |
| GeckoGripLabUnity | Bio-Inspired 04/01, dry adhesion | `https://geckogrip-lab-unity.pages.dev/` | Guided mid-text lab; URL can be overridden with `VITE_GECKOGRIP_UNITY_URL` |
| PineMorphLabUnity | Bio-Inspired 06/01, passive environmental response | `https://pinemorph-lab-unity.pages.dev/` | Embedded by default after the 2D thermal-control lab |

All four Unity players were rebuilt from the normalized local bridges and deployed. The remaining runtime gate is ALGET-to-database event reconciliation in a study preview, not standalone WebGL availability.

The read-only provenance audit in `research/evidence/unity_build_provenance_2026-08-15.json` fingerprints all `Assets`, `Packages`, and `ProjectSettings` files and compares five deployed files per app against the local WebGL build. All 20 deployed files are byte-identical to the local builds; all twelve compressed `.unityweb` payloads also pass Brotli, MIME, and immutable-cache checks. Source-to-commit provenance remains on hold: the three Git projects have uncommitted entries and Trabecula is not a Git repository.

Trabecula previously stored confidence as a `0–1` UI fraction while the canonical research schema requires `0–100`; this would have biased calibration error by approximately two orders of magnitude. The emitter now converts the fraction to a percentage at the telemetry boundary. The regression test passes in the five-test EditMode suite, the corrected WebGL build is deployed, and the canonical URL is again byte-identical to the verified local build.

The non-production ALGET preview `https://engineering-study-qa-2026081.alget.pages.dev` contains all 13 authored guided labs. Browser QA on immutable deployment `https://8361ea86.alget.pages.dev` loaded a WebGL canvas for all four Unity apps inside the textbook with exact `parentOrigin` and no console errors or warnings. This proves embedding and loading, not database persistence.

## Build-time configuration

Set these in the ALGET frontend deployment environment as needed:

```text
VITE_FINGRIP_UNITY_URL=https://fingrip-lab-unity.pages.dev/
VITE_PINEMORPH_UNITY_URL=https://pinemorph-lab-unity.pages.dev/
VITE_GECKOGRIP_UNITY_URL=https://geckogrip-lab-unity.pages.dev/
VITE_TRABECULA_UNITY_URL=https://trabecula-lab-unity.pages.dev/
```

Do not place secrets in Vite variables. They are compiled into public browser code.

## Browser transport contract

Each embedded URL receives `parentOrigin=<ALGET origin>`. The Unity `.jslib` bridge:

1. emits a same-window custom event for standalone debugging;
2. accepts only `https://alget.pages.dev`, the two recorded engineering QA deployments, or an approved localhost/loopback development origin;
3. sends only to that exact origin, never `*`;
4. posts `{ source, type: "learning-event", payload }`.

ALGET accepts the event only when:

- `event.origin` equals the iframe URL origin;
- `event.source` equals that iframe's `contentWindow`;
- source name maps to the expected simulation;
- event name matches a bounded identifier pattern;
- payload fields are on the explicit text, number, or boolean allow-list.

ALGET discards `detail` and `finalDesign` because either can contain learner-authored text. Deduplication uses anonymous app session ID, timestamp, and event name. The research export excludes names, email, chat, CER text, design text, device data, and direct user IDs.

## Canonical event fields

Use `bio-design-learning-event/1.0` in all four applications:

- app and anonymous session identifiers;
- UTC timestamp and event name;
- opportunity index, completed/available counts, and normalized progress;
- bounded input name and numeric or compact input value;
- prediction, confidence, result, and constraint flags;
- revision attempt and final-design indicator;
- competency score.

Free-response text may remain inside the learner's app for local display or a learner-initiated download, but it must not be posted to ALGET. Trabecula now emits length bands instead of CER or rationale text.

## Hosting requirements

- Serve `.wasm` as `application/wasm`.
- Serve Brotli or gzip files with the matching `Content-Encoding` header.
- Allow framing only by the production ALGET origin and approved preview origins through `Content-Security-Policy: frame-ancestors ...`.
- Use HTTPS and immutable caching for hashed build assets. Do not cache the loader HTML indefinitely.
- Keep development, preview, and production URLs separate in the study manifest.
- Test current desktop Chrome/Edge and Firefox at the minimum supported viewport. Mobile is not a study requirement unless separately validated.

## Deployment and QA sequence

1. Rebuild each Unity WebGL player from committed source with Unity `6000.4.9f1`.
2. Deploy to a versioned preview URL and verify content type, encoding, CSP, and frame policy.
3. Complete every learning opportunity from its ALGET section and verify one canonical row per browser event.
4. Send spoofed events from the top window and an unrelated iframe. Confirm rejection.
5. Repeat an event and confirm deduplication.
6. Confirm exports contain no `detail`, `finalDesign`, CER, rationale, name, email, or raw chat.
7. Export `engineering_sim_event_export`, run the feature builder, and reconcile event counts.
8. Freeze app build hashes and ALGET content/policy versions in the cohort manifest.

## Learner-model extraction

```bash
python research/simulations/build_sim_learning_dataset.py engineering_sim_event_export.csv derived/sim_features.csv
python research/build_engineering_analysis_dataset.py --pre pre.csv --post-survey post_survey.csv --posttest posttest.csv --retention retention.csv --assignments restricted/service_role_allocation_import.csv --sim-features derived/sim_features.csv --codebook qualtrics_codebook.csv --output derived/analysis_dataset.csv --audit derived/linkage_audit.json
python research/analyze_engineering_trial.py derived/analysis_dataset.csv derived/primary_analysis.json derived/primary_analysis.md --minimum-randomized 300
python research/simulations/train_learner_model.py derived/analysis_dataset.csv derived/models --mastery-threshold 0.70
```

The `0.70` mastery threshold is only a command example. Freeze a defensible threshold from expert and pilot evidence before confirmatory outcome access. The training script refuses identifiable/raw-text columns, non-hash participant IDs, fewer than 80 learners, or inadequately represented outcome classes. It uses learner-grouped stratified cross-validation and reports ROC AUC, Brier score, log loss, and 10-bin expected calibration error.

The output directory contains baseline and telemetry-fused development models, deidentified out-of-fold predictions, `metrics.json`, `MODEL_CARD.md`, and a SHA-256 `artifact_manifest.json`. Participant hashes are not written to the prediction file.

`research/simulations/run_simulation_feature_pipeline_smoke.py` now exercises the missing middle of this pipeline: 24 out-of-order synthetic events from all four Unity apps become eight session-feature rows and two learner aggregates. It verifies four-app coverage, timestamp-based final competency, `0–100` confidence calibration, assignment preservation, and exclusion of injected private text/PII. This is execution evidence only, not scientific validity evidence.

These models use full-intervention aggregates to predict an end-of-course outcome. They are suitable only for retrospective research comparison. They must not drive live support, grades, enrollment, or compensation. A live adaptive model requires features frozen at a documented pre-decision cutoff, a future outcome target, learner-grouped validation, and a held-out future cohort or external site. The model card remains deployment-blocked even when an external file is supplied because governance approval is a separate gate.

## Remaining release blockers

- Place TrabeculaLabUnity under governed version control, commit/tag the exact source state of all four apps, and bind the already-recorded source/build fingerprints to those release commits.
- Reconcile four-app ALGET preview events against the pseudonymous export and confirm zero raw text/PII.
- Reconcile the divergent Supabase migration histories, apply the research migrations in isolated preview/staging, and test RLS with non-admin study accounts plus a service-role-only exporter.
- Complete ALGET container/iframe browser QA across the supported desktop-browser matrix.
- Decide and document repository/content licensing and third-party asset provenance before public research release.
