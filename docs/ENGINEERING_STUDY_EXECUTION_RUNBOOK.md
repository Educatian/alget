# ALGET Engineering Study Execution Runbook

## Phase 0: controlled development

Exit evidence:

- ALGET tests, build, release gate, and study-package validator pass.
- Qualtrics QSF files remain inactive and fingerprints are recorded.
- No real learner data are present in development exports.

## Phase 1: IRB and expert validation

1. Fill gift-card amount, milestones, timing, tax language, PII retention, and access roles in `ENGINEERING_RECRUITMENT_AND_CONSENT_DRAFT.md`, `ENGINEERING_DATA_AND_COMPENSATION_SOP.md`, and the study manifest.
2. Follow `ENGINEERING_IRB_SUBMISSION_CROSSWALK.md`; transfer the protocol and consent content into the current UA HRP-503a and HRP-502 templates and submit recruitment, QSF printouts, assessment forms, data/compensation SOP, and data-flow material.
3. Obtain 6 to 8 domain expert and 3 to 5 measurement expert ratings.
4. Conduct 8 to 12 cognitive interviews.
5. Resolve every accuracy, ambiguity, burden, accessibility, and permissions issue.

Operationalize these steps with `research/measures/ENGINEERING_INSTRUMENT_VALIDATION_PROTOCOL.md`. Regenerate the deterministic fieldwork templates after any codebook change with `python research/measures/build_engineering_validation_packet.py`. Use nonsemantic reviewer/session IDs, aggregate expert ratings with `analyze_engineering_expert_review.py`, and preserve qualitative resolution minutes. I-CVI is a review flag, not an automatic item deletion rule.

Exit evidence: approval letter/amendment, decision log, expert CVI table, cognitive-interview revision table, and frozen development item version.

## Phase 2: Qualtrics and preview deployment

1. Import all five QSF files. Re-run the no-response read-only audit with `python scripts/audit_qualtrics_engineering_live.py --token-file <secure-local-token-file>`; never place the token in the repository or report.
2. Configure termination for no consent, under 18, or ineligible enrollment.
3. Configure 1-point scoring for each frozen selected-response key. Do not auto-score essays.
4. Hide outcome scores and answer feedback until retention is complete.
5. Confirm outcome forms contain Study ID only. Restrict the separate gift-card project's `PII_*` fields and collaborators; confirm analytic exports omit `PII_*` and raw Study ID.
6. Export the eligible de-identified roster with only `STUDY_ID`, `COURSE_SECTION`, and `BASELINE_SCORE`. Freeze pilot-informed baseline cut points.
7. Create a concealed seed file outside the repository and run `research/prepare_engineering_randomization.py`. Archive only its SHA-256 fingerprint in the registration package.
8. Import `service_role_allocation_import.csv` into `engineering_study_allocation_schedule` with the service role. Never import the raw Study ID schedule into the application database.
9. Set `ENGINEERING_STUDY_ENFORCEMENT=strict` on the study LLM deployment. Verify comparison users receive fixed practice only and cannot reach adaptive policy or chat endpoints; verify treatment users receive the adaptive path.
10. Rebuild and deploy all Unity apps with exact-origin bridges.
11. Compare `supabase migration list --linked` with the repository and reconcile every local-only/remote-only version before a database push. Apply the research migrations to isolated preview/staging first, then test RLS as treatment learner, comparison learner, instructor, service-role research exporter, compensation staff, and unauthorized authenticated user.
    - Set `ALGET_STAGING_SUPABASE_URL`, `ALGET_STAGING_SUPABASE_ANON_KEY`, and `ALGET_STAGING_SUPABASE_SERVICE_ROLE_KEY` outside the repository.
    - Run `python scripts/qa_engineering_study_staging.py --acknowledge-staging` and require a passing `research/evidence/engineering_staging_rls_qa.json` with successful fixture cleanup. The script hard-refuses the production project.
12. Complete an end-to-end synthetic learner journey across pre, concealed assignment claim, ALGET arm differentiation, post, gift-card record, and retention.
13. Execute every path, scoring, permission, export, and freeze-evidence check in `Qualtrics/QUALTRICS_LIVE_QA_RUNBOOK.md`; retain the exported inactive QSFs and screenshots with the QA record.

Exit evidence: Qualtrics survey checker screenshots, scoring reconciliation, seed hash and per-stratum balance report, assignment-claim conflict test, treatment/comparison screenshots, strict-worker 401/403 checks, access matrix, WebGL build hashes, browser matrix, event reconciliation, and zero-PII analytic export audit.

## Phase 3: technical shake-down

Enroll 5 to 10 authorized participants. Evaluate only operations: login, assignment persistence, content access, lab load, event completeness, survey redirects, payment workflow, accessibility, and support burden.

Exit thresholds:

- 100% assignment persistence with no arm crossover;
- at least 95% required-event delivery after retries;
- zero PII in research event/export payloads;
- no unresolved severity-1 safety, access, scoring, or data-loss defect;
- median survey/lab burden within approved estimates.

## Phase 4: measurement and feasibility pilot

Enroll 30 to 50 learners. Do not claim efficacy. Evaluate item difficulty/discrimination, rubric reliability, missingness, form timing, treatment differentiation, event quality, and pilot variance components.

Export selected-response data using `research/measures/fieldwork/ENGINEERING_MEASUREMENT_PILOT_LONG_TEMPLATE.csv` and run `research/measures/analyze_engineering_measurement_pilot.py`. Use `ENGINEERING_CONSTRUCTED_RESPONSE_SCORING_MANUAL.md`, the aligned `ENGINEERING_CONSTRUCTED_SCORE_TEMPLATE.csv`, and `analyze_engineering_constructed_scores.py` for blinded double-scoring. Resolve every HOLD in `bio_inspired_parallel_form_audit.json`; reconcile statistical flags with expert, cognitive, and content-coverage evidence before changing wording, keys, or form composition.

For the first review cycle, compare current and candidate items using `research/measures/qualtrics_candidate_v2/CURRENT_VS_CANDIDATE_DIFF.csv`, collect ratings with the candidate `fieldwork/ENGINEERING_EXPERT_REVIEW_TEMPLATE.csv`, and verify `candidate_validation.json` remains 17/17 after every revision. The final privacy/linkage gates require direct identifiers only in the private gift-card form, demographics only in the pre-survey with controlled nonresponse choices, complete fail-closed consent language, and top-of-flow `study_id`, `wave`, and `cohort` Embedded Data in all five forms. Pilot QA must confirm the Qualtrics export representation, visible-versus-embedded Study ID agreement, and exclusive “Prefer not to answer” behavior for the multi-select race/ethnicity item. Only an approved candidate may replace/reimport the inactive Qualtrics projects; replacement requires a new codebook, UI QA, exported inactive QSFs, hashes, and preregistration decision.

Exit evidence: frozen A/B/C forms, scoring manual, reliability report, revised power analysis, final randomization blocks, and a preregistration draft whose machine-readable lock passes integrity audit while still reporting registration as pending.

## Phase 5: confirmatory trial

1. Secure the pilot-recalculated recruitment target. Until that update, plan operationally for 300 recruits rather than the 264-person normal-approximation screen.
2. Freeze content, prompts, model, policy, QSF, codebook, allocation schedule, app builds, and database schema. Refresh `research/preregistration/engineering_preregistration_lock.json` only before outcome access and retain the prior lock in the controlled archive.
3. Complete every required decision in the lock, obtain `registration_ready=true` from `python research/preregistration/manage_engineering_preregistration_lock.py audit --require-ready`, and register the protocol before outcome access. Archive the registry timestamp/URL and lock SHA-256.
4. Import the preregistered concealed permuted-block schedule and allow each authenticated learner to claim only the row matching the domain-separated Study ID hash.
5. Provision research accounts through the administrator-only invitation function. Verify that the Study ID has a schedule row before invitation, the visible alias is random and independent of the Study ID, and learner self-enrollment into the research roster is denied.
6. Monitor only blinded operational metrics.
7. Lock the dataset, run the privacy/linkage audit, and execute the registered analysis.
8. Build the ITT dataset from the authoritative allocation import even for participants with zero ALGET or Unity events. Run `research/analyze_engineering_trial.py` only with the preregistered minimum-randomized gate.

## Phase 6: publication and model validation

- Report participant flow, deviations, fidelity, missingness, local-test limitations, delayed transfer, and effect uncertainty.
- Separate the ITT estimate from process and learner-model analyses.
- Validate the telemetry-fused learner model temporally or externally before deployment.
- Archive `MODEL_CARD.md`, cross-validated ROC AUC/Brier/log-loss/ECE metrics, deidentified out-of-fold predictions, and the SHA-256 artifact manifest. A synthetic smoke pass is software evidence only.
- Verify the target journal's current SSCI indexing and author requirements at submission.
- Release only de-identified data dictionaries, approved item metadata, synthetic examples, and reproducible code.
