"""Import-light tests for the Bayesian Knowledge Tracing (BKT) mastery core.

These import only knowledge_tracing (no FastAPI / no network / no Supabase),
matching the minimal environment used by test_eval, test_misconceptions and
test_support_policy. They cover the mastery-update math that drives the
learner model:

  * a correct attempt raises P(known) and a wrong attempt lowers it, with the
    posterior bounded inside (0, 1);
  * the Q-matrix update modulates the BKT step by per-concept mapping weight
    (weight 1.0 = full update, weight 0.0 = no movement);
  * telemetry fusion nudges the BKT priors (p_slip / p_transit) by interaction
    type in the documented direction, and stays bounded.
"""

import os
import sys

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from knowledge_tracing import BayesianKnowledgeTracing  # noqa: E402


def _bkt():
    return BayesianKnowledgeTracing()


# ---------------------------------------------------------------------------
# (1) Single-attempt mastery update: correct raises, wrong lowers, bounded.
# ---------------------------------------------------------------------------

def test_correct_attempt_raises_p_known():
    bkt = _bkt()
    prior = 0.3
    posterior = bkt.update_p_known(prior, is_correct=True)
    assert posterior > prior


def test_wrong_attempt_lowers_p_known():
    bkt = _bkt()
    prior = 0.6
    posterior = bkt.update_p_known(prior, is_correct=False)
    assert posterior < prior


def test_p_known_stays_strictly_inside_unit_interval():
    bkt = _bkt()
    # Even from extreme priors the bounded posterior never hits 0 or 1.
    near_zero = bkt.update_p_known(0.0001, is_correct=False)
    near_one = bkt.update_p_known(0.9999, is_correct=True)
    assert 0.0 < near_zero < 1.0
    assert 0.0 < near_one < 1.0
    assert near_one <= 0.9999


def test_repeated_correct_attempts_converge_upward():
    bkt = _bkt()
    p = 0.2
    history = [p]
    for _ in range(5):
        p = bkt.update_p_known(p, is_correct=True)
        history.append(p)
    # Monotonically non-decreasing and approaching mastery.
    assert all(b >= a for a, b in zip(history, history[1:]))
    assert history[-1] > 0.8


def test_custom_guess_slip_change_the_posterior():
    bkt = _bkt()
    base = bkt.update_p_known(0.4, is_correct=True)
    # A very high guess rate makes a correct answer weaker evidence of knowing.
    high_guess = bkt.update_p_known(0.4, is_correct=True, p_guess=0.9, p_slip=0.1)
    assert high_guess < base


# ---------------------------------------------------------------------------
# (2) Q-matrix update modulates the BKT step by per-concept mapping weight.
# ---------------------------------------------------------------------------

def test_q_matrix_full_weight_applies_full_update():
    bkt = _bkt()
    current = {"cognitive_load": 0.3}
    full_only = bkt.update_p_known(0.3, is_correct=True)
    updated = bkt.process_q_matrix_update(current, {"cognitive_load": 1.0}, is_correct=True)
    assert updated["cognitive_load"] == full_only


def test_q_matrix_zero_weight_leaves_concept_unchanged():
    bkt = _bkt()
    current = {"secondary": 0.4}
    updated = bkt.process_q_matrix_update(current, {"secondary": 0.0}, is_correct=True)
    assert updated["secondary"] == 0.4


def test_q_matrix_partial_weight_is_between_no_update_and_full_update():
    bkt = _bkt()
    prior = 0.3
    full = bkt.update_p_known(prior, is_correct=True)
    updated = bkt.process_q_matrix_update({"c": prior}, {"c": 0.5}, is_correct=True)
    # Partial mapping lands strictly between the prior and the full update.
    assert prior < updated["c"] < full


def test_q_matrix_updates_all_mapped_concepts():
    bkt = _bkt()
    current = {"primary": 0.3, "secondary": 0.3}
    updated = bkt.process_q_matrix_update(
        current, {"primary": 1.0, "secondary": 0.5}, is_correct=True
    )
    # Both move up on a correct attempt; the weaker mapping moves less.
    assert updated["primary"] > updated["secondary"] > 0.3


# ---------------------------------------------------------------------------
# (3) Telemetry fusion nudges the BKT priors per interaction type, bounded.
# ---------------------------------------------------------------------------

def test_hint_request_raises_slip_and_transit():
    bkt = _bkt()
    new_slip, new_transit = bkt.apply_telemetry_fusion(0.1, 0.1, "hint_request")
    assert new_slip > 0.1
    assert new_transit > 0.1


def test_affect_insight_raises_transit_and_lowers_slip():
    bkt = _bkt()
    new_slip, new_transit = bkt.apply_telemetry_fusion(0.2, 0.1, "affect_insight")
    assert new_transit > 0.1
    assert new_slip < 0.2


def test_affect_confused_raises_slip_and_lowers_transit():
    bkt = _bkt()
    new_slip, new_transit = bkt.apply_telemetry_fusion(0.2, 0.1, "affect_confused")
    assert new_slip > 0.2
    assert new_transit < 0.1


def test_unknown_interaction_type_is_a_no_op():
    bkt = _bkt()
    new_slip, new_transit = bkt.apply_telemetry_fusion(0.2, 0.15, "not_a_real_signal")
    assert (new_slip, new_transit) == (0.2, 0.15)


def test_telemetry_fusion_stays_bounded_under_repeated_intensity():
    bkt = _bkt()
    slip, transit = 0.1, 0.1
    for _ in range(50):
        slip, transit = bkt.apply_telemetry_fusion(slip, transit, "chat_engagement")
    # chat_engagement only raises transit; it is capped at 0.9.
    assert transit <= 0.9
    assert 0.0 <= slip <= 1.0


def test_intensity_scales_the_nudge():
    bkt = _bkt()
    _, low = bkt.apply_telemetry_fusion(0.1, 0.1, "chat_engagement", intensity=0.5)
    _, high = bkt.apply_telemetry_fusion(0.1, 0.1, "chat_engagement", intensity=1.0)
    assert high > low
