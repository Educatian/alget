from __future__ import annotations

import csv
import json
import math
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
EXPORT_DIR = ROOT / "exports"
DERIVED_DIR = ROOT / "derived"
TRACE_PATH = EXPORT_DIR / "raw_artifact_revision_scores.csv"
RATING_PATH = EXPORT_DIR / "raw_human_ratings.csv"
EVAL_PATH = EXPORT_DIR / "raw_evaluation_runs.csv"
REPORT_PATH = ROOT / "real_validation_report.md"
DERIVED_DATASET_PATH = DERIVED_DIR / "real_artifact_validation_dataset.csv"

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

REQUIRED_TRACE_COLUMNS = [
    "id",
    "user_id",
    "course_id",
    "section_id",
    "overall_revision_quality",
    "submission_id",
    "artifact_definition_id",
    "artifact_family",
    "artifact_submission_spec_version",
    "artifact_required_files",
    "artifact_accepted_formats",
    "artifact_naming_pattern",
    "artifact_required_sections",
    "source_text_metrics",
    "raw_submission_privacy",
]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as file:
        return list(csv.DictReader(file))


def require_file(path: Path) -> None:
    if not path.exists():
        raise SystemExit(f"NO_REAL_DATA: missing required export {path}")
    if path.stat().st_size == 0:
        raise SystemExit(f"NO_REAL_DATA: empty required export {path}")


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


def rmse(errors: list[float]) -> float:
    return math.sqrt(mean([error * error for error in errors])) if errors else float("nan")


def weighted_kappa(rater_a: list[int], rater_b: list[int], categories: list[int]) -> float:
    n = len(rater_a)
    if n == 0 or n != len(rater_b):
        return float("nan")
    max_distance = max(categories) - min(categories)
    observed = mean([((a - b) / max_distance) ** 2 for a, b in zip(rater_a, rater_b)])
    count_a = Counter(rater_a)
    count_b = Counter(rater_b)
    expected = 0.0
    for a in categories:
        for b in categories:
            expected += (count_a[a] / n) * (count_b[b] / n) * (((a - b) / max_distance) ** 2)
    return 1 - (observed / expected) if expected else float("nan")


def icc_two_way_random_absolute_single(score_pairs: list[tuple[float, float]]) -> float:
    # ICC(2,1), two-way random effects, absolute agreement, single rater.
    n = len(score_pairs)
    k = 2
    if n < 2:
        return float("nan")
    grand = mean([score for pair in score_pairs for score in pair])
    row_means = [mean(list(pair)) for pair in score_pairs]
    col_means = [mean([pair[j] for pair in score_pairs]) for j in range(k)]
    ss_rows = k * sum((row_mean - grand) ** 2 for row_mean in row_means)
    ss_cols = n * sum((col_mean - grand) ** 2 for col_mean in col_means)
    ss_total = sum((score - grand) ** 2 for pair in score_pairs for score in pair)
    ss_error = ss_total - ss_rows - ss_cols
    ms_rows = ss_rows / (n - 1)
    ms_cols = ss_cols / (k - 1)
    ms_error = ss_error / ((n - 1) * (k - 1))
    denominator = ms_rows + (k - 1) * ms_error + (k * (ms_cols - ms_error) / n)
    return (ms_rows - ms_error) / denominator if denominator else float("nan")


def anonymizer(prefix: str):
    mapping: dict[str, str] = {}

    def anonymize(value: str) -> str:
        if value not in mapping:
            mapping[value] = f"{prefix}{len(mapping) + 1:03d}"
        return mapping[value]

    return anonymize


def parse_rating(row: dict[str, str]) -> dict[str, int]:
    if all(column in row and row[column] != "" for column in RUBRIC_COLUMNS):
        return {column: int(float(row[column])) for column in RUBRIC_COLUMNS}
    try:
        payload = json.loads(row.get("rating", "{}"))
    except json.JSONDecodeError as error:
        raise SystemExit(f"INVALID_REAL_DATA: rating JSON failed for target {row.get('target_id')}: {error}") from error
    missing = [column for column in RUBRIC_COLUMNS if column not in payload]
    if missing:
        raise SystemExit(f"INVALID_REAL_DATA: rating for target {row.get('target_id')} missing {missing}")
    return {column: int(float(payload[column])) for column in RUBRIC_COLUMNS}


def score_band(value: float) -> str:
    if value < 0.5:
        return "low_<0.50"
    if value < 0.75:
        return "mid_0.50-0.74"
    return "high_>=0.75"


def main() -> int:
    require_file(TRACE_PATH)
    require_file(RATING_PATH)
    traces = read_csv(TRACE_PATH)
    ratings = read_csv(RATING_PATH)
    if not traces:
        raise SystemExit("NO_REAL_DATA: raw_artifact_revision_scores.csv has no rows")
    if not ratings:
        raise SystemExit("NO_REAL_DATA: raw_human_ratings.csv has no rows")
    missing_trace_columns = [column for column in REQUIRED_TRACE_COLUMNS if column not in traces[0]]
    if missing_trace_columns:
        raise SystemExit(f"INVALID_REAL_DATA: raw artifact export missing columns {missing_trace_columns}")

    ratings_by_target: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in ratings:
        ratings_by_target[row["target_id"]].append({
            "rater_id": row["rater_id"],
            "scores": parse_rating(row),
        })

    anon_user = anonymizer("P")
    anon_rater = anonymizer("R")
    derived_rows = []
    kappa_inputs = {column: [[], []] for column in RUBRIC_COLUMNS}
    total_pairs = []
    system_scores = []
    human_scores = []

    for trace in traces:
        target_id = trace["id"]
        target_ratings = ratings_by_target.get(target_id, [])
        if len(target_ratings) < 2:
            continue
        first, second = target_ratings[0], target_ratings[1]
        first_scores = first["scores"]
        second_scores = second["scores"]
        first_total = sum(first_scores.values())
        second_total = sum(second_scores.values())
        human_mean = (first_total + second_total) / 2 / 16
        system_score = float(trace["overall_revision_quality"])
        total_pairs.append((first_total, second_total))
        system_scores.append(system_score)
        human_scores.append(human_mean)
        for column in RUBRIC_COLUMNS:
            kappa_inputs[column][0].append(first_scores[column])
            kappa_inputs[column][1].append(second_scores[column])
        derived_rows.append({
            "participant_id": anon_user(trace["user_id"]),
            "target_id": target_id,
            "submission_id": trace.get("submission_id", ""),
            "artifact_definition_id": trace.get("artifact_definition_id", ""),
            "artifact_family": trace.get("artifact_family", ""),
            "artifact_submission_spec_version": trace.get("artifact_submission_spec_version", ""),
            "artifact_naming_pattern": trace.get("artifact_naming_pattern", ""),
            "course_id": trace.get("course_id", ""),
            "section_id": trace.get("section_id", ""),
            "artifact_type": trace.get("artifact_type", ""),
            "studio_mode": trace.get("studio_mode", ""),
            "rater_1": anon_rater(first["rater_id"]),
            "rater_2": anon_rater(second["rater_id"]),
            "rater_1_total": first_total,
            "rater_2_total": second_total,
            "human_mean_quality": round(human_mean, 4),
            "system_revision_quality": round(system_score, 4),
            "system_minus_human": round(system_score - human_mean, 4),
            "score_band": score_band(human_mean),
            "raw_text_persisted": "false" if "false" in trace.get("raw_submission_privacy", "").lower() else "check_export",
        })

    if len(derived_rows) < 2:
        raise SystemExit("NO_REAL_DATA: need at least two artifact scores with two human ratings each")

    kappas = {
        column: weighted_kappa(kappa_inputs[column][0], kappa_inputs[column][1], [0, 1, 2])
        for column in RUBRIC_COLUMNS
    }
    errors = [system - human for system, human in zip(system_scores, human_scores)]
    abs_errors = [abs(error) for error in errors]
    bland_mean = mean(errors)
    bland_sd = sample_sd(errors)
    band_rows = []
    for band in ["low_<0.50", "mid_0.50-0.74", "high_>=0.75"]:
        rows = [row for row in derived_rows if row["score_band"] == band]
        if rows:
            band_rows.append((band, len(rows), mean([float(row["system_minus_human"]) for row in rows])))

    DERIVED_DIR.mkdir(exist_ok=True)
    with DERIVED_DATASET_PATH.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(derived_rows[0].keys()))
        writer.writeheader()
        writer.writerows(derived_rows)

    report = [
        "# ALGET Real Artifact Validation Report",
        "",
        "Status: **PASS_REAL_DATA**",
        "",
        "## Inputs",
        "",
        f"- Raw artifact revision rows: {len(traces)}",
        f"- Raw human rating rows: {len(ratings)}",
        f"- Scored artifacts with >=2 raters: {len(derived_rows)}",
        f"- Rows with submission IDs: {sum(1 for row in derived_rows if row['submission_id'])}",
        "",
        "## Inter-Rater Reliability",
        "",
        f"- ICC(2,1) on total scores: {icc_two_way_random_absolute_single(total_pairs):.3f}",
        f"- Mean absolute total-score difference: {mean([abs(a - b) for a, b in total_pairs]):.2f} out of 16",
        f"- Mean dimension weighted kappa: {mean(list(kappas.values())):.3f}",
        "",
        "| Dimension | Weighted kappa |",
        "| --- | ---: |",
    ]
    report.extend(f"| {column} | {value:.3f} |" for column, value in kappas.items())
    report.extend([
        "",
        "## System-Human Agreement",
        "",
        f"- Pearson r: {pearson(system_scores, human_scores):.3f}",
        f"- MAE: {mean(abs_errors):.3f}",
        f"- RMSE: {rmse(errors):.3f}",
        f"- Bland-Altman mean difference: {bland_mean:.3f}",
        f"- Bland-Altman limits of agreement: [{bland_mean - 1.96 * bland_sd:.3f}, {bland_mean + 1.96 * bland_sd:.3f}]",
        "",
        "| Human score band | n | Mean system-human difference |",
        "| --- | ---: | ---: |",
    ])
    report.extend(f"| {band} | {count} | {diff:.3f} |" for band, count, diff in band_rows)
    report.extend([
        "",
        "## Privacy",
        "",
        f"- Derived anonymized dataset: `{DERIVED_DATASET_PATH.relative_to(ROOT)}`",
        "- Raw text is not required by this analysis.",
        "",
    ])
    REPORT_PATH.write_text("\n".join(report), encoding="utf-8")
    print(f"PASS_REAL_DATA {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
