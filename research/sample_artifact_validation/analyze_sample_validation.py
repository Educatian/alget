from __future__ import annotations

import csv
import math
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
TRACE_PATH = ROOT / "synthetic_artifact_traces.csv"
RATING_PATH = ROOT / "instructor_ratings.csv"
REPORT_PATH = ROOT / "sample_validation_report.md"

RUBRIC_COLUMNS = [
    "claim_visibility",
    "constraint_named",
    "evidence_specificity",
    "support_boundary",
    "accepted_justified",
    "rejected_justified",
    "revision_visible",
    "limitation_acknowledged",
]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as file:
        return list(csv.DictReader(file))


def mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else float("nan")


def sample_sd(values: list[float]) -> float:
    if len(values) < 2:
        return float("nan")
    m = mean(values)
    return math.sqrt(sum((value - m) ** 2 for value in values) / (len(values) - 1))


def pearson(x: list[float], y: list[float]) -> float:
    if len(x) != len(y) or len(x) < 2:
        return float("nan")
    mx, my = mean(x), mean(y)
    sx = math.sqrt(sum((value - mx) ** 2 for value in x))
    sy = math.sqrt(sum((value - my) ** 2 for value in y))
    if sx == 0 or sy == 0:
        return float("nan")
    return sum((a - mx) * (b - my) for a, b in zip(x, y)) / (sx * sy)


def cohens_d(group_a: list[float], group_b: list[float]) -> float:
    if len(group_a) < 2 or len(group_b) < 2:
        return float("nan")
    pooled = math.sqrt(
        ((len(group_a) - 1) * sample_sd(group_a) ** 2 + (len(group_b) - 1) * sample_sd(group_b) ** 2)
        / (len(group_a) + len(group_b) - 2)
    )
    return (mean(group_a) - mean(group_b)) / pooled if pooled else float("nan")


def weighted_kappa(rater_a: list[int], rater_b: list[int], categories: list[int]) -> float:
    n = len(rater_a)
    if n == 0 or n != len(rater_b):
        return float("nan")

    max_distance = max(categories) - min(categories)
    if max_distance == 0:
        return float("nan")

    observed = 0.0
    for a, b in zip(rater_a, rater_b):
        observed += ((a - b) / max_distance) ** 2
    observed /= n

    count_a = Counter(rater_a)
    count_b = Counter(rater_b)
    expected = 0.0
    for a in categories:
        for b in categories:
            expected += (count_a[a] / n) * (count_b[b] / n) * (((a - b) / max_distance) ** 2)

    return 1 - (observed / expected) if expected else float("nan")


def main() -> int:
    traces = read_csv(TRACE_PATH)
    ratings = read_csv(RATING_PATH)

    ratings_by_participant: dict[str, dict[str, dict[str, int]]] = defaultdict(dict)
    for row in ratings:
        ratings_by_participant[row["participant_id"]][row["rater"]] = {
            column: int(row[column]) for column in RUBRIC_COLUMNS
        }

    human_scores = {}
    total_agreement_diffs = []
    kappas = {}
    for participant_id, by_rater in ratings_by_participant.items():
        r1 = by_rater["R1"]
        r2 = by_rater["R2"]
        r1_total = sum(r1.values())
        r2_total = sum(r2.values())
        human_scores[participant_id] = (r1_total + r2_total) / 2 / 16
        total_agreement_diffs.append(abs(r1_total - r2_total))

    for column in RUBRIC_COLUMNS:
        kappas[column] = weighted_kappa(
            [ratings_by_participant[row["participant_id"]]["R1"][column] for row in traces],
            [ratings_by_participant[row["participant_id"]]["R2"][column] for row in traces],
            [0, 1, 2],
        )

    for row in traces:
        row["gain"] = float(row["post_score"]) - float(row["pre_score"])
        row["system_revision_quality"] = float(row["system_revision_quality"])
        row["human_quality_recomputed"] = human_scores[row["participant_id"]]

    treatment = [row["gain"] for row in traces if row["arm"] == "treatment_annotation_adaptive"]
    comparison = [row["gain"] for row in traces if row["arm"] == "comparison_practice_only"]
    system_scores = [row["system_revision_quality"] for row in traces]
    human_recomputed = [row["human_quality_recomputed"] for row in traces]
    annotation_counts = [float(row["annotation_count"]) for row in traces]
    gains = [row["gain"] for row in traces]
    mean_kappa = mean(list(kappas.values()))
    scorer_human_r = pearson(system_scores, human_recomputed)

    required_raters = {rater for row in ratings for rater in [row["rater"]]}
    if len(traces) < 8:
        raise SystemExit("FAIL: expected at least 8 artifact trace rows")
    if required_raters != {"R1", "R2"}:
        raise SystemExit(f"FAIL: expected R1/R2 ratings, found {sorted(required_raters)}")
    if not math.isfinite(mean_kappa):
        raise SystemExit("FAIL: weighted kappa did not compute")
    if not math.isfinite(scorer_human_r):
        raise SystemExit("FAIL: scorer-human correlation did not compute")

    report_lines = [
        "# ALGET Sample Artifact Validation Report",
        "",
        "Status: **PASS** synthetic validation harness executed.",
        "",
        "## Inputs",
        "",
        f"- Artifact trace rows: {len(traces)}",
        f"- Instructor rating rows: {len(ratings)}",
        "- Rubric scale: 8 dimensions, 0-2 each, total 0-16.",
        "",
        "## Inter-Rater Reliability Smoke Check",
        "",
        f"- Mean absolute total-score difference between R1 and R2: {mean(total_agreement_diffs):.2f} points out of 16.",
        f"- Mean quadratic weighted kappa across rubric dimensions: {mean_kappa:.3f}.",
        "",
        "| Dimension | Weighted kappa |",
        "| --- | ---: |",
    ]
    report_lines.extend(f"| {column} | {value:.3f} |" for column, value in kappas.items())

    report_lines.extend([
        "",
        "## Scorer-Human Agreement Smoke Check",
        "",
        f"- Pearson correlation between ALGET system revision score and recomputed human mean score: {scorer_human_r:.3f}.",
        f"- Mean system score: {mean(system_scores):.3f}; mean human score: {mean(human_recomputed):.3f}.",
        "",
        "## Mini Outcome Signal",
        "",
        f"- Treatment mean gain: {mean(treatment):.3f} (n={len(treatment)}).",
        f"- Comparison mean gain: {mean(comparison):.3f} (n={len(comparison)}).",
        f"- Gain difference: {mean(treatment) - mean(comparison):.3f}.",
        f"- Cohen's d for gain difference: {cohens_d(treatment, comparison):.3f}.",
        f"- Annotation count vs gain correlation: {pearson(annotation_counts, gains):.3f}.",
        "",
        "## Interpretation Boundary",
        "",
        "This is synthetic data for validating the analysis path only. It is not evidence of effectiveness. The useful result is that the pilot package can compute IRR, scorer-human agreement, and preliminary outcome signals from the same artifact-centered data structure that ALGET already logs.",
        "",
    ])

    REPORT_PATH.write_text("\n".join(report_lines), encoding="utf-8")
    print(f"PASS {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
