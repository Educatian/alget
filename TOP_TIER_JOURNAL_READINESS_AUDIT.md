# ALGET Top-Tier Intelligent Textbook Readiness Audit

Date: 2026-05-05

## Bottom Line

ALGET is now beyond a generic expanded courseware package. The strongest current claim is
an artifact-centered intelligent textbook: learners read, annotate, practice, request or
receive support, and now externalize artifact judgment through the new ArtifactStudio
interface.

That is a credible system-paper direction. It is not yet an A+ empirical intelligent
textbook paper because the current evidence is still mostly structural and synthetic. The
next boundary is closed-loop adaptivity, scored artifact revision evidence, trusted data
capture, and real pilot outcomes.

## Evidence Checked

- `frontend/content/ail606-supplement/`
- `frontend/content/cat531-supplement/`
- `frontend/content/cat100-supplement/`
- `frontend/src/components/ArtifactStudio.jsx`
- `frontend/src/components/PerusallLayer.jsx`
- `frontend/src/components/ReadingPane.jsx`
- `backend/knowledge_tracing.py`
- `backend/supabase_research_schema.sql`
- `backend/supabase_rct_views.sql`
- `frontend/src/pages/AnalyticsDashboard.jsx`
- `research/INTELLIGENT_TEXTBOOK_BENCHMARK_AUDIT.md`
- `research/HIGH_QUALITY_REPRO_QA_REPORT.md`
- `research/A_PLUS_READINESS_REPORT.md`

## Current Strengths

1. Scale is no longer the bottleneck.
   - 256 total content sections.
   - 192 Summer 2026 supplement sections.
   - 192 artifact-studio entry points.
   - 192 downloadable artifact packets.
   - 192 deep exemplar PNGs.

2. ArtifactStudio sharpens the novelty claim.
   - Learners enter an artifact claim, evidence source, accepted suggestion, rejected or modified suggestion, support move, and confidence rating.
   - `artifact_studio_trace` logs course, section, artifact, support move, trace score, confidence, and field-length metadata.
   - The system now observes artifact reasoning completeness, not only reading completion, quiz correctness, or annotation volume.

3. The research package is now coherent.
   - Protocol, analysis plan, data dictionary, 36-item pre/post item bank, reproducibility smoke report, benchmark audit, and QA gate report exist.
   - Assignment reproducibility and ITT-vs-mediator separation are documented.
   - Learner-model validation compares rule-only, BKT-only, telemetry-fused BKT, tuned BKT, and tuned telemetry-fused BKT.

4. The product surface is coherent.
   - AIL606, CAT531, and CAT100 have course-specific supplement paths.
   - Reading flow includes practice, misconception support, affective reaction, knowledge checks, social annotation, visual anchors, and artifact traces.

## Resolved Or Substantially Improved Since The First Audit

- Template-uniformity blocker: strict QA now reports template marker max count 0.
- Shallow packet blocker: QA reports 0 artifact packets under 250 words.
- Missing artifact interface: QA reports 192 `<artifact-studio>` blocks.
- Weak measure depth: research package now includes 36 items, 12 per course, with balanced correct-answer positions.
- Generic novelty framing: benchmark audit now centers artifact-based, annotation-informed adaptivity rather than generic adaptive courseware.

## Remaining A+ Risks

### P0. ArtifactStudio Is Real But Generic

The interface is a common trace layer, not yet a family of specialized artifact workspaces.
It logs trace completeness and support-move metadata, but not scored before-after artifact
states.

Required repair:
- Keep the common ArtifactStudio trace layer.
- Add specialized tools: AIL606 storyboard/rubric/usability trace, CAT531 transcript/policy/equity decision map, CAT100 resume/spreadsheet/GitHub Pages evidence checker.
- Export before-after artifact state, rubric sub-scores, and revision-quality features.

### P0. Adaptive Reasoning Is Not Yet Closed Loop

ALGET has BKT-style learner modeling, social annotation, and ArtifactStudio support moves.
The A+ claim requires evidence that annotation type, quote overlap, learner model state,
confidence, practice behavior, and artifact traces actually change support selection.

Required repair:
- Persist recommendation decisions with candidate actions, selected action, rejected actions, evidence snapshot, and outcome.
- Add learner-facing and instructor-facing "why this support now" views.
- Show that support moves are selected from evidence, not only chosen by learners.

### P0. Empirical Evidence Is Still Prospective

The schema, protocol, item bank, model validation harness, and reproducibility smoke test
are stronger now. The missing piece is real learner data.

Required repair:
- Run at least one pilot with pre/post or retention data.
- Export event traces from annotation, practice, support, confidence, and artifact revision.
- Validate learner-model calibration on real data.
- Score artifact revisions with reliability or a defensible LLM-assisted rubric protocol.

### P1. Privacy And Deployment Controls Need Review

Artifact and annotation traces can include sensitive learner text. The current reporting
correctly favors metadata and lengths, but deployment needs trusted writes and export
controls.

Required repair:
- Complete RLS review for annotation, recommendation, and artifact trace tables.
- Use trusted backend writes for assignment, item responses, and canonical interaction events.
- Maintain anonymized exports and raw-text minimization for publication datasets.

## Recommended Path

1. Specialize ArtifactStudio into at least two signature tools per course.
2. Connect ArtifactStudio and annotation traces to recommendation decisions.
3. Add route-level browser smoke tests and ArtifactStudio interaction tests.
4. Run a small pilot before making learning-outcome or personalization claims.
5. Write the paper around one contribution: artifact-centered, annotation-informed adaptive support.

## Submission Readiness Rating

- Course deployment readiness: A-
- System demo readiness: A-
- Top-tier journal system-paper readiness: B+
- Top-tier empirical intelligent textbook paper readiness: B-, pending pilot data

Target after the next hardening pass:

- Course deployment readiness: A
- System demo readiness: A
- Top-tier journal system-paper readiness: A-
- Top-tier empirical paper readiness: A-/A, depending on pilot strength and reliability evidence

The next work should not add more sections. It should make ArtifactStudio adaptive,
scored, and empirically analyzable.
