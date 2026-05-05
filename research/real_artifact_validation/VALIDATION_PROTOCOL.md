# ALGET Real Artifact Validation Protocol

## Purpose

Validate whether ALGET's score-derived artifact revision metrics align with instructor judgment and whether artifact-centered adaptive support is associated with better work-product revision and assessment outcomes.

## Required Data

1. Artifact revision score export from `artifact_revision_scores`.
2. Human ratings export from `human_ratings` targeting artifact revision score IDs.
3. Optional pre/post/retention export from `evaluation_runs`.
4. Optional assignment export from `experiment_assignments`.

The artifact export must include `submission_id`, `artifact_definition_id`, `artifact_family`, `artifact_submission_spec_version`, `artifact_required_files`, `artifact_accepted_formats`, `artifact_naming_pattern`, `artifact_required_sections`, `source_text_metrics`, and `raw_submission_privacy` derived from the learner's Work Product Studio submission. Raw artifact text should be sent to the scorer endpoint for immediate scoring, but publication-facing persistence should keep only derived metrics, submission specification metadata, and scores.

## Primary Validation Questions

1. Can two independent raters reliably score artifact revision traces?
2. Does ALGET's system revision score align with mean human artifact-quality ratings?
3. Does alignment vary by course, studio mode, artifact type, or score band?
4. In randomized data only, does treatment assignment improve post-pre gain?

## Required Analyses

- Inter-rater reliability: mean absolute rater difference, dimension-level quadratic weighted kappa, total-score ICC.
- Scorer-human agreement: Pearson correlation, MAE, RMSE, score-band calibration, Bland-Altman mean difference and limits of agreement.
- Outcome analysis: treatment/comparison gain difference only when assignment data exist.

## Interpretation Rules

- No raw learner text is required for publication-facing analysis.
- Raw Work Product Studio text must not appear in `artifact_revision_scores`, `interaction_events` exports, or derived validation datasets.
- Do not treat synthetic data as evidence.
- Do not make causal claims without randomized assignment and attrition checks.
- If rater reliability is weak, revise the rubric before reporting system validity.
- If system-human agreement differs by course or artifact type, report subgroup limits rather than one global score.
