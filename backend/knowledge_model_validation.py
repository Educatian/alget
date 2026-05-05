from __future__ import annotations

import argparse
import csv
import json
import math
import random
from dataclasses import dataclass
from pathlib import Path
from statistics import mean

from knowledge_tracing import BayesianKnowledgeTracing


@dataclass
class SimulatedAttempt:
    learner_id: str
    concept_id: str
    t: int
    true_known: bool
    correct: bool
    telemetry: str


def brier_score(y_true: list[int], y_prob: list[float]) -> float:
    return mean([(truth - prob) ** 2 for truth, prob in zip(y_true, y_prob)])


def expected_calibration_error(y_true: list[int], y_prob: list[float], bins: int = 10) -> float:
    total = len(y_true)
    if total == 0:
        return 0.0
    ece = 0.0
    for i in range(bins):
        lo = i / bins
        hi = (i + 1) / bins
        idx = [j for j, p in enumerate(y_prob) if lo <= p < hi or (i == bins - 1 and p == 1.0)]
        if not idx:
            continue
        avg_conf = mean([y_prob[j] for j in idx])
        avg_acc = mean([y_true[j] for j in idx])
        ece += (len(idx) / total) * abs(avg_conf - avg_acc)
    return ece


def auc_score(y_true: list[int], y_prob: list[float]) -> float:
    positives = [(p, y) for p, y in zip(y_prob, y_true) if y == 1]
    negatives = [(p, y) for p, y in zip(y_prob, y_true) if y == 0]
    if not positives or not negatives:
        return 0.5
    wins = 0.0
    for pos, _ in positives:
        for neg, _ in negatives:
            if pos > neg:
                wins += 1
            elif pos == neg:
                wins += 0.5
    return wins / (len(positives) * len(negatives))


def simulate_attempts(seed: int = 42, learners: int = 96, concepts: int = 8, attempts_per_concept: int = 8) -> list[SimulatedAttempt]:
    rng = random.Random(seed)
    rows: list[SimulatedAttempt] = []
    telemetry_options = ["none", "hint_request", "chat_engagement", "simulation_play", "affect_confused", "affect_insight"]
    for learner in range(learners):
        ability = rng.gauss(0, 0.7)
        for concept in range(concepts):
            difficulty = rng.gauss(0, 0.45)
            known = rng.random() < 1 / (1 + math.exp(-(ability - difficulty)))
            for t in range(attempts_per_concept):
                if not known and rng.random() < 0.11 + max(0, ability) * 0.03:
                    known = True
                telemetry = rng.choices(telemetry_options, weights=[42, 14, 11, 12, 10, 11])[0]
                slip = 0.08 + (0.08 if telemetry == "affect_confused" else 0) - (0.03 if telemetry == "affect_insight" else 0)
                guess = 0.22
                correct = rng.random() < ((1 - slip) if known else guess)
                rows.append(SimulatedAttempt(f"L{learner:03d}", f"C{concept:02d}", t, known, correct, telemetry))
    return rows


def evaluate_rule_only(rows: list[SimulatedAttempt]) -> dict[str, float]:
    correct_counts: dict[tuple[str, str], int] = {}
    attempt_counts: dict[tuple[str, str], int] = {}
    y_true: list[int] = []
    y_prob: list[float] = []
    for row in rows:
        key = (row.learner_id, row.concept_id)
        prior = correct_counts.get(key, 0) / attempt_counts.get(key, 1) if attempt_counts.get(key, 0) else 0.5
        y_prob.append(max(0.05, min(0.95, prior)))
        y_true.append(1 if row.true_known else 0)
        attempt_counts[key] = attempt_counts.get(key, 0) + 1
        correct_counts[key] = correct_counts.get(key, 0) + (1 if row.correct else 0)
    return metrics("rule_only_accuracy", y_true, y_prob)


def evaluate_bkt(
    rows: list[SimulatedAttempt],
    telemetry_fusion: bool,
    *,
    label: str | None = None,
    p_known_initial: float = 0.1,
    p_guess: float = 0.2,
    p_slip: float = 0.1,
    p_transit: float = 0.1,
    telemetry_intensity: float = 1.0,
) -> dict[str, float]:
    model = BayesianKnowledgeTracing(
        p_guess_default=p_guess,
        p_slip_default=p_slip,
        p_transit_default=p_transit,
    )
    states: dict[tuple[str, str], tuple[float, float, float]] = {}
    y_true: list[int] = []
    y_prob: list[float] = []
    for row in rows:
        key = (row.learner_id, row.concept_id)
        known, slip, transit = states.get(key, (p_known_initial, model.p_slip_default, model.p_transit_default))
        y_prob.append(known)
        y_true.append(1 if row.true_known else 0)
        if telemetry_fusion and row.telemetry != "none":
            slip, transit = model.apply_telemetry_fusion(slip, transit, row.telemetry, telemetry_intensity)
        next_known = model.update_p_known(known, row.correct, p_guess=p_guess, p_slip=slip, p_transit=transit)
        states[key] = (next_known, slip, transit)
    model_label = label or ("telemetry_fused_bkt" if telemetry_fusion else "bkt_only")
    out = metrics(model_label, y_true, y_prob)
    out["config"] = {
        "p_known_initial": p_known_initial,
        "p_guess": p_guess,
        "p_slip": p_slip,
        "p_transit": p_transit,
        "telemetry_intensity": telemetry_intensity if telemetry_fusion else 0,
    }
    return out


def tune_bkt(rows: list[SimulatedAttempt], telemetry_fusion: bool) -> dict[str, float]:
    best: dict[str, float] | None = None
    for p_known_initial in [0.35, 0.5, 0.65]:
        for p_guess in [0.18, 0.25]:
            for p_slip in [0.06, 0.12]:
                for p_transit in [0.06, 0.14]:
                    for telemetry_intensity in ([0.35, 0.75] if telemetry_fusion else [0]):
                        candidate = evaluate_bkt(
                            rows,
                            telemetry_fusion=telemetry_fusion,
                            label="tuned_telemetry_fused_bkt" if telemetry_fusion else "tuned_bkt",
                            p_known_initial=p_known_initial,
                            p_guess=p_guess,
                            p_slip=p_slip,
                            p_transit=p_transit,
                            telemetry_intensity=telemetry_intensity,
                        )
                        if best is None:
                            best = candidate
                            continue
                        candidate_key = (candidate["brier"], candidate["ece"], -candidate["auc"])
                        best_key = (best["brier"], best["ece"], -best["auc"])
                        if candidate_key < best_key:
                            best = candidate
    if best is None:
        raise RuntimeError("No BKT candidates evaluated")
    return best


def metrics(model_name: str, y_true: list[int], y_prob: list[float]) -> dict[str, float]:
    return {
        "model": model_name,
        "n_predictions": len(y_true),
        "brier": round(brier_score(y_true, y_prob), 4),
        "ece": round(expected_calibration_error(y_true, y_prob), 4),
        "auc": round(auc_score(y_true, y_prob), 4),
        "mean_prob": round(mean(y_prob), 4),
        "mean_truth": round(mean(y_true), 4),
    }


def run(output_dir: Path, seed: int) -> list[dict[str, float]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    rows = simulate_attempts(seed=seed)
    results = [
        evaluate_rule_only(rows),
        evaluate_bkt(rows, telemetry_fusion=False),
        evaluate_bkt(rows, telemetry_fusion=True),
        tune_bkt(rows, telemetry_fusion=False),
        tune_bkt(rows, telemetry_fusion=True),
    ]
    with (output_dir / "synthetic_attempts.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["learner_id", "concept_id", "t", "true_known", "correct", "telemetry"])
        writer.writeheader()
        for row in rows:
            writer.writerow(row.__dict__)
    (output_dir / "learner_model_validation.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    with (output_dir / "learner_model_validation.md").open("w", encoding="utf-8") as f:
        f.write("# Learner Model Validation Smoke Test\n\n")
        f.write("Synthetic-data check for ALGET learner-model calibration and baseline comparison.\n\n")
        f.write("| Model | N | Brier | ECE | AUC | Mean predicted | Mean true |\n")
        f.write("| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n")
        for row in results:
            f.write(f"| {row['model']} | {row['n_predictions']} | {row['brier']} | {row['ece']} | {row['auc']} | {row['mean_prob']} | {row['mean_truth']} |\n")
        f.write("\n## Best Tuned Configuration\n\n")
        for row in results:
            if "config" in row:
                f.write(f"- `{row['model']}`: `{json.dumps(row['config'], sort_keys=True)}`\n")
        f.write("\nInterpretation: lower Brier/ECE and higher AUC indicate better learner-state tracking. This is not deployment evidence; it is a reproducible pipeline smoke test and calibration harness.\n")
    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", default="research/model_validation")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    results = run(Path(args.output_dir), args.seed)
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
