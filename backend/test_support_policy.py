"""Import-light tests for ALGET's multi-signal support-move policy core.

These tests import only knowledge_tracing (no FastAPI / no network / no
Supabase), so they run in the same minimal environment as test_eval and
test_misconceptions. They cover:

  * different feature vectors -> different selected actions (the policy is
    actually a function of the fused feature vector, not a constant);
  * the faithfulness invariant (every reason_code maps to a feature present
    in the evidence snapshot);
  * the annotation_adaptive ablation flag flipping the decision (RQ4): with
    the same inputs, turning annotation signals OFF changes which support
    fires and removes annotation-derived reason_codes.
"""

import os
import sys

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from knowledge_tracing import (  # noqa: E402
    ANNOTATION_REASON_CODES,
    REASON_CODE_FEATURES,
    derive_reason_codes,
    reason_codes_are_faithful,
    score_support_actions,
    select_support_move,
)


# ---------------------------------------------------------------------------
# (1) The policy is a function of the fused feature vector: different vectors
#     produce different selected actions across all three signal families.
# ---------------------------------------------------------------------------

def test_high_mastery_clean_state_selects_advance():
    decision = select_support_move(
        {
            "average_mastery": 0.92,
            "correct_ratio": 0.95,
            "transfer_readiness": 0.85,
            "engagement_signal": 0.8,
            "predicted_retention": 0.85,
            "artifact_quality": 0.9,
        },
        prefer_advance=True,
    )
    assert decision["selected_action"] == "advance"
    assert "advance" not in decision["rejected_actions"]


def test_high_mastery_friction_selects_support_not_advance():
    decision = select_support_move(
        {
            "mastery_gap": 0.7,
            "average_mastery": 0.3,
            "friction_signal": 0.8,
            "misconception_pressure": 0.5,
        }
    )
    assert decision["selected_action"] in {"explain", "represent", "ask"}
    assert decision["selected_action"] != "advance"


def test_artifact_revision_regression_drives_explain():
    # A regressed artifact revision (negative delta) should pull selection
    # toward repair (explain) and away from advance, even at moderate mastery.
    decision = select_support_move(
        {
            "average_mastery": 0.6,
            "artifact_quality": 0.35,
            "artifact_gap": 0.6,
            "artifact_revision_delta": -0.45,
        }
    )
    assert decision["action_scores"]["explain"] > decision["action_scores"]["advance"]
    assert "artifact_revision_regression" in decision["reason_codes"]


def test_distinct_vectors_yield_distinct_selections():
    support = select_support_move({"mastery_gap": 0.8, "friction_signal": 0.8})
    advance = select_support_move(
        {"average_mastery": 0.95, "correct_ratio": 0.95, "transfer_readiness": 0.9},
        prefer_advance=True,
    )
    assert support["selected_action"] != advance["selected_action"]


# ---------------------------------------------------------------------------
# (2) Faithfulness invariant: every reason_code maps to a feature present in
#     the evidence snapshot, and no code is emitted without backing evidence.
# ---------------------------------------------------------------------------

def test_every_reason_code_is_faithful_to_snapshot():
    decision = select_support_move(
        {
            "mastery_gap": 0.7,
            "friction_signal": 0.7,
            "forgetting_risk": 0.7,
            "calibration_drift": 0.5,
            "misconception_pressure": 0.6,
            "annotation_friction": 0.6,
            "annotation_section_overlap": 1.0,
            "artifact_gap": 0.6,
            "artifact_quality": 0.2,
            "artifact_revision_delta": -0.4,
        }
    )
    assert reason_codes_are_faithful(
        decision["reason_codes"], decision["evidence_snapshot"]
    )
    # Every code in the registry maps to real backing features.
    for code in decision["reason_codes"]:
        backing = REASON_CODE_FEATURES[code]
        assert any(feat in decision["evidence_snapshot"] for feat in backing)


def test_unfaithful_code_is_detected():
    # A code whose backing feature is absent must fail the invariant.
    assert reason_codes_are_faithful(["low_mastery"], {"mastery_gap": 0.5}) is True
    assert reason_codes_are_faithful(["low_mastery"], {"friction_signal": 0.5}) is False
    assert reason_codes_are_faithful(["not_a_real_code"], {"mastery_gap": 0.5}) is False


def test_balanced_profile_when_no_risk_dominates():
    decision = select_support_move({"average_mastery": 0.55, "correct_ratio": 0.55})
    assert decision["reason_codes"] == ["balanced_profile"]
    assert reason_codes_are_faithful(
        decision["reason_codes"], decision["evidence_snapshot"]
    )


# ---------------------------------------------------------------------------
# (3) RQ4 ablation flag: annotation ON vs OFF flips which support fires and
#     removes annotation-derived reason_codes.
# ---------------------------------------------------------------------------

_ABLATION_VECTOR = {
    "average_mastery": 0.55,
    "predicted_next_correct": 0.5,
    "correct_ratio": 0.45,
    "stability_index": 0.3,
    "annotation_friction": 1.0,
    "annotation_section_overlap": 1.0,
    "calibration_drift": 0.5,
    "misconception_pressure": 0.5,
    "chat_signal": 0.8,
    "uncertainty_signal": 0.6,
    "artifact_gap": 0.3,
}


def test_annotation_ablation_flips_selected_action():
    on = select_support_move(_ABLATION_VECTOR, annotation_adaptive=True)
    off = select_support_move(_ABLATION_VECTOR, annotation_adaptive=False)
    assert on["policy_mode"] == "annotation_adaptive"
    assert off["policy_mode"] == "annotation_ablated"
    # The same learner state selects a different support when annotation
    # evidence is removed: this is the RQ4 effect we need to be able to show.
    assert on["selected_action"] != off["selected_action"]
    assert on["selected_action"] == "ask"
    assert off["selected_action"] == "practice"


def test_annotation_ablation_removes_annotation_reason_codes():
    on = select_support_move(_ABLATION_VECTOR, annotation_adaptive=True)
    off = select_support_move(_ABLATION_VECTOR, annotation_adaptive=False)
    assert any(code in ANNOTATION_REASON_CODES for code in on["reason_codes"])
    assert not any(code in ANNOTATION_REASON_CODES for code in off["reason_codes"])
    # Ablated decisions stay faithful too.
    assert reason_codes_are_faithful(off["reason_codes"], off["evidence_snapshot"])


def test_ablation_zeroes_annotation_features_in_snapshot():
    off = select_support_move(_ABLATION_VECTOR, annotation_adaptive=False)
    assert off["evidence_snapshot"]["annotation_friction"] == 0.0
    assert off["evidence_snapshot"]["annotation_section_overlap"] == 0.0


# ---------------------------------------------------------------------------
# Component sanity: scoring and reason-code derivation in isolation.
# ---------------------------------------------------------------------------

def test_score_support_actions_returns_all_candidates_bounded():
    scores = score_support_actions({"mastery_gap": 0.5})
    assert set(scores.keys()) == {"explain", "represent", "practice", "advance", "ask"}
    for value in scores.values():
        assert 0.02 <= value <= 0.99


def test_section_overlap_only_friction_yields_section_focus_code():
    # Friction present but below the global threshold, anchored to this section.
    codes = derive_reason_codes(
        {"annotation_friction": 0.2, "annotation_section_overlap": 1.0},
        selected_action="ask",
    )
    assert "annotation_section_focus" in codes
