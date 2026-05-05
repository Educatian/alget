# ALGET Intelligent Textbook Benchmark Audit

Date: 2026-05-05

## Verdict

ALGET now has a credible intelligent-textbook novelty direction because the new
ArtifactStudio interface moves the system beyond reading-plus-quiz courseware. The
current interface lets learners make an artifact claim, cite an evidence source, record
an accepted AI/support suggestion, record a rejected or modified suggestion, choose a
support move, set confidence, and log the trace as `artifact_studio_trace`.

That is a meaningful prototype-level advance. It is still not a final A+ intelligent
textbook contribution because the interface is generic, the adaptive reasoning is not yet
visibly driven by annotation/artifact signals, and no real pilot data validate learning,
calibration, or artifact-revision quality.

The strongest novelty candidate is not "adaptive textbook" alone. Existing systems already
cover that territory. ALGET's sharper claim should be:

> An artifact-centered intelligent textbook that connects social annotation, adaptive
> support, AI-generated exemplars, and traceable learner judgment to authentic course
> deliverables in AIL606, CAT531, and CAT100.

The novel part is not "AI textbook" or "adaptive textbook." It is the attempt to make
students' judgment around authentic artifacts observable: what claim they make, what
evidence they use, what AI/support advice they accept, what they reject, how confident
they are, and which support move is active. The next evidence burden is proving that
those traces actually change support selection and artifact quality.

## New ArtifactStudio Evidence

| Evidence anchor | Current status | Research implication |
|---|---|---|
| `frontend/src/components/ArtifactStudio.jsx` | Implements a learner-facing Artifact Studio with claim, evidence, accepted suggestion, rejected/modified suggestion, support move, confidence, and log-trace controls | ALGET can now collect artifact-reasoning traces instead of only page views, quiz answers, and annotations |
| `artifact_studio_trace` event | `logEvent()` records course, section, artifact, support move, trace score, confidence, and field-length metadata | This is a usable first research signal for trace completeness and support uptake, but not yet a full artifact-quality score |
| 192 `<artifact-studio>` blocks | Every Summer 2026 supplement section includes a concrete artifact-studio entry point | The artifact claim is system-wide across AIL606, CAT531, and CAT100 rather than a one-off demo |
| 192 artifact packets and 192 deep exemplar PNGs | QA gate reports all artifact packets above depth threshold and all deep exemplar links present | Learners have course-specific artifact prompts and visual anchors, reducing the earlier template-only criticism |
| Support moves: explain / compare / audit | The UI exposes three bounded support modes | This supports a publishable "support move" construct only after the recommender explains why one move was selected |

Important limitation: the present trace stores metadata and lengths, not the full claim,
evidence, accepted/rejected text, rubric score, or a before-after artifact diff. That is
good for privacy-aware telemetry but insufficient by itself for artifact-quality analysis.

## Comparator Baseline

| Comparator | Established strength | Evidence basis | ALGET implication |
|---|---|---|---|
| zyBooks | Web-native short text, animations, learning questions, embedded interaction | zyBooks reports RCT and cross-course evidence; product research emphasizes less text plus many activities | ALGET must beat "static MDX plus quiz" with genuinely interactive artifact work |
| ALEKS | Knowledge-space diagnosis, readiness-to-learn sequencing, mastery map | ALEKS is grounded in Knowledge Space Theory and large-scale adaptive assessment | ALGET's learner model must show calibrated mastery and actionable recommendations, not synthetic-only validation |
| Knewton Alta | Objective-level adaptive path, answer explanations, just-in-time remediation, analytics | Wiley describes mastery-based personalization, dynamic remediation, and instructor analytics | ALGET needs visible adaptive pathways and instructor-facing evidence of why support was shown |
| McGraw Hill SmartBook | Adaptive reading cycles, metacognition, spacing/chunking/interleaving | SmartBook describes mini-cycles and repeated concepts until mastery | ALGET needs retention/revisit logic and metacognitive prompts tied to artifact revisions |
| Perusall | Social annotation around readings, questions, replies, engagement analytics | Perusall/BJET evidence links pre-class social annotation to post-class assessment performance | ALGET's Perusall-style layer must become annotation-informed adaptive support, not just a comment panel |
| Inquire Biology | Textbook question-answering over a knowledge representation | AI Magazine article frames an intelligent textbook that answers student questions using explicit knowledge representation | ALGET needs a transparent knowledge graph / evidence trail behind generated responses |

## ALGET Novelty Scorecard

Scale: 0 = absent, 1 = scaffold only, 2 = working but ordinary, 3 = strong, 4 = publishable differentiator.

| Dimension | Score | Current judgment |
|---|---:|---|
| Web-native interaction beyond reading | 3 | Practice blocks, dynamic scenarios, image assets, artifact packets, and an embedded ArtifactStudio trace UI now exist |
| Adaptive learner modeling | 2 | BKT validation exists; tuned BKT performs well synthetically, but real telemetry and holdout validation are missing |
| Annotation-informed intelligence | 2 | Perusall-style UI exists and logs events, but support selection is not yet visibly driven by annotation type/quote overlap |
| Authentic artifact-centered learning | 3 | Each supplement section now has an artifact studio entry point, deeper packet, rubric, trace protocol, and course-specific artifact framing |
| Instructor/research analytics | 3 | RCT views, model validation, deterministic assignment, and analysis plans exist; item-level app wiring and RLS hardening remain |
| Explainability and audit trail | 3 | ArtifactStudio captures trace metadata for claim/evidence/accepted/rejected fields, confidence, and support move; full "why this support now" still needs learner/instructor analytics |
| Social learning quality | 2 | Annotation/reaction/reply schema exists, but UI currently lacks grouping, reply threads, scoring/rubric, and annotation taxonomy |
| Visual learning assets | 3 | 192 deep exemplar PNGs plus 4 imagegen2 anchor assets exist; manifest/link integrity now checks cleanly |
| Accessibility/deployment maturity | 2 | Build/test pass; no full WCAG audit, keyboard/screen-reader pass, or route smoke suite yet |
| Empirical novelty claim | 2 | Research package and 36-item bank are stronger, but no real pilot/RCT data yet |

Overall novelty readiness: **27 / 40**.

Interpretation:

- 30+ would support a strong demo paper / design-based research submission.
- 34+ plus pilot evidence would support a serious intelligent textbook journal submission.
- Current state is "strong research prototype with system-wide ArtifactStudio instrumentation," not final A+.

## Claims ALGET Can Defend Now

1. ALGET has broader course coverage than a typical single-topic prototype: AIL606, CAT531,
   and CAT100 supplements are present with 192 sections.
2. ALGET integrates reading, practice, misconception sidecars, annotation, adaptive-support
   traces, image assets, and reproducibility scripts in one local system.
3. ALGET has a clearer research-instrumentation ambition than many courseware prototypes:
   experiment arms, RCT views, learner model validation, and reproducibility smoke checks exist.
4. ALGET now has a defensible artifact-centered interaction primitive: each supplement
   section asks learners to externalize a claim, evidence source, accepted support, rejected
   support, support move, and confidence rating.

## Claims ALGET Cannot Defend Yet

1. It cannot yet claim superior learning outcomes over existing intelligent textbooks.
2. It cannot yet claim robust adaptive personalization comparable to ALEKS/Alta/SmartBook.
3. It cannot yet claim Perusall-level social learning quality because annotation taxonomy,
   reply workflows, scoring, and group dynamics are incomplete.
4. It cannot yet claim zyBooks-level interaction density because the next step is dense
   "say-show-ask-revise" tooling, not only richer artifact packets.
5. It cannot yet claim journal-grade empirical reproducibility because assignment,
   item-level assessment persistence, event stream consistency, and RLS controls need work.
6. It cannot yet claim artifact-quality improvement because ArtifactStudio currently logs
   trace completeness metadata rather than scored before-after artifact revisions.

## Required Upgrades for Defensible Novelty

1. **ArtifactStudio specialization**
   - Keep the generic ArtifactStudio as the common trace layer.
   - Add domain-specific artifact tools on top: storyboard editor, rubric scorer,
     annotation map, transcript critique, resume evidence checker, spreadsheet task,
     policy memo checker, and revision log.
   - Each course needs at least 2 signature interactive artifact tools with a before-after
     artifact state, rubric score, and exportable trace.

2. **Visible adaptive reasoning**
   - Add a learner-facing "why this support" panel.
   - Add instructor-facing traces: misconception, evidence source, confidence, selected action,
     rejected actions, and next best activity.
   - Connect ArtifactStudio support moves to recommendation decisions rather than allowing
     them to remain learner-selected labels only.

3. **Annotation intelligence beyond Perusall clone**
   - Classify annotations into question/confusion/insight/connection/evidence/critique.
   - Use quote-hash overlap and annotation type to alter prompts, examples, and practice.
   - Add threaded replies and group-level misconception heatmaps.

4. **zyBooks-level interaction density**
   - Convert each section from template narrative into compact text plus interaction cycles:
     predict, reveal, critique, revise, compare, and transfer.
   - Gate this with an automated density metric: interactive blocks per 1,000 words.

5. **Research-grade empirical pipeline**
   - Server-side deterministic assignment.
   - Item-level pre/post/retention persistence.
   - Canonical event stream.
   - Anonymized export views.
   - Minimum 12 validated items per course with balanced answer positions.

## Remaining A+ Risks

| Risk | Why it matters | Evidence needed to clear it |
|---|---|---|
| ArtifactStudio is generic | Reviewers may read it as a structured reflection form rather than a novel intelligent textbook interaction | At least 2 specialized artifact tools per course with visible before-after artifact states |
| Trace data are metadata-heavy | Lengths and trace scores support completeness analysis but not artifact-quality claims | Rubric-scored artifact revisions, reliability evidence, and optional consented qualitative exemplars |
| Adaptive support is not yet closed-loop | The UI exposes support moves, but the system must prove support is selected from learner state, annotations, and artifact traces | Recommendation logs showing candidate actions, selected action, rejected actions, evidence snapshot, and outcome |
| Social annotation may remain parallel | Perusall comparison is weak unless annotation type and quote overlap alter support or practice | Annotation taxonomy, quote-hash overlap models, threaded replies, and group misconception heatmaps |
| Empirical claim is still prospective | A+ venue claims require outcome evidence, not just system readiness | Pilot/RCT data with pre/post/retention, calibration, support uptake, and artifact revision outcomes |
| Privacy/RLS risks could block deployment | Artifact and annotation traces can include sensitive learner text | Trusted backend writes, RLS review, anonymized exports, and raw-text minimization policy |

## Source Anchors

- zyBooks research overview: https://www.zybooks.com/research/
- zyBooks interactive textbook study: https://www.zybooks.com/research-items/student-performance-improvement-using-interactive-textbooks-a-threeuniversity-cross-semester-analysis/
- Perusall social learning platform: https://www.perusall.com/
- Cui & Wang BJET/Perusall study summary: https://www.perusall.com/blog/empowering-active-learning-reseach-perusall
- ALEKS Knowledge Space Theory: https://www.aleks.com/about_aleks/knowledge_space_theory
- ALEKS overview: https://www.aleks.com/about_aleks/
- Knewton Alta features: https://www.wiley.com/education/alta/features
- SmartBook adaptive reading description: https://www.mheducation.com/highered/digital-products/connect/student-tools/smartbook.html
- Inquire Biology article record: https://www.researchgate.net/publication/284902049_Inquire_Biology_A_Textbook_that_Answers_Questions
