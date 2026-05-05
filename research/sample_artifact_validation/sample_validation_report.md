# ALGET Sample Artifact Validation Report

Status: **PASS** synthetic validation harness executed.

## Inputs

- Artifact trace rows: 12
- Instructor rating rows: 24
- Rubric scale: 8 dimensions, 0-2 each, total 0-16.

## Inter-Rater Reliability Smoke Check

- Mean absolute total-score difference between R1 and R2: 0.67 points out of 16.
- Mean quadratic weighted kappa across rubric dimensions: 0.775.

| Dimension | Weighted kappa |
| --- | ---: |
| claim_visibility | 1.000 |
| constraint_named | 0.917 |
| evidence_specificity | 0.875 |
| support_boundary | 0.543 |
| accepted_justified | 1.000 |
| rejected_justified | 0.909 |
| revision_visible | 0.556 |
| limitation_acknowledged | 0.400 |

## Scorer-Human Agreement Smoke Check

- Pearson correlation between ALGET system revision score and recomputed human mean score: 0.991.
- Mean system score: 0.662; mean human score: 0.635.

## Mini Outcome Signal

- Treatment mean gain: 0.253 (n=7).
- Comparison mean gain: 0.098 (n=5).
- Gain difference: 0.155.
- Cohen's d for gain difference: 5.213.
- Annotation count vs gain correlation: 0.836.

## Interpretation Boundary

This is synthetic data for validating the analysis path only. It is not evidence of effectiveness. The useful result is that the pilot package can compute IRR, scorer-human agreement, and preliminary outcome signals from the same artifact-centered data structure that ALGET already logs.
