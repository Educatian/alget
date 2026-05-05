# Real Export Input Schema

## `raw_artifact_revision_scores.csv`

Required columns:

- `id`
- `user_id`
- `course_id`
- `section_id`
- `artifact_type`
- `studio_mode`
- `trace_score`
- `trace_denominator`
- `claim_clarity`
- `evidence_alignment`
- `revision_depth`
- `judgment_quality`
- `transfer_readiness`
- `specificity_delta`
- `overall_revision_quality`
- `submission_id`
- `artifact_definition_id`
- `artifact_family`
- `artifact_submission_spec_version`
- `artifact_required_files`
- `artifact_accepted_formats`
- `artifact_naming_pattern`
- `artifact_required_sections`
- `source_text_metrics`
- `raw_submission_privacy`
- `created_at`

## `raw_human_ratings.csv`

Required columns:

- `target_id`
- `rater_id`
- `rating`

`rating` must be JSON with the eight rubric keys from `RUBRIC_CODEBOOK.md`, or the CSV must include those eight keys as direct columns.

## Optional `raw_evaluation_runs.csv`

Required for outcome analysis:

- `user_id`
- `course_id`
- `phase`
- `score_pct`

Use `phase = pre` and `phase = post` for post-pre gain.
