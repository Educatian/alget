---
title: "ALGET Summer 2026 Intelligent Textbook Study Protocol"
date: 2026-05-05
status: draft
---

# ALGET Summer 2026 Intelligent Textbook Study Protocol

![ALGET intelligent textbook research model](/course-art/imagegen2/alget-intelligent-textbook-research-hero.png)

## Study Claim

ALGET is a socially-aware generative intelligent textbook that connects artifact-specific course content, social annotation, adaptive learner modeling, and research-grade telemetry. The target contribution is not merely that the textbook contains AI-generated materials. The contribution is that ALGET turns learners' reading annotations, artifact revisions, practice attempts, confidence, and support uptake into interpretable signals for adaptive support.

## Research Questions

1. Does annotation-informed adaptive support improve learning gains compared with practice-only support?
2. Does annotation-informed support improve calibration between confidence and demonstrated performance?
3. Do learners in the annotation-informed arm produce higher-quality artifact revision traces?
4. Which signals best predict productive support uptake: annotation type, quote overlap, practice correctness, confidence, affect, or prior mastery?

## Design

Quasi-experimental or randomized course-embedded study across AIL606, CAT531, and CAT100 Summer 2026 supplement pathways.

| Arm | Description |
| --- | --- |
| comparison_practice_only | Learners receive practice, misconception feedback, and conventional section support. Annotation is available but not used for support selection. |
| treatment_annotation_adaptive | Learners receive support selected from annotation type, quote hash overlap, support request, confidence, practice, and revision-quality signals. |

## Participants

Students enrolled in Summer 2026 AIL606, CAT531, and CAT100. Course-level analyses must treat course as a blocking factor because the three courses differ in level, task type, and prior knowledge.

## Intervention Unit

The primary intervention unit is a section-level support recommendation. Each recommendation is logged as a `recommendation_decisions` row and linked to an `intervention_traces` lifecycle record.

## Measures

- Pre/post/retention assessment score.
- Concept-level learner-state calibration.
- Annotation type, quote hash overlap, reply/reaction count, and annotation timing.
- Practice correctness and misconception labels.
- Artifact revision trace quality.
- Support uptake and immediate/retention reward.

## Primary Outcomes

1. Post-pre learning gain.
2. Calibration error.
3. Artifact revision trace score.
4. Support uptake and immediate reward.

## Analysis Overview

- Mixed-effects model for learning gain: fixed effects for arm, course, prior score; random intercept for learner.
- Calibration metrics: Brier score, ECE, AUC for learner-model predictions.
- Artifact trace scoring: rubric-based human or validated LLM-assisted rating.
- Mediation/exploration: whether annotation quality predicts support uptake and revision quality.

## Privacy and Ethics

No raw private email or outside-course sensitive data enters the ALGET research layer. Annotation quote text is stored with a quote hash so overlap can be modeled; exports for publication should replace user identifiers with participant IDs.

## Minimum Evidence for Submission

- Working schema and reproducible seed.
- Completed synthetic-data smoke test.
- At least one course pilot with pre/post data.
- Event-level trace export.
- Model calibration report.
- Artifact revision trace rubric and reliability evidence.
