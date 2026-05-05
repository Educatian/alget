# ALGET Real Artifact Validation Package

This package is for real ALGET pilot/export data only. It does not generate synthetic rows and it should not be used with fabricated learner outcomes.

## Required raw exports

Place raw CSV exports in:

```text
research/real_artifact_validation/exports/
```

Required:

- `raw_artifact_revision_scores.csv`
- `raw_human_ratings.csv`

Optional for outcome analyses:

- `raw_evaluation_runs.csv`
- `raw_experiment_assignments.csv`

## Run

```powershell
python research\real_artifact_validation\analyze_real_validation.py
```

If the raw exports are absent, the script exits with `NO_REAL_DATA`. That is intentional.

## Output

- `real_validation_report.md`
- `derived/real_artifact_validation_dataset.csv`

Privacy rule: publication-facing derived exports anonymize `user_id` and `rater_id`; raw exports stay in `exports/` and should not be committed if they contain identifiable records.

