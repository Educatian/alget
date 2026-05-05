# ALGET Real Artifact Validation Status

Status checked: 2026-05-05

## Result

`analyze_real_validation.py` was executed and correctly stopped with:

```text
NO_REAL_DATA: missing required export research/real_artifact_validation/exports/raw_artifact_revision_scores.csv
```

This is the correct behavior. The real-data analyzer must not pass on synthetic, empty, or fabricated records.

## Raw Submission Lineage Check

Work Product Studio now emits a `submission_id` for each artifact submission. The scoring request still sends raw draft/revision fields to the server scorer, but persistence/export is restricted to derived lineage and telemetry:

- `submission_id`
- `source_text_metrics`
- `raw_submission_privacy`
- field length counts
- rubric values
- validator outputs
- score-derived artifact revision metrics

The frontend unit test verifies that raw draft/revision text reaches the scorer request but does not appear in the research log payload.

## Required Next Inputs

Export these from the ALGET Supabase research database using `real_data_export.sql`:

1. `raw_artifact_revision_scores.csv`
2. `raw_human_ratings.csv`
3. Optional: `raw_evaluation_runs.csv`
4. Optional: `raw_experiment_assignments.csv`

## What Will Be Produced After Real Data Exists

- `real_validation_report.md`
- `derived/real_artifact_validation_dataset.csv`

The derived dataset anonymizes learner and rater IDs and excludes raw learner text.
