# ALGET Existence Claim: Strict Analysis

Date: 2026-05-05

## Judgment

ALGET should not claim existence value as "another AI textbook" or "adaptive courseware."
Those categories are already occupied by strong systems.

The defensible existence claim is narrower and sharper:

> ALGET is an artifact-centered intelligent textbook that turns authentic course deliverables into observable learning evidence: learners annotate, make artifact claims, cite evidence, accept/reject AI or support suggestions, receive adaptive support, and generate a research-grade trace of judgment and revision.

This is the feature area most likely to make an instructor say, "I need this because my current textbook cannot do that."

## Comparator Reality

Existing systems already cover large parts of the generic intelligent-textbook space:

- zyBooks: web-native interaction, animations, learning questions, challenge activities, labs, and embedded coding tools.
- ALEKS: adaptive knowledge-gap diagnosis and personalized learning paths.
- Perusall: social annotation, engagement analytics, and scalable reading preparation.
- SmartBook / Alta: adaptive reading, objective-level remediation, and instructor analytics.

Therefore ALGET's differentiator cannot be:

- "It has quizzes."
- "It has AI explanations."
- "It has adaptive recommendations."
- "It has social annotations."
- "It has generated images."

Those are necessary but not sufficient.

## The Missing Textbook Function ALGET Can Own

Traditional course textbooks, static PDFs, LMS pages, and most intelligent textbooks do not deeply support this workflow:

1. Student works on a real course artifact.
2. Student identifies the claim the artifact is making.
3. Student cites a piece of evidence from data, annotation, transcript, rubric, or class context.
4. Student accepts one support/AI suggestion and explains why.
5. Student rejects or modifies one support/AI suggestion and explains why.
6. System scores trace completeness and artifact quality.
7. System uses annotation and artifact signals to select the next support move.
8. Instructor sees where the cohort's artifact judgment is weak.

This is ALGET's strongest existence feature.

## Current Evidence in the Codebase

| Capability | Current state | Strict judgment |
|---|---|---|
| 192 artifact-studio entry points | Present across AIL606, CAT531, CAT100 | Strong system-wide coverage |
| ArtifactStudio trace | Present: claim/evidence/accepted/rejected/transfer, confidence, rubric, support move | Strong prototype; needs before-after artifact state |
| Server validation | Present for diagnostic item responses and artifact traces | Strong research-readiness upgrade |
| Annotation-to-recommender loop | Present: annotation/artifact telemetry affects backend recommendation scoring | Important novelty upgrade |
| Perusall-like annotation | Present with local fallback and Supabase schema | Useful, but still not Perusall-competitive |
| Instructor analytics | RCT views and dashboards exist | Needs artifact/annotation cohort views |
| Empirical evidence | Synthetic/model validation and reproducibility smoke exist | No real outcome data yet |

## Existence Feature Candidates

### 1. Artifact Judgment Studio

This is the current strongest differentiator.

Core promise:

> The textbook does not only ask whether students understood the reading; it asks whether students can justify, revise, and defend a real artifact.

What it must include to feel indispensable:

- Before artifact state.
- AI/support suggestion.
- Accepted revision.
- Rejected revision.
- Evidence citation.
- Rubric score.
- After artifact state.
- Exportable revision trace.

Current status: partially implemented. Needs specialized artifact editors and semantic scoring.

### 2. Annotation-Informed Adaptive Support

Core promise:

> Student and peer annotations change what support the textbook gives next.

This is stronger than copying Perusall because Perusall mainly improves reading engagement and analytics; ALGET can make annotations operational inside adaptive support.

Current status: now implemented at telemetry/recommender level. Needs visible instructor/learner explanation and quote-overlap logic.

### 3. AI Suggestion Rejection as Learning Evidence

Core promise:

> The system rewards not just using AI, but knowing when to reject AI.

This is highly aligned with AIL606/CAT100/CAT531 because the courses are about AI literacy, instructional design, workplace artifacts, and judgment under constraints.

Current status: ArtifactStudio captures rejected support, but no semantic evaluation yet.

### 4. Cohort Artifact Misconception Map

Core promise:

> Instructor sees which artifact judgments are failing across the class: weak evidence, unsupported claim, overaccepted AI suggestion, unclear transfer constraint.

This would give ALGET a clear instructor-facing reason to exist beyond student-facing novelty.

Current status: not yet built.

## Strict Novelty Score

| Dimension | Score / 10 | Reason |
|---|---:|---|
| Clear reason to use over static textbook | 8 | Artifact-centered workflow is clearly beyond static text |
| Clear reason to use over LMS modules | 8 | Server-validated traces and adaptive support exceed LMS content delivery |
| Clear reason to use over Perusall | 6.5 | Annotation drives support, but threads/groups/scoring are weak |
| Clear reason to use over zyBooks | 6.5 | Artifact revision is distinctive; interaction density is lower |
| Clear reason to use over ALEKS/Alta/SmartBook | 6 | Artifact learning is distinctive; mastery adaptivity is less mature |
| Research novelty | 8 | Artifact-centered, annotation-informed adaptivity is a strong claim |
| Product polish | 6.5 | Needs specialized editors, browser QA, accessibility, and instructor views |

Overall existence-claim readiness: **7.1 / 10**.

Interpretation: ALGET has a real reason to exist, but that reason must be made more visible and operational. The system needs a flagship workflow that no ordinary course textbook can reproduce.

## The Required Flagship Feature

Build one flagship end-to-end workflow and make it impossible to miss:

### "Artifact Revision Lab"

Minimum viable A+ version:

1. Upload or paste a course artifact draft.
2. Select assignment/rubric type.
3. Highlight artifact claim.
4. Link evidence from reading annotation, dataset, transcript, or rubric.
5. Request AI/support critique.
6. Accept one suggestion.
7. Reject one suggestion.
8. Revise artifact.
9. System scores before-after improvement.
10. Instructor dashboard shows cohort-level artifact judgment gaps.

Recommended first courses:

- CAT100: resume / AI critique log / slide artifact.
- AIL606: instructional design rationale / AI-use policy / learning artifact critique.
- CAT531: spreadsheet chart / data story / dashboard claim.

## A+ Requirement

ALGET becomes defensibly A+ when reviewers can see this chain in one learner path:

> Annotation evidence -> Artifact claim -> AI/support critique -> Accept/reject judgment -> Revised artifact -> Server-validated trace -> Adaptive next support -> Instructor cohort insight.

If any link is only described but not visible in the interface, the claim remains prototype-level.

