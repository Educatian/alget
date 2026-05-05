# ALGET Synthetic Sample Artifact Validation Harness

Status: **DEPRECATED FOR EVIDENCE CLAIMS**.

This folder is retained only as a code-path rehearsal. It is not real learner data and should not be cited as empirical evidence. For any A+ journal-facing analysis, use `research/real_artifact_validation/`.

This folder is a synthetic pilot rehearsal for checking whether analysis code can run before real exports exist.

Files:

- `learner_artifact_samples.md`: four readable sample artifacts.
- `synthetic_artifact_traces.csv`: participant-level pre/post, condition, annotation, support, system score, and human score fields.
- `instructor_ratings.csv`: two-rater 0-2 ratings on the 8-dimension artifact-quality rubric.
- `analyze_sample_validation.py`: stdlib-only analysis script for IRR, scorer-human agreement, and mini outcome signal.
- `sample_validation_report.md`: generated report after running the script.

Run:

```powershell
python research\sample_artifact_validation\analyze_sample_validation.py
```

Boundary: synthetic data only. Use this to test code mechanics, not validity or effectiveness.
