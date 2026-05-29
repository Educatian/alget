// ---------------------------------------------------------------------------
// PURE adaptive support-selection policy.
//
// This is a faithful 1:1 TypeScript port of the pure core in
// backend/knowledge_tracing.py (SUPPORT_ACTIONS, REASON_CODE_FEATURES,
// ANNOTATION_REASON_CODES, ANNOTATION_FEATURES, _clamp, _feature,
// score_support_actions, derive_reason_codes, reason_codes_are_faithful,
// select_support_move).
//
// The Python module is the SOURCE OF TRUTH. Any change there must be mirrored
// here and re-verified by the parity test in ./parity/. Thresholds, rounding,
// tie-breaking order, and the annotation_adaptive ablation behavior are
// reproduced exactly so that, given identical inputs, this returns identical
// selected_action, rejected_actions, reason_codes, and evidence_snapshot.
// ---------------------------------------------------------------------------

export type FeatureVector = Record<string, unknown>;

export interface SupportDecision {
  policy_mode: string;
  candidate_actions: string[];
  action_scores: Record<string, number>;
  selected_action: string;
  rejected_actions: string[];
  reason_codes: string[];
  evidence_snapshot: Record<string, unknown>;
}

export const SUPPORT_ACTIONS: readonly string[] = [
  "explain",
  "represent",
  "practice",
  "advance",
  "ask",
];

// Which features are allowed to be cited by which reason_code. The faithfulness
// self-check requires that a reason_code only fires when at least one of its
// backing features is present in the evidence snapshot.
export const REASON_CODE_FEATURES: Record<string, readonly string[]> = {
  unit_mismatch: ["unit_signal"],
  idle_reengagement: ["idle_signal"],
  low_mastery: ["mastery_gap", "average_mastery"],
  high_friction: ["friction_signal", "frustration_index"],
  retrieval_risk: ["forgetting_risk"],
  calibration_gap: ["calibration_drift"],
  misconception_pattern: ["misconception_pressure"],
  annotation_friction: ["annotation_friction", "annotation_section_overlap"],
  annotation_section_focus: ["annotation_section_overlap"],
  artifact_quality_gap: ["artifact_gap", "artifact_quality"],
  artifact_revision_regression: ["artifact_revision_delta"],
  artifact_annotation_momentum: ["annotation_momentum", "artifact_quality"],
  transfer_ready: ["transfer_readiness"],
  balanced_profile: ["average_mastery", "friction_signal", "transfer_readiness"],
};

export const ANNOTATION_REASON_CODES: readonly string[] = [
  "annotation_friction",
  "annotation_section_focus",
  "artifact_annotation_momentum",
];

// Features sourced from the social-annotation family. When the annotation
// ablation flag is OFF these are zeroed out of the policy so the RQ4
// comparison can show that annotation evidence changes which support fires.
export const ANNOTATION_FEATURES: readonly string[] = [
  "annotation_friction",
  "annotation_momentum",
  "annotation_section_overlap",
];

function _clamp(value: number, minimum = 0.0, maximum = 1.0): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function _feature(features: FeatureVector, key: string, fallback = 0.0): number {
  const raw = Object.prototype.hasOwnProperty.call(features, key)
    ? features[key]
    : fallback;
  // Mirror Python float(): None / non-numeric -> fallback.
  if (raw === null || raw === undefined) {
    return fallback;
  }
  const num = typeof raw === "boolean" ? (raw ? 1 : 0) : Number(raw);
  if (Number.isNaN(num)) {
    return fallback;
  }
  return num;
}

// Faithful reproduction of CPython's round(x, n).
//
// CPython rounds the EXACT value of the binary double to n decimal places using
// round-half-to-EVEN, where "half" means the true binary value is exactly
// halfway. A naive `value * 1000` introduces extra error, and a fixed-epsilon
// half-test misclassifies dust (e.g. 0.14250000000000002 is NOT a half and must
// round UP to 0.143, while exactly 0.6545 IS a half and rounds to 0.654).
//
// We operate on the shortest round-trip decimal string of the double (JS
// String() yields the same shortest repr as Python's repr), then round that
// decimal string half-to-even. This matches CPython for the value ranges the
// policy produces.
function _roundPy(value: number, digits = 0): number {
  if (!Number.isFinite(value)) return value;
  const neg = value < 0;
  // Use a HIGH-PRECISION fixed expansion (not the shortest round-trip repr) so
  // sub-ULP information survives: e.g. 0.6045 -> 0.60450000...37 (rounds up) but
  // 0.2095 -> 0.20949999...91 (rounds down). The shortest string "0.6045" would
  // wrongly look like an exact half. toFixed(20) preserves enough digits.
  const s = Math.abs(value).toFixed(20);

  const [intPart, fracPart = ""] = s.split(".");
  if (fracPart.length <= digits) {
    return Object.is(value, -0) ? 0 : value; // already short enough
  }

  const keep = fracPart.slice(0, digits);
  const rest = fracPart.slice(digits);
  // Build the integer formed by intPart + keep (the value scaled by 10^digits).
  let scaledDigits = (intPart + keep).replace(/^0+(?=\d)/, "");

  const firstDropped = rest[0];
  const remainder = rest.slice(1).replace(/0+$/, "");
  let roundUp = false;
  if (firstDropped > "5") {
    roundUp = true;
  } else if (firstDropped < "5") {
    roundUp = false;
  } else {
    // Exactly "5..."; if anything nonzero follows it's > half -> up,
    // otherwise it's an exact half -> round to even.
    if (remainder.length > 0) {
      roundUp = true;
    } else {
      const lastKept = scaledDigits.length > 0
        ? scaledDigits[scaledDigits.length - 1]
        : "0";
      roundUp = (Number(lastKept) % 2) === 1;
    }
  }

  let scaledInt = BigInt(scaledDigits || "0");
  if (roundUp) scaledInt += 1n;

  const result = Number(scaledInt) / Math.pow(10, digits);
  const signed = neg ? -result : result;
  return Object.is(signed, -0) ? 0 : signed;
}

export function score_support_actions(
  features: FeatureVector,
): Record<string, number> {
  const mastery_gap = _feature(features, "mastery_gap");
  const average_mastery = _feature(features, "average_mastery");
  const friction_signal = _feature(features, "friction_signal");
  const accuracy_gap = _feature(features, "accuracy_gap");
  const uncertainty_signal = _feature(features, "uncertainty_signal");
  const correct_ratio = _feature(features, "correct_ratio");
  const forgetting_risk = _feature(features, "forgetting_risk");
  const calibration_drift = _feature(features, "calibration_drift");
  const transfer_readiness = _feature(features, "transfer_readiness");
  const stability_index = _feature(features, "stability_index");
  const predicted_next_correct = _feature(features, "predicted_next_correct");
  const predicted_retention = _feature(features, "predicted_retention");
  const misconception_pressure = _feature(features, "misconception_pressure");
  const engagement_signal = _feature(features, "engagement_signal");
  const support_fatigue = _feature(features, "support_fatigue");
  const chat_signal = _feature(features, "chat_signal");
  const unit_signal = _feature(features, "unit_signal");
  const idle_signal = _feature(features, "idle_signal");
  const no_stuck_reason = _feature(features, "no_stuck_reason");

  // Family (2): scored artifact-revision features.
  const artifact_quality = _feature(features, "artifact_quality");
  const artifact_gap = _feature(features, "artifact_gap");
  const artifact_revision_delta = _feature(features, "artifact_revision_delta");

  // Family (3): social-annotation features (already zeroed when ablated).
  const annotation_friction = _feature(features, "annotation_friction");
  const annotation_momentum = _feature(features, "annotation_momentum");
  const annotation_section_overlap = _feature(
    features,
    "annotation_section_overlap",
  );

  // A regressed revision (negative delta) is a strong "repair" signal.
  const revision_regression = _clamp(-artifact_revision_delta, 0.0, 1.0);
  // Section-overlapping annotation friction is a sharper signal than diffuse
  // friction.
  const focused_annotation_friction = _clamp(
    annotation_friction * (0.5 + 0.5 * annotation_section_overlap),
    0.0,
    1.0,
  );

  const scores: Record<string, number> = {
    explain: 0.52 * mastery_gap +
      0.28 * friction_signal +
      0.2 * unit_signal +
      0.16 * calibration_drift +
      0.18 * misconception_pressure +
      0.1 * forgetting_risk +
      0.14 * focused_annotation_friction +
      0.12 * artifact_gap +
      0.16 * revision_regression -
      0.16 * transfer_readiness -
      0.08 * engagement_signal,
    represent: 0.24 * friction_signal +
      0.2 * accuracy_gap +
      0.18 * misconception_pressure +
      0.18 * uncertainty_signal +
      0.16 * idle_signal +
      0.14 * focused_annotation_friction +
      0.08 * artifact_gap +
      0.1 * revision_regression +
      0.08 * support_fatigue +
      0.06 * engagement_signal -
      0.08 * unit_signal,
    practice: 0.32 * average_mastery +
      0.2 * predicted_next_correct +
      0.16 * correct_ratio +
      0.12 * (1 - friction_signal) +
      0.12 * stability_index +
      0.08 * (1 - forgetting_risk) +
      0.1 * annotation_momentum +
      0.12 * artifact_quality -
      0.18 * accuracy_gap -
      0.1 * misconception_pressure,
    advance: 0.42 * average_mastery +
      0.18 * correct_ratio +
      0.16 * transfer_readiness +
      0.14 * engagement_signal +
      0.08 * predicted_retention +
      0.08 * annotation_momentum +
      0.1 * artifact_quality -
      0.24 * friction_signal -
      0.2 * forgetting_risk -
      0.16 * calibration_drift -
      0.1 * misconception_pressure -
      0.18 * artifact_gap -
      0.16 * revision_regression,
    ask: 0.18 * friction_signal +
      0.18 * calibration_drift +
      0.16 * misconception_pressure +
      0.14 * uncertainty_signal +
      0.14 * chat_signal +
      0.18 * focused_annotation_friction +
      0.1 * artifact_gap +
      0.1 * support_fatigue +
      0.06 * no_stuck_reason,
  };

  const exploration_bonus: Record<string, number> = {
    explain: 0.02 * unit_signal,
    represent: 0.06 * uncertainty_signal + 0.04 * idle_signal,
    practice: 0.03 * (1 - uncertainty_signal),
    advance: 0.02 * transfer_readiness,
    ask: 0.08 * uncertainty_signal + 0.03 * support_fatigue,
  };

  const result: Record<string, number> = {};
  for (const action of Object.keys(scores)) {
    const bonus = Object.prototype.hasOwnProperty.call(exploration_bonus, action)
      ? exploration_bonus[action]
      : 0.0;
    result[action] = _roundPy(_clamp(scores[action] + bonus, 0.02, 0.99), 3);
  }
  return result;
}

export function derive_reason_codes(
  features: FeatureVector,
  selected_action: string,
): string[] {
  const codes: string[] = [];
  if (_feature(features, "unit_signal") >= 0.5) {
    codes.push("unit_mismatch");
  }
  if (_feature(features, "idle_signal") >= 0.5) {
    codes.push("idle_reengagement");
  }
  if (_feature(features, "mastery_gap") >= 0.45) {
    codes.push("low_mastery");
  }
  if (_feature(features, "friction_signal") >= 0.55) {
    codes.push("high_friction");
  }
  if (_feature(features, "forgetting_risk") >= 0.6) {
    codes.push("retrieval_risk");
  }
  if (_feature(features, "calibration_drift") >= 0.3) {
    codes.push("calibration_gap");
  }
  if (_feature(features, "misconception_pressure") >= 0.35) {
    codes.push("misconception_pattern");
  }
  if (_feature(features, "annotation_friction") >= 0.35) {
    codes.push("annotation_friction");
  } else if (
    _feature(features, "annotation_section_overlap") >= 0.5 &&
    _feature(features, "annotation_friction") > 0
  ) {
    codes.push("annotation_section_focus");
  }
  if (_feature(features, "artifact_gap") >= 0.35) {
    codes.push("artifact_quality_gap");
  }
  if (_feature(features, "artifact_revision_delta") <= -0.15) {
    codes.push("artifact_revision_regression");
  }
  if (
    _feature(features, "annotation_momentum") >= 0.35 &&
    _feature(features, "artifact_quality") >= 0.65
  ) {
    codes.push("artifact_annotation_momentum");
  }
  if (
    _feature(features, "transfer_readiness") >= 0.7 &&
    (selected_action === "practice" || selected_action === "advance")
  ) {
    codes.push("transfer_ready");
  }
  if (codes.length === 0) {
    codes.push("balanced_profile");
  }
  return codes;
}

export function reason_codes_are_faithful(
  reason_codes: string[],
  evidence_snapshot: Record<string, unknown>,
): boolean {
  for (const code of reason_codes) {
    const backing = REASON_CODE_FEATURES[code];
    if (!backing) {
      return false;
    }
    const present = backing.some((feat) =>
      Object.prototype.hasOwnProperty.call(evidence_snapshot, feat)
    );
    if (!present) {
      return false;
    }
  }
  return true;
}

export function select_support_move(
  features: FeatureVector,
  annotation_adaptive = true,
  prefer_advance = false,
): SupportDecision {
  const effective: FeatureVector = { ...features };
  if (!annotation_adaptive) {
    for (const key of ANNOTATION_FEATURES) {
      effective[key] = 0.0;
    }
  }

  const action_scores = score_support_actions(effective);

  // Python: sorted(items, key=lambda item: item[1], reverse=True). Python's
  // sort is stable; iterating a dict preserves insertion order (explain,
  // represent, practice, advance, ask). Reverse-stable means equal scores keep
  // insertion order. Reproduce that exactly.
  const insertionOrder = Object.keys(action_scores);
  const indexOf = (a: string) => insertionOrder.indexOf(a);

  let ranked: Array<[string, number]> = insertionOrder.map(
    (a) => [a, action_scores[a]] as [string, number],
  );
  // Stable descending by score: equal scores keep original insertion order.
  ranked.sort((x, y) => {
    if (y[1] !== x[1]) return y[1] - x[1];
    return indexOf(x[0]) - indexOf(y[0]);
  });

  let selected_action: string;
  const advanceScore = Object.prototype.hasOwnProperty.call(
      action_scores,
      "advance",
    )
    ? action_scores["advance"]
    : 0.0;
  if (prefer_advance && advanceScore >= ranked[0][1] - 0.06) {
    selected_action = "advance";
    // Python: sorted(items, key=lambda item: (item[0] != "advance", -item[1]))
    // -> advance first, then descending score, stable on insertion order.
    ranked = insertionOrder.map((a) => [a, action_scores[a]] as [string, number]);
    ranked.sort((x, y) => {
      const xa = x[0] !== "advance" ? 1 : 0;
      const ya = y[0] !== "advance" ? 1 : 0;
      if (xa !== ya) return xa - ya;
      if (-x[1] !== -y[1]) return -x[1] - -y[1];
      return indexOf(x[0]) - indexOf(y[0]);
    });
  } else {
    selected_action = ranked[0][0];
  }

  let reason_codes = derive_reason_codes(effective, selected_action);

  // Surface the full effective vector as the evidence snapshot.
  const evidence_snapshot: Record<string, unknown> = {};
  for (const key of Object.keys(effective)) {
    evidence_snapshot[key] = effective[key];
  }

  if (!annotation_adaptive) {
    const filtered = reason_codes.filter(
      (code) => !ANNOTATION_REASON_CODES.includes(code),
    );
    reason_codes = filtered.length > 0 ? filtered : ["balanced_profile"];
  }

  const rejected_actions = ranked
    .filter(([action]) => action !== selected_action)
    .map(([action]) => action);

  return {
    policy_mode: annotation_adaptive ? "annotation_adaptive" : "annotation_ablated",
    candidate_actions: [...SUPPORT_ACTIONS],
    action_scores,
    selected_action,
    rejected_actions,
    reason_codes,
    evidence_snapshot,
  };
}
