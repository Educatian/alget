# ALGET Perfection Gap Analysis

Date: 2026-05-05
Purpose: identify what still needs to be added for A+ / top-tier intelligent textbook readiness after the work-product-centered redesign pass.

## Executive judgment

ALGET is now past the "more content" phase. Adding more pages or more images will not materially improve the project unless those additions strengthen the closed evidence loop.

The remaining perfection gap is:

> Can ALGET prove that work-product-centered adaptive support improves real learner deliverables, and can instructors see why?

The current system now has strong scaffolding:

- Work Product Studio;
- eight-part trace model;
- AI feedback judgment gate;
- annotation telemetry;
- adaptive recommender inputs;
- server-side trace validation;
- broad course coverage.

But the A+ threshold requires five more layers: semantic artifact scoring, closed-loop adaptive support, instructor-facing cohort insight, hard browser/accessibility QA, and pilot evidence.

## Current readiness estimate

| Layer | Current level | A+ target | Gap |
|---|---:|---:|---|
| Content volume and coverage | 9.3 | 9.5 | small |
| Work-product-centered UX | 8.4 | 9.5 | moderate |
| Artifact trace validity | 8.0 | 9.5 | moderate |
| Adaptive intelligence | 7.4 | 9.3 | large |
| Social annotation integration | 6.8 | 9.0 | large |
| Instructor analytics | 6.2 | 9.2 | large |
| Empirical evidence | 4.5 | 9.5 | critical |
| Accessibility/browser QA | 6.0 | 9.0 | large |
| Top-tier novelty argument | 8.0 | 9.5 | moderate |

Overall: **8.3 / 10** as a research prototype, **not yet A+ submission-ready**.

## P0 additions needed for perfection

### P0.1 Semantic artifact scoring

Current state:

- Work Product Studio records draft/revision lengths, judgment choice, rubric self-score, and trace completeness.
- Backend validates arithmetic and schema integrity.

Missing:

- The system does not yet evaluate whether the artifact actually improved semantically.
- It does not compare the initial draft to the revised work product.
- It does not validate learner self-rubric scores against instructor/AI/rubric scoring.

Add:

- `artifact_revision_scores` table.
- Server-side rubric scorer per artifact type.
- Before/after delta:
  - claim clarity delta;
  - evidence alignment delta;
  - specificity delta;
  - AI-overclaim risk delta;
  - transfer readiness delta.
- Optional instructor override score.

A+ exit criterion:

> Given a draft and revision, ALGET can produce a defensible rubric-dimension improvement profile and export it for research analysis.

### P0.2 Closed-loop adaptive recommendation from work-product evidence

Current state:

- Annotation and artifact signals affect backend recommendation scoring.
- Work Product Studio has local heuristic support selection.

Missing:

- The learner-facing Studio does not yet call the full adaptive recommendation policy.
- The recommendation explanation is not fully based on the same joint evidence model used by the backend.

Add:

- Work Product Studio calls `/api/adaptive/recommendation` after trace update.
- Recommendation response includes:
  - evidence snapshot;
  - reason codes;
  - suggested next support;
  - whether the learner should revise, compare, practice, or advance.
- UI displays "Why this support now" from backend policy, not local heuristic only.

A+ exit criterion:

> The next support move is selected from assessment, annotation, and work-product evidence through one auditable policy.

### P0.3 Instructor-facing cohort artifact dashboard

Current state:

- Analytics dashboard exists.
- Research schemas/views exist.

Missing:

- No high-value instructor view specifically for work-product failure patterns.

Add cohort panels:

- weak evidence links;
- shallow revision cases;
- over-accepted AI suggestions;
- high rejection with strong rationale;
- low confidence but high quality;
- high confidence but weak evidence;
- per-course work-product bottlenecks;
- annotation-to-artifact transfer map.

A+ exit criterion:

> An instructor can identify which artifact judgment skills are breaking down across the class within 60 seconds.

### P0.4 Actual artifact text export with privacy boundary

Current state:

- Logs mostly metadata and length.
- This is safer but weak for qualitative research.

Missing:

- No research-grade artifact text export with minimization/anonymization.

Add:

- opt-in artifact text capture;
- anonymized export view;
- raw artifact text stored separately from event metadata;
- instructor/research role-gated access;
- redaction pipeline for names/emails.

A+ exit criterion:

> The system can support qualitative coding and rubric reliability without leaking unnecessary student data.

### P0.5 Pilot-ready study workflow

Current state:

- RCT/protocol docs and measurement bank exist.
- No real pilot data yet.

Missing:

- Enrollment, condition assignment, pre/post/retention, export, and analysis all need a full dry run with realistic participants or seeded pilot sessions.

Add:

- pilot launch checklist;
- seeded pilot data generator matching current schemas;
- export script for:
  - participants;
  - pre/post scores;
  - annotation events;
  - work-product traces;
  - adaptive recommendations;
  - rubric scores.
- analysis notebook validating the full pipeline.

A+ exit criterion:

> A pilot can run without ad hoc manual data repair.

## P1 additions needed for polish and reviewer confidence

### P1.1 Brain graph explanation and action prompts

Expert review specifically flagged that the brain graph may be useful but underexplained.

Add:

- "What this shows" microcopy.
- "What to do next" action prompt.
- concept status legend:
  - new;
  - developing;
  - stable;
  - at risk;
  - transfer-ready.
- direct links from concept nodes to relevant work-product checkpoint.

### P1.2 Returning learner check-in

Progress exists, but check-in is not explicit enough.

Add:

- return-state banner:
  - last section;
  - last incomplete work-product field;
  - next recommended action;
  - pending AI judgment/revision.

### P1.3 More constructive interactive panels

Expert review wanted higher-order interaction beyond hover/click.

Add:

- drag-and-drop sequence builder;
- claim-evidence matching task;
- rubric sorting task;
- visual workflow constructor;
- data story chart-choice challenge.

### P1.4 AI response specificity control

The new judgment gate records learner evaluation, but it does not guarantee better AI outputs.

Add:

- response contract requiring:
  - one specific issue;
  - one rubric dimension;
  - one evidence reference;
  - one next action;
  - one caution.
- automated response quality validator:
  - rejects vague feedback;
  - flags unsupported claims;
  - detects missing next action.

### P1.5 True browser and accessibility QA

Current tests are strong for unit/integration/build, but not enough for top-tier polish.

Add:

- Playwright full learner path:
  - enter course;
  - annotate text;
  - complete Work Product Studio;
  - trigger adaptive help;
  - complete knowledge check;
  - navigate next/previous;
  - open dashboard.
- axe-core WCAG scan for:
  - BookLayout;
  - Work Product Studio;
  - PerusallLayer;
  - DiagnosticAssessment;
  - AnalyticsDashboard.

## P2 additions for long-term product superiority

### P2.1 Instructor authoring/customization

Expert review requested modular customization.

Add:

- activity block library;
- instructor module composer;
- PDF/video/link upload;
- assignable work-product template;
- rubric editor.

### P2.2 Perusall-competitive annotation layer

Add:

- threaded replies;
- group filters;
- instructor scoring;
- annotation heatmap;
- unresolved confusion queue;
- evidence-link transfer into Work Product Studio.

### P2.3 Specialized studios per course

The general Work Product Studio is now coherent, but A+ product feel needs specialized editors:

- AIL606 Lesson Redesign Studio;
- AIL606 AI-Use Policy Studio;
- CAT531 Data Story Studio with chart critique;
- CAT531 Dashboard Claim Studio;
- CAT100 Resume Evidence Studio;
- CAT100 Portfolio Reflection Studio.

## Strict next build order

1. **Backend artifact revision scoring schema + validator.**
2. **Work Product Studio calls backend adaptive recommender.**
3. **Instructor cohort artifact dashboard.**
4. **Brain graph explanation/check-in banner.**
5. **Playwright + axe QA.**
6. **Pilot export and seeded dry run.**

## Implementation pass completed on 2026-05-05

The first two items in the strict build order are now partially implemented.

### Added semantic artifact revision scoring

- Added backend `ArtifactRevisionScoreRequest`.
- Added deterministic `/api/research/artifact-revision/score`.
- The scorer compares initial draft and revised work product without persisting raw text.
- It returns:
  - claim clarity,
  - evidence alignment,
  - revision depth,
  - judgment quality,
  - transfer readiness,
  - specificity delta,
  - overall revision quality,
  - non-text diagnostics.
- Added `artifact_revision_scores` SQL table for future score-derived persistence and instructor override.
- Added backend tests confirming scoring and raw-text non-persistence policy.

### Connected Work Product Studio to backend adaptive recommendation

- Work Product Studio now requests server-side revision scoring before logging a trace.
- It logs score-derived revision metrics, not raw draft/revision text.
- It records the artifact trace adaptive signal and then calls the backend adaptive recommender.
- The UI can display backend policy recommendations under "Why This Support Now."

### Verification

- `python -m pytest backend\test_research_validation.py`: passed, 4 tests.
- `python -m pytest backend`: passed, 24 passed / 5 skipped.
- `npm.cmd run test -- ArtifactStudio.test.jsx ReadingNarrative.test.jsx`: passed.
- `npm.cmd run test`: passed, 10 files / 16 tests.
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed.
- `python research\run_quality_gate.py`: PASS.

### Remaining limitation after this pass

The scorer is deterministic and rubric-inspired, not yet an instructor-calibrated or LLM-validated semantic evaluator. It improves the research trace architecture, but A+ empirical claims still require human-rated artifact samples and inter-rater reliability.

## Implementation pass completed on 2026-05-05, round 2

The next two strict-build items are now implemented and quality-gated.

### Closed the expert-review continuity and graph-explanation gaps

- Brain Network now explains concept colors as evidence/action states rather than grades.
- Added explicit "What this shows" and "Next action" copy tied to annotation and Work Product Studio revision.
- Added `knowledge-graph-mount` so the onboarding tour can target the graph reliably.
- ReadingPane now includes a Returning Learner Check-In that can route learners back to their last section and states the next action: annotate evidence, judge AI feedback, and revise the work product trace.

### Added instructor-facing artifact cohort analytics

- Added score-derived `artifact_revision_scores` persistence from validated Work Product Studio traces.
- Added RLS for artifact revision scores.
- Added aggregate-only `artifact_revision_cohort_summary` SQL view grouped by course, section, studio mode, and artifact type.
- Revoked anonymous access to the cohort view.
- Research console now displays an Artifact Revision Cohort Dashboard with overall quality, evidence alignment, revision depth, judgment quality, weak-evidence count, shallow-revision risk, AI-judgment risk, and transfer-ready traces.
- Frontend dashboard now reads the aggregate view instead of raw artifact revision rows.

### Added regression coverage

- Added `KnowledgeGraph.test.jsx` for the action-map explanation and onboarding mount.
- Added `ReadingPane.test.jsx` for returning-learner resume and next-action cue.
- Extended `AnalyticsDashboard.integration.test.jsx` for artifact cohort analytics.
- Extended `research/run_quality_gate.py` with gates for semantic revision scoring, score-derived persistence, brain graph action explanation, returning-learner continuity, and instructor aggregate artifact dashboard.

### Verification

- `npm.cmd run test -- KnowledgeGraph.test.jsx ReadingPane.test.jsx AnalyticsDashboard.integration.test.jsx`: passed, 4 tests.
- `npm.cmd run test`: passed, 12 files / 19 tests.
- `npm.cmd run lint`: passed.
- `python -m pytest backend`: passed, 24 passed / 5 skipped.
- `python research\run_quality_gate.py`: PASS.
- `npm.cmd run build`: passed.

### Remaining limitation after round 2

The system now has a closed score-derived loop from learner artifact revision to instructor cohort analytics, but the semantic scores still need instructor calibration against sampled artifacts before publication claims can say the scorer is valid. The next A+ step is browser/WCAG QA and human-rating validation, not more content expansion.

## Testing simulation pass completed on 2026-05-05

This pass intentionally kept running tests until failures appeared, then fixed them.

### Errors found

- `npm audit` found 10 vulnerabilities after adding the browser test runner: 4 moderate and 6 high, including Vite, Rollup, React Router, minimatch, picomatch, flatted, postcss, ajv, and brace-expansion advisories.
- Playwright smoke spec was initially named in a way that Vitest collected it as a unit test, causing `test.describe()` runner conflicts.
- ESLint treated Playwright files as browser-only JavaScript and failed on Node `process`.
- Playwright initially tried to scan Vitest files and CSS because there was no Playwright config limiting test discovery to `e2e/`.
- Vite build emitted a circular chunk warning between `markdown-math` and `markdown-stack`.

### Fixes applied

- Installed `@playwright/test` and added `npm run test:e2e`.
- Ran `npm audit fix`, updating vulnerable transitive packages and direct versions where needed; audit now reports 0 vulnerabilities.
- Added `frontend/playwright.config.js` so Playwright only scans `frontend/e2e`.
- Added `frontend/e2e/playwright-smoke.spec.js` covering `/`, the three supplement course routes, `inst-design`, diagnostic, and analytics routes.
- Updated ESLint config so `e2e/**/*.js` and `playwright.config.js` use Node globals.
- Updated Vitest config to exclude `e2e/**`.
- Simplified Vite manual chunking so KaTeX/math markdown shares `markdown-stack`, removing the circular chunk warning.
- Extended `research/run_quality_gate.py` to require the Playwright route/browser smoke suite.

### Verification after fixes

- `npm.cmd audit --audit-level=moderate`: 0 vulnerabilities.
- `npm.cmd run test`: passed, 12 files / 19 tests.
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed with no circular chunk warning.
- `npm.cmd run test:e2e`: passed, 7 Chromium route/browser smoke tests.
- `python -m pytest backend`: passed, 24 passed / 5 skipped.
- `python research\run_quality_gate.py`: PASS.

## Bottom line

## HCI/system QA hardening pass completed on 2026-05-05

This pass was run from a strict HCI and systems-research stance. It found and fixed a serious false-confidence problem: the previous browser smoke setup could pass against an unrelated app already listening on the default Vite port. Playwright now owns an ALGET frontend on `127.0.0.1:5179` and a backend health target on `127.0.0.1:8000`, with semantic route assertions instead of only HTTP status checks.

### Errors found

- Playwright route smoke was not guaranteed to be testing ALGET; it could attach to another local app.
- Auth state caused browser tests to miss protected learning surfaces unless a stable E2E identity was provided.
- Generated supplement MDX could render most of the narrative as an indented code block when the first heading was flush but subsequent lines were indented; this hid the ArtifactStudio from the actual learner path.
- Accessibility checks initially exposed serious/critical issues around unnamed controls, contrast, scrollable code regions, and tour progress semantics.
- The full annotation-to-artifact-to-adaptive-support learner path did not have an end-to-end browser test.

### Fixes applied

- Added `@axe-core/playwright` and `frontend/e2e/accessibility.spec.js` for serious/critical WCAG route checks on landing, book, diagnostic, and analytics surfaces.
- Added `frontend/e2e/learner-workflow.spec.js` covering Perusall-style annotation, Work Product Studio completion, backend-scored revision quality, artifact trace validation, and adaptive rationale display.
- Hardened `frontend/e2e/playwright-smoke.spec.js` with semantic body assertions for ALGET routes.
- Updated `frontend/playwright.config.js` to launch the ALGET frontend/backend under Playwright control and isolate E2E auth with `VITE_E2E_AUTH_BYPASS=true`.
- Added offline Supabase behavior for E2E auth bypass so tests do not depend on live schema/cache state.
- Fixed generated-MDX indentation handling in `ReadingNarrative.jsx` and added a regression test.
- Fixed accessibility issues in onboarding, chat controls, contrast tokens, markdown code blocks, and Perusall labels.
- Extended `research/run_quality_gate.py` so the high-quality gate now requires accessibility, full learner workflow, E2E auth isolation, semantic browser smoke, and generated-MDX normalization.

### Verification after fixes

- `npm.cmd run lint`: passed.
- `npm.cmd run test`: 12 files / 20 tests passed.
- `npm.cmd run test:e2e`: 12 Chromium browser tests passed.
- `npm.cmd run build`: passed.
- `python -m pytest backend`: 24 passed / 5 skipped.
- `python research\run_quality_gate.py`: PASS.

### Remaining limitation after HCI/system QA

The interface and workflow evidence are now much stronger, but A+ journal-level claims still require human-rated artifact samples, inter-rater reliability for revision quality, and pilot/RCT outcome data. The system is now ready to support that evidence collection rather than merely claim it.

## Synthetic artifact validation sample completed on 2026-05-05

To rehearse the empirical A+ boundary before real pilot data, a synthetic validation harness was added at `research/sample_artifact_validation/`.

### Added sample artifacts and data

- `learner_artifact_samples.md`: four readable sample learner artifacts across AIL 606, CAT 531, and CAT 100.
- `synthetic_artifact_traces.csv`: 12 participant-level rows with course, section, arm, pre/post score, annotation count, support acceptance, system revision quality, and human mean quality.
- `instructor_ratings.csv`: two instructor raters scoring 8 artifact-quality dimensions on a 0-2 scale.
- `analyze_sample_validation.py`: stdlib-only reproducible analysis for inter-rater reliability, scorer-human agreement, and treatment/comparison outcome signal.
- `sample_validation_report.md`: generated output report.

### Test results

- `python research\sample_artifact_validation\analyze_sample_validation.py`: PASS.
- `python -m pytest backend\test_research_validation.py backend\test_adaptive_recommendation.py`: 8 passed.
- `python research\run_quality_gate.py`: PASS, now including the sample artifact-validation harness.

### Synthetic sample outputs

- Artifact trace rows: 12.
- Instructor rating rows: 24.
- Mean absolute rater total-score difference: 0.67 out of 16.
- Mean quadratic weighted kappa across rubric dimensions: 0.775.
- System revision score vs recomputed human mean score correlation: 0.991.
- Treatment mean gain: 0.253; comparison mean gain: 0.098; synthetic gain difference: 0.155.

### Boundary

These are synthetic data only. The value is pipeline validation: ALGET can now demonstrate the exact empirical path it needs for real instructor-rated artifact samples, IRR, scorer-human agreement, and pilot/RCT outcome analysis.

## Real-data artifact validation package added on 2026-05-05

The synthetic sample is now explicitly deprecated for evidence claims. The real empirical path has been moved to `research/real_artifact_validation/`.

### Added real-data 산출물

- `real_data_export.sql`: Supabase export queries for `artifact_revision_scores`, `human_ratings`, optional `evaluation_runs`, and optional `experiment_assignments`.
- `INPUT_SCHEMA.md`: required raw CSV columns.
- `RUBRIC_CODEBOOK.md`: 0/1/2 rating anchors for all eight artifact-quality dimensions.
- `VALIDATION_PROTOCOL.md`: real pilot validation rules, including no synthetic evidence, IRR, ICC, MAE/RMSE, Bland-Altman, and score-band checks.
- `analyze_real_validation.py`: analyzer that computes ICC(2,1), weighted kappa, system-human Pearson r, MAE, RMSE, Bland-Altman limits, score-band calibration, and anonymized derived exports.
- `NO_REAL_DATA_STATUS.md`: records that no raw learner/rater exports currently exist in the repo.

### Test result

- `python research\real_artifact_validation\analyze_real_validation.py`: correctly stopped with `NO_REAL_DATA` because `exports/raw_artifact_revision_scores.csv` is absent.
- `python research\run_quality_gate.py`: PASS; the gate now requires the real-data validation package and the no-real-data guard, not synthetic sample evidence.

### Boundary

There is currently no real learner artifact/rater export in the project folder. Therefore ALGET still cannot claim empirical artifact-improvement effects. The system now has a reviewer-defensible pipeline waiting for real pilot exports.

## Raw product submission lineage pass completed on 2026-05-05

The Work Product Studio submission path was tightened so the system can trace from the learner's raw artifact submission to score-derived research exports without persisting raw artifact text.

### Fixes applied

- Added a per-submit `submission_id` in `ArtifactStudio.jsx`.
- Added `source_text_metrics` for each submitted field: character count, word count, line count, and presence flag.
- Added `raw_submission_privacy` to the logged artifact trace, explicitly recording `raw_text_persisted: false` and `raw_text_sent_to_scorer: true`.
- Added the same lineage fields into `artifact_revision_scores.diagnostics` through `loggingService.js`.
- Updated `real_data_export.sql`, `INPUT_SCHEMA.md`, and `VALIDATION_PROTOCOL.md` so real exports must include `submission_id`, `source_text_metrics`, and `raw_submission_privacy`.
- Updated the real-data analyzer to require those lineage columns and include `submission_id` in the anonymized derived validation dataset.
- Updated the quality gate to require raw-submission lineage support in the real-data validation package.

### Test results

- `npm.cmd run test -- ArtifactStudio`: passed; verifies raw text is sent to the scorer but not persisted in the log payload.
- `npm.cmd run lint`: passed.
- `npm.cmd run test`: 12 files / 20 tests passed.
- `python -m pytest backend\test_research_validation.py`: 4 passed.
- `npm.cmd run test:e2e`: 12 browser tests passed.
- `npm.cmd run build`: passed.
- `python research\run_quality_gate.py`: PASS.
- `python research\real_artifact_validation\analyze_real_validation.py`: correctly stopped with `NO_REAL_DATA` because no real raw export exists yet.

## Artifact definition layer completed on 2026-05-05

The project now defines what counts as an artifact before asking learners to submit one.

### Fixes applied

- Added `frontend/src/lib/artifactTaxonomy.js` with canonical artifact families, definitions, acceptable submission forms, non-examples, and quality signals.
- Added `research/ARTIFACT_DEFINITION_AND_SUBMISSION_TAXONOMY.md` as the research-facing definition document.
- Work Product Studio now displays an Artifact Definition panel before the submission fields.
- Artifact traces now log `artifact_definition_id` and `artifact_family`.
- Real validation export SQL, input schema, protocol, and analyzer now require artifact definition lineage.

### Artifact families now defined

- Instructional Design Artifact.
- Learning Analysis Artifact.
- Prototype Evidence Artifact.
- Ethical Judgment Artifact.
- Data/Spreadsheet Artifact.
- Professional Evidence Artifact.
- Evaluation Artifact.
- General Course Work Product fallback.

### Verification

- `npm.cmd run test -- ArtifactStudio`: passed.
- `python research\run_quality_gate.py`: PASS.
- `npm.cmd run lint`: passed.
- `npm.cmd run test`: 12 files / 20 tests passed.
- `npm.cmd run test:e2e`: 12 browser tests passed.
- `npm.cmd run build`: passed.

## Artifact submission file specification completed on 2026-05-05

The artifact definition layer now includes concrete submission specs rather than only conceptual categories.

### Fixes applied

- Added `artifact-submission-spec-v1` to every artifact family in `frontend/src/lib/artifactTaxonomy.js`.
- Each artifact family now specifies required files, accepted file extensions, filename pattern, required content sections, and minimum content threshold.
- Work Product Studio now displays the File Specification before learners enter the trace fields.
- Artifact traces now log:
  - `artifact_submission_spec_version`,
  - `artifact_required_files`,
  - `artifact_accepted_formats`,
  - `artifact_naming_pattern`,
  - `artifact_required_sections`.
- `loggingService.js` carries the same fields into `artifact_revision_scores.diagnostics`.
- Real validation export SQL, input schema, protocol, and analyzer now require submission-spec metadata.
- `research/ARTIFACT_DEFINITION_AND_SUBMISSION_TAXONOMY.md` now includes a concrete file/content specification table.
- `research/run_quality_gate.py` now fails if runtime artifact taxonomy lacks submission specs or real-data export/analyzer omit spec lineage.

### Why this matters

This closes the earlier conceptual gap: ALGET now tells learners exactly what file form and content structure counts as an artifact submission, while preserving enough derived metadata for research validation without persisting raw artifact text.

The project is no longer weak because of insufficient content. It is weak only where the research argument still has gaps:

- Does artifact quality actually improve?
- Did adaptive support cause or support that improvement?
- Can instructors see the pattern?
- Can the system export defensible evidence?
- Can reviewers trust the interface and accessibility?

Those are the remaining additions required for "완벽성" rather than just feature richness.
