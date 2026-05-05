# ALGET Analysis Plan

## Primary Estimand and Model

Primary estimand: intention-to-treat effect of assignment to `treatment_annotation_adaptive`
versus `comparison_practice_only` on learner-level post-pre gain within course blocks.

Outcome: `post_pre_gain`.

Primary pre-treatment predictors:
- `arm`
- `course_id`
- `pre_score`

Recommended model:

```text
post_pre_gain ~ arm + course_id + pre_score
```

Use HC3 robust standard errors by default. If there are repeated observations per learner
or multiple course enrollments per learner, use a learner random intercept or cluster-robust
standard errors by `user_id`. Do not include post-treatment variables in the primary
total-effect model.

Mediation/explanatory models may include post-treatment signals such as:

- `annotation_count`
- `support_acceptance_rate`
- `practice_accuracy`
- artifact revision quality

Report those as mechanism analyses, not as the primary causal effect.

## Assignment Reproducibility

The randomized study path uses a deterministic, course-blocked assignment hash:

```text
assignment_hash = sha256(experiment_key || user_id || course_id || stratum_key || assignment_seed)
arm = hash percentile < allocation_ratio
```

Each assignment must persist `course_id`, `stratum_key`, `assignment_seed`,
`assignment_hash`, `allocation_ratio`, and `assignment_version` before outcome data are
observed. If the deployment cannot enforce server-side assignment, report the study as
quasi-experimental only.

## Missing Data, Compliance, and Power

- Primary analysis uses all assigned learners with available pre and post scores.
- Attrition is reported by arm and course; differential attrition above 5 percentage
  points triggers sensitivity analyses.
- Compliance is descriptive unless assignment noncompliance is explicitly modeled.
- Minimum reporting target: N per arm/course block, observed MDE, confidence intervals,
  and missingness table by phase.

## Calibration Analysis

Use `backend/knowledge_model_validation.py` for smoke-test calibration, then rerun the same metrics on real event exports:

- Brier score
- Expected calibration error
- AUC
- Mean predicted mastery vs observed correctness

Compare:

- rule-only accuracy baseline
- BKT-only
- tuned BKT
- telemetry-fused BKT
- tuned telemetry-fused BKT

## Annotation Analysis

Use `section_annotations`, `annotation_reactions`, and `annotation_network_edges`.

Key predictors:

- annotation type
- quote hash overlap
- helpful reactions
- replies
- time from page view to annotation

Key outcomes:

- support acceptance
- artifact revision quality
- post-pre gain

## Artifact Revision Quality

Score each artifact trace on 0-2 scales:

- claim visible
- constraint named
- evidence source specific
- support move bounded
- accepted suggestion justified
- rejected suggestion justified
- revision visible
- limitation acknowledged

Total score: 0-16.

## Reporting

Do not report causal claims unless assignment is randomized and compliance is modeled. For quasi-experimental runs, use "associated with" and report sensitivity checks.
