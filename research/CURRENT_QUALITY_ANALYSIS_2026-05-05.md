# ALGET Current Quality Analysis

Date: 2026-05-05

## Executive Judgment

ALGET is now an A-level research prototype, but not yet A+ / top-tier intelligent textbook submission ready. The project clears the current automated quality gates, and the major content-volume problems are no longer the bottleneck.

Current grade estimate after the latest validation-loop fixes: **A-level prototype**, still not full A+.

The project is strongest on:

- System-wide course coverage: 192 supplement sections across AIL606, CAT531, CAT100.
- Artifact-centered interaction: every supplement section includes an ArtifactStudio block.
- Basic stability: lint, build, tests, strict quality gate, and content audit pass.
- Research scaffolding: deterministic assignment, analysis plan, model validation, RCT views, item-response schema, and benchmark reports exist.
- Evidence validation: diagnostic item responses and ArtifactStudio traces now pass server-side validation before research persistence.

The project is weakest on:

- Whether artifact quality scores are validated against real before/after learner work or instructor review.
- Whether annotation and artifact evidence drive the adaptive recommender policy.
- Whether route/browser/accessibility testing covers the full learner path.
- Whether the system can claim learning gains or novelty versus established intelligent textbook systems.

## Verification Run

Commands run:

- `python research\run_quality_gate.py` - PASS
- `python backend\content_quality_audit.py` - PASS; 192 sections, mean score 14.66, below_8 = 0, hardened_like = 192
- `python -m pytest backend\test_research_validation.py backend\test_adaptive_recommendation.py` - PASS; 6 tests
- `npm.cmd run lint` - PASS
- `npm.cmd run test` - PASS; 10 test files, 16 tests
- `npm.cmd run build` - PASS

## Quality Scores

| Area | Score | Judgment |
|---|---:|---|
| Build/test stability | 9.2/10 | Lint, build, Vitest, focused backend tests, route smoke tests, and quality gate pass |
| Content structure | 9/10 | 192 sections remain structurally strong |
| Artifact-centered UX | 8/10 | ArtifactStudio includes mode-aware prompts, quality rubric, support rationale, and trace scoring |
| Adaptive intelligence | 7.2/10 | Support rationale is visible/logged, trace validation is server-backed, and annotation/artifact signals now affect recommender scores |
| Social annotation | 6.5/10 | Perusall-like layer now contributes adaptive telemetry; still needs threads, grouping, and instructor analytics |
| Empirical reproducibility | 8/10 | Diagnostic itemResponses and ArtifactStudio traces now pass server-side validation before persistence |
| Novelty vs existing intelligent textbooks | 7/10 | Artifact-centered evidence loop is more defensible; still needs outcome data |
| Publication readiness | 7/10 | Strong A-level prototype; pilot/RCT and accessibility/deployment evidence remain |

Overall: **8.2/10**.

## P0 Findings

### Resolved P0.1 Diagnostic item responses are now server-validated

`DiagnosticAssessment.jsx` constructs item-level responses from questions and answers. `researchService.recordEvaluationResult()` accepts the rows, calls `/api/research/evaluation/validate`, and only then persists normalized rows to `evaluation_responses`.

The backend validator recomputes item count, score, percentage, confidence normalization, selected/correct indices, and `server_validated` metadata.

### Resolved P0.2 ArtifactStudio quality traces are now server-validated

`ArtifactStudio` logs rubric scores, trace score, selected support move, recommended support move, confidence, and support rationale. `loggingService` now validates `artifact_studio_trace` events through `/api/research/artifact-trace/validate` before writing telemetry.

The backend validator recomputes trace score, normalized rubric, artifact quality score, and recommended support move.

### Partially resolved P0.3 Support rationale is visible, but not fully recommender-driven

The interface shows a "Why This Support Now" panel and logs the validated support decision. The remaining A+ gap is that support selection is still trace-score heuristic logic, not yet the same adaptive policy that uses annotation, assessment, and artifact evidence jointly.

## Remaining A+ Gaps

P1.1 Route/browser/accessibility coverage is improved but still incomplete. `BookLayout.integration.test.jsx` now smoke-tests `/book/ail606-supplement/01/01`, `/book/cat531-supplement/01/01`, and `/book/cat100-supplement/01/01`. Remaining work is true browser rendering plus WCAG checks for ArtifactStudio, PerusallLayer, DiagnosticAssessment, and BookLayout.

P1.2 Benchmark score remains below the submission target. `INTELLIGENT_TEXTBOOK_BENCHMARK_AUDIT.md` is credible for a prototype, but the project needs real adaptive reasoning and pilot evidence to exceed ALEKS/Alta/SmartBook/zyBooks/Perusall comparators.

P1.3 Social annotation remains Perusall-like but not Perusall-competitive. Add threads, class/group views, instructor filters, scoring, and annotation-to-support decision links.

P1.4 Artifact scoring needs external validation. The system now validates arithmetic and schema integrity, but not the semantic quality of learner artifacts against real before/after work.

P1.5 Advanced orchestration should be added only if it improves measured workflow quality. `ADVANCED_ORCHESTRATION_DECISION.md` records the decision: do not add LangChain as a broad wrapper now; prioritize a local graph/state-machine evidence workflow, retrieval evaluation, and reproducible state-transition traces before adopting LangGraph/LlamaIndex/LangChain dependencies.

## Bottom Line

The previous failures on shallow packets, template uniformity, citation grounding, measurement depth, and unvalidated trace wiring are resolved by automated gates.

The next A+ move is **closing the adaptive evidence loop**:

1. Instructor/server-side rubric scoring validates ArtifactStudio quality scores against real artifacts.
2. Annotation and artifact evidence select adaptive support through the recommender layer with stronger instructor-visible explanations.
3. True browser/accessibility tests cover the full learner path beyond the new route smoke tests.
4. Instructor/group annotation views make the Perusall-like layer analytically useful.
5. Pilot data show better learning, calibration, or artifact revision quality.

Until those are done, the strongest honest claim is:

> ALGET is an artifact-centered intelligent textbook prototype with system-wide trace instrumentation, server-validated research evidence loops, and emerging annotation/adaptive support infrastructure.
