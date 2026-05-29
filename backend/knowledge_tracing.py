from typing import Any, Dict, List, Tuple
import math


# ---------------------------------------------------------------------------
# Support-move selection policy (artifact-mediated, multi-signal fusion).
#
# This is the pure, dependency-free core of ALGET's adaptive contribution:
# it fuses THREE signal families into ONE support-selection decision and
# emits an AUDITABLE record (candidate actions, selected, rejected, the
# evidence snapshot that drove the choice, and reason_codes derived FROM
# those features). The faithfulness invariant - every reason_code maps to a
# feature actually present in the evidence snapshot - is enforced here so it
# can be tested without importing the FastAPI server or any network deps.
#
# Signal families fused (see ALGET novelty thesis):
#   (1) KT / telemetry state         -> mastery_gap, friction_signal, ...
#   (2) scored artifact-revision     -> artifact_quality, artifact_gap,
#                                        artifact_revision_delta
#   (3) social-annotation signals    -> annotation_friction, annotation_momentum,
#                                        annotation_section_overlap
# ---------------------------------------------------------------------------

SUPPORT_ACTIONS: Tuple[str, ...] = ("explain", "represent", "practice", "advance", "ask")

# Which features are allowed to be cited by which reason_code. The faithfulness
# self-check requires that a reason_code only fires when at least one of its
# backing features is present in the evidence snapshot. ANNOTATION_REASON_CODES
# and ARTIFACT_REASON_CODES make the social/artifact families' contribution to
# the decision explicit and auditable for the RQ4 ablation.
REASON_CODE_FEATURES: Dict[str, Tuple[str, ...]] = {
    "unit_mismatch": ("unit_signal",),
    "idle_reengagement": ("idle_signal",),
    "low_mastery": ("mastery_gap", "average_mastery"),
    "high_friction": ("friction_signal", "frustration_index"),
    "retrieval_risk": ("forgetting_risk",),
    "calibration_gap": ("calibration_drift",),
    "misconception_pattern": ("misconception_pressure",),
    "annotation_friction": ("annotation_friction", "annotation_section_overlap"),
    "annotation_section_focus": ("annotation_section_overlap",),
    "artifact_quality_gap": ("artifact_gap", "artifact_quality"),
    "artifact_revision_regression": ("artifact_revision_delta",),
    "artifact_annotation_momentum": ("annotation_momentum", "artifact_quality"),
    "transfer_ready": ("transfer_readiness",),
    "balanced_profile": (
        "average_mastery",
        "friction_signal",
        "transfer_readiness",
    ),
}

ANNOTATION_REASON_CODES: Tuple[str, ...] = (
    "annotation_friction",
    "annotation_section_focus",
    "artifact_annotation_momentum",
)

# Features sourced from the social-annotation family. When the annotation
# ablation flag is OFF these are zeroed out of the policy so the RQ4
# comparison can show that annotation evidence changes which support fires.
ANNOTATION_FEATURES: Tuple[str, ...] = (
    "annotation_friction",
    "annotation_momentum",
    "annotation_section_overlap",
)


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def _feature(features: Dict[str, Any], key: str, fallback: float = 0.0) -> float:
    try:
        return float(features.get(key, fallback))
    except (TypeError, ValueError):
        return fallback


def score_support_actions(features: Dict[str, Any]) -> Dict[str, float]:
    """Map a normalized feature vector to a score per candidate support action.

    The weights intentionally mirror the live engine in server.py so the pure
    core and the served endpoint agree. Artifact-revision and annotation
    features carry real weight here so that flipping them changes the ranking.
    """
    mastery_gap = _feature(features, "mastery_gap")
    average_mastery = _feature(features, "average_mastery")
    friction_signal = _feature(features, "friction_signal")
    accuracy_gap = _feature(features, "accuracy_gap")
    uncertainty_signal = _feature(features, "uncertainty_signal")
    correct_ratio = _feature(features, "correct_ratio")
    forgetting_risk = _feature(features, "forgetting_risk")
    calibration_drift = _feature(features, "calibration_drift")
    transfer_readiness = _feature(features, "transfer_readiness")
    stability_index = _feature(features, "stability_index")
    predicted_next_correct = _feature(features, "predicted_next_correct")
    predicted_retention = _feature(features, "predicted_retention")
    misconception_pressure = _feature(features, "misconception_pressure")
    engagement_signal = _feature(features, "engagement_signal")
    support_fatigue = _feature(features, "support_fatigue")
    chat_signal = _feature(features, "chat_signal")
    unit_signal = _feature(features, "unit_signal")
    idle_signal = _feature(features, "idle_signal")
    no_stuck_reason = _feature(features, "no_stuck_reason")

    # Family (2): scored artifact-revision features.
    artifact_quality = _feature(features, "artifact_quality")
    artifact_gap = _feature(features, "artifact_gap")
    artifact_revision_delta = _feature(features, "artifact_revision_delta")

    # Family (3): social-annotation features (already zeroed when ablated).
    annotation_friction = _feature(features, "annotation_friction")
    annotation_momentum = _feature(features, "annotation_momentum")
    annotation_section_overlap = _feature(features, "annotation_section_overlap")

    # A regressed revision (negative delta) is a strong "repair" signal.
    revision_regression = _clamp(-artifact_revision_delta, 0.0, 1.0)
    # Section-overlapping annotation friction is a sharper signal than diffuse
    # friction: peers/self are confused about THIS section, not the book at large.
    focused_annotation_friction = _clamp(
        annotation_friction * (0.5 + 0.5 * annotation_section_overlap), 0.0, 1.0
    )

    scores = {
        "explain": (
            0.52 * mastery_gap
            + 0.28 * friction_signal
            + 0.2 * unit_signal
            + 0.16 * calibration_drift
            + 0.18 * misconception_pressure
            + 0.1 * forgetting_risk
            + 0.14 * focused_annotation_friction
            + 0.12 * artifact_gap
            + 0.16 * revision_regression
            - 0.16 * transfer_readiness
            - 0.08 * engagement_signal
        ),
        "represent": (
            0.24 * friction_signal
            + 0.2 * accuracy_gap
            + 0.18 * misconception_pressure
            + 0.18 * uncertainty_signal
            + 0.16 * idle_signal
            + 0.14 * focused_annotation_friction
            + 0.08 * artifact_gap
            + 0.1 * revision_regression
            + 0.08 * support_fatigue
            + 0.06 * engagement_signal
            - 0.08 * unit_signal
        ),
        "practice": (
            0.32 * average_mastery
            + 0.2 * predicted_next_correct
            + 0.16 * correct_ratio
            + 0.12 * (1 - friction_signal)
            + 0.12 * stability_index
            + 0.08 * (1 - forgetting_risk)
            + 0.1 * annotation_momentum
            + 0.12 * artifact_quality
            - 0.18 * accuracy_gap
            - 0.1 * misconception_pressure
        ),
        "advance": (
            0.42 * average_mastery
            + 0.18 * correct_ratio
            + 0.16 * transfer_readiness
            + 0.14 * engagement_signal
            + 0.08 * predicted_retention
            + 0.08 * annotation_momentum
            + 0.1 * artifact_quality
            - 0.24 * friction_signal
            - 0.2 * forgetting_risk
            - 0.16 * calibration_drift
            - 0.1 * misconception_pressure
            - 0.18 * artifact_gap
            - 0.16 * revision_regression
        ),
        "ask": (
            0.18 * friction_signal
            + 0.18 * calibration_drift
            + 0.16 * misconception_pressure
            + 0.14 * uncertainty_signal
            + 0.14 * chat_signal
            + 0.18 * focused_annotation_friction
            + 0.1 * artifact_gap
            + 0.1 * support_fatigue
            + 0.06 * no_stuck_reason
        ),
    }

    # Small exploration bonus (kept consistent with the live engine) so the
    # policy lightly favors information-gathering moves under uncertainty
    # without overriding strong evidence.
    exploration_bonus = {
        "explain": 0.02 * unit_signal,
        "represent": 0.06 * uncertainty_signal + 0.04 * idle_signal,
        "practice": 0.03 * (1 - uncertainty_signal),
        "advance": 0.02 * transfer_readiness,
        "ask": 0.08 * uncertainty_signal + 0.03 * support_fatigue,
    }
    return {
        action: round(_clamp(score + exploration_bonus.get(action, 0.0), 0.02, 0.99), 3)
        for action, score in scores.items()
    }


def derive_reason_codes(features: Dict[str, Any], selected_action: str) -> List[str]:
    """Derive reason_codes FROM the feature vector that drove the selection.

    Faithfulness contract: a code is only appended when the feature(s) that
    justify it cross threshold, so every emitted code is backed by evidence.
    """
    codes: List[str] = []
    if _feature(features, "unit_signal") >= 0.5:
        codes.append("unit_mismatch")
    if _feature(features, "idle_signal") >= 0.5:
        codes.append("idle_reengagement")
    if _feature(features, "mastery_gap") >= 0.45:
        codes.append("low_mastery")
    if _feature(features, "friction_signal") >= 0.55:
        codes.append("high_friction")
    if _feature(features, "forgetting_risk") >= 0.6:
        codes.append("retrieval_risk")
    if _feature(features, "calibration_drift") >= 0.3:
        codes.append("calibration_gap")
    if _feature(features, "misconception_pressure") >= 0.35:
        codes.append("misconception_pattern")
    if _feature(features, "annotation_friction") >= 0.35:
        codes.append("annotation_friction")
    elif _feature(features, "annotation_section_overlap") >= 0.5 and _feature(features, "annotation_friction") > 0:
        codes.append("annotation_section_focus")
    if _feature(features, "artifact_gap") >= 0.35:
        codes.append("artifact_quality_gap")
    if _feature(features, "artifact_revision_delta") <= -0.15:
        codes.append("artifact_revision_regression")
    if _feature(features, "annotation_momentum") >= 0.35 and _feature(features, "artifact_quality") >= 0.65:
        codes.append("artifact_annotation_momentum")
    if _feature(features, "transfer_readiness") >= 0.7 and selected_action in {"practice", "advance"}:
        codes.append("transfer_ready")
    if not codes:
        codes.append("balanced_profile")
    return codes


def reason_codes_are_faithful(reason_codes: List[str], evidence_snapshot: Dict[str, Any]) -> bool:
    """Faithfulness invariant: every reason_code must correspond to at least one
    feature present in the evidence snapshot. Returns True when faithful.
    """
    for code in reason_codes:
        backing = REASON_CODE_FEATURES.get(code)
        if not backing:
            return False
        if not any(feat in evidence_snapshot for feat in backing):
            return False
    return True


def select_support_move(
    features: Dict[str, Any],
    annotation_adaptive: bool = True,
    prefer_advance: bool = False,
) -> Dict[str, Any]:
    """Fuse the three signal families and emit an auditable decision record.

    Args:
        features: normalized feature vector (KT/telemetry + scored-artifact +
            social-annotation families).
        annotation_adaptive: RQ4 ablation flag. When False, the social
            annotation family is zeroed out of the policy so the ablation can
            show annotation evidence changes which support fires.
        prefer_advance: when the upstream readiness gate says the learner may
            advance and advance is within a small margin of the top score.

    Returns a dict with: policy_mode, candidate_actions, action_scores,
    selected_action, rejected_actions, reason_codes, evidence_snapshot.
    """
    effective = dict(features)
    if not annotation_adaptive:
        for key in ANNOTATION_FEATURES:
            effective[key] = 0.0

    action_scores = score_support_actions(effective)
    ranked = sorted(action_scores.items(), key=lambda item: item[1], reverse=True)

    if prefer_advance and action_scores.get("advance", 0.0) >= ranked[0][1] - 0.06:
        selected_action = "advance"
        ranked = sorted(action_scores.items(), key=lambda item: (item[0] != "advance", -item[1]))
    else:
        selected_action = ranked[0][0]

    reason_codes = derive_reason_codes(effective, selected_action)

    # Build the evidence snapshot from the features that the policy can cite.
    # Only features referenced by REASON_CODE_FEATURES need to be present for
    # the faithfulness invariant, but we surface the full effective vector so
    # the 'why this support now' UI can render the complete basis.
    evidence_snapshot = {key: effective.get(key) for key in effective}

    # When annotation is ablated, the zeroed features must not back any code.
    if not annotation_adaptive:
        reason_codes = [
            code for code in reason_codes if code not in ANNOTATION_REASON_CODES
        ] or ["balanced_profile"]

    rejected_actions = [action for action, _ in ranked if action != selected_action]

    decision = {
        "policy_mode": "annotation_adaptive" if annotation_adaptive else "annotation_ablated",
        "candidate_actions": list(SUPPORT_ACTIONS),
        "action_scores": action_scores,
        "selected_action": selected_action,
        "rejected_actions": rejected_actions,
        "reason_codes": reason_codes,
        "evidence_snapshot": evidence_snapshot,
    }
    return decision


# ---------------------------------------------------------------------------
# SPACED REPETITION (SM-2) review schedule.
#
# A pure, dependency-free SM-2 (SuperMemo-2) scheduler keyed off SECTION
# COMPLETION review events per concept_id. It is exposed as a TRANSPARENT
# signal that feeds the existing forgetting_risk / retrieval_risk reason codes
# (see derive_reason_codes -> "retrieval_risk", REASON_CODE_FEATURES, and the
# live engine's forgetting_risk feature). The engine already consumes a
# forgetting_risk float; this function turns an auditable review history into
# that float (and the underlying SM-2 state) so the "why this support now" UI
# can show the spacing basis, not just an opaque risk number.
#
# Design choices kept faithful to canonical SM-2:
#   * Each review carries a quality grade q in [0,5] (>=3 = recall success).
#   * Easiness factor (EF) starts at 2.5, updated with the SM-2 EF recurrence,
#     floored at 1.3.
#   * Repetition count and interval (in days) follow SM-2: a sub-3 grade resets
#     the repetition streak and the interval to 1 day.
#   * Spacing is keyed off SECTION COMPLETION: each completed section that
#     exercises a concept is one review event, so the schedule advances as the
#     learner finishes sections rather than on a wall clock alone.
# The forgetting_risk we surface is a bounded function of how overdue the
# concept is relative to its scheduled interval, so it is a smooth, transparent
# signal rather than a step function.
# ---------------------------------------------------------------------------

SM2_DEFAULT_EF: float = 2.5
SM2_MIN_EF: float = 1.3
SM2_PASS_GRADE: int = 3  # q >= 3 counts as a successful recall


def _sm2_update_ef(ef: float, quality: int) -> float:
    """SM-2 easiness-factor recurrence, floored at SM2_MIN_EF.

    EF' = EF + (0.1 - (5 - q)*(0.08 + (5 - q)*0.02))
    """
    q = max(0, min(5, int(quality)))
    ef_new = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    return max(SM2_MIN_EF, ef_new)


def _sm2_next_interval(repetition: int, prev_interval: float, ef: float) -> float:
    """SM-2 next interval (days) for a SUCCESSFUL review at this repetition.

    repetition is the 1-based count of consecutive successful recalls.
    """
    if repetition <= 1:
        return 1.0
    if repetition == 2:
        return 6.0
    return round(prev_interval * ef, 4)


def compute_sm2_schedule(
    review_history: List[Dict[str, Any]],
    elapsed_days_since_last: float = 0.0,
) -> Dict[str, Any]:
    """Fold a concept's section-completion review history into an SM-2 schedule.

    Pure and import-light. Given the ordered list of review events for ONE
    concept_id (each produced when the learner completes a section that
    exercises the concept), return the SM-2 state plus a transparent
    forgetting_risk signal the policy already consumes.

    Args:
        review_history: ordered list of review events, each a dict with:
            * ``quality`` (or ``q``): recall grade in [0,5]; >=3 is a success.
              Defaults to 4 (a clean recall) when absent so a bare "completed
              this section" event still advances the schedule sensibly.
            * ``section_id`` (optional): which section completion produced the
              review, surfaced for auditability.
        elapsed_days_since_last: days elapsed since the most recent review
            (e.g. now - last_review). Used only to compute how overdue the
            concept is; 0.0 means "evaluate as of the last review".

    Returns a descriptor dict:
        {
          "repetition": int,            # consecutive successful recalls
          "easiness_factor": float,     # SM-2 EF (>= 1.3)
          "interval_days": float,       # scheduled days until next review
          "reviews": int,               # total review events folded in
          "last_quality": int | None,   # grade of the most recent review
          "days_overdue": float,        # elapsed - interval, floored at 0
          "forgetting_risk": float,     # [0,1] transparent retrieval-risk signal
          "due": bool,                  # elapsed >= interval
          "last_section_id": str | None,
        }

    forgetting_risk semantics (transparent, smooth):
      * No reviews yet  -> 0.5 (engine's neutral prior for an unseen concept).
      * Within interval -> low risk that decays from ~0.5 toward 0 as the
        review streak / EF grow (a well-spaced, often-recalled concept is safe).
      * Overdue         -> rises toward 1.0 in proportion to how many intervals
        past due the concept is, so retrieval_risk (>= 0.6) fires once a concept
        is roughly a full interval overdue.
    """
    if not review_history:
        return {
            "repetition": 0,
            "easiness_factor": SM2_DEFAULT_EF,
            "interval_days": 0.0,
            "reviews": 0,
            "last_quality": None,
            "days_overdue": 0.0,
            "forgetting_risk": 0.5,
            "due": True,
            "last_section_id": None,
        }

    ef = SM2_DEFAULT_EF
    repetition = 0
    interval = 0.0
    last_quality: int = SM2_PASS_GRADE + 1
    last_section_id: Any = None

    for event in review_history:
        if not isinstance(event, dict):
            continue
        raw_q = event.get("quality", event.get("q", 4))
        try:
            quality = max(0, min(5, int(round(float(raw_q)))))
        except (TypeError, ValueError):
            quality = 4
        last_quality = quality
        last_section_id = event.get("section_id", last_section_id)

        if quality >= SM2_PASS_GRADE:
            repetition += 1
            ef = _sm2_update_ef(ef, quality)
            interval = _sm2_next_interval(repetition, interval, ef)
        else:
            # Failed recall: reset the streak and re-learn from a 1-day interval.
            repetition = 0
            ef = _sm2_update_ef(ef, quality)
            interval = 1.0

    elapsed = max(0.0, float(elapsed_days_since_last))
    days_overdue = max(0.0, elapsed - interval) if interval > 0 else elapsed
    due = elapsed >= interval if interval > 0 else True

    # Transparent forgetting_risk: blend a "well-rehearsed concept is safe"
    # baseline with an overdue penalty. A concept one full interval overdue
    # reaches ~0.6 (so retrieval_risk fires); deeper overdue saturates toward 1.
    safe_interval = interval if interval > 0 else 1.0
    overdue_ratio = days_overdue / safe_interval
    rehearsed = _clamp(repetition / 5.0, 0.0, 1.0)
    baseline = 0.5 * (1.0 - 0.6 * rehearsed)  # 0.5 down toward 0.2 as it sticks
    forgetting_risk = _clamp(baseline + 0.6 * overdue_ratio, 0.0, 1.0)
    # A failed last recall is itself a strong retrieval-risk signal.
    if last_quality < SM2_PASS_GRADE:
        forgetting_risk = max(forgetting_risk, 0.7)

    return {
        "repetition": repetition,
        "easiness_factor": round(ef, 4),
        "interval_days": round(interval, 4),
        "reviews": sum(1 for e in review_history if isinstance(e, dict)),
        "last_quality": last_quality,
        "days_overdue": round(days_overdue, 4),
        "forgetting_risk": round(forgetting_risk, 4),
        "due": due,
        "last_section_id": last_section_id,
    }


def aggregate_forgetting_risk(
    schedules_by_concept: Dict[str, Dict[str, Any]],
) -> float:
    """Reduce per-concept SM-2 schedules to ONE forgetting_risk for the policy.

    The live engine consumes a single forgetting_risk float (which backs the
    ``retrieval_risk`` reason code at >= 0.6). When several concepts are in
    play we take the MAX per-concept risk: a single overdue concept is enough
    to justify a retrieval-supportive move, mirroring how the engine treats the
    weakest-link concept as the binding constraint. Empty input -> 0.5 (the
    engine's neutral prior).
    """
    risks = [
        _feature(sched, "forgetting_risk", 0.5)
        for sched in schedules_by_concept.values()
        if isinstance(sched, dict)
    ]
    if not risks:
        return 0.5
    return round(_clamp(max(risks), 0.0, 1.0), 4)


class BayesianKnowledgeTracing:
    """
    Implements Bayesian Knowledge Tracing (BKT) calculation for mastery updates.
    """
    def __init__(self, p_guess_default=0.2, p_slip_default=0.1, p_transit_default=0.1):
        self.p_guess_default = p_guess_default
        self.p_slip_default = p_slip_default
        self.p_transit_default = p_transit_default

    def update_p_known(self, p_known: float, is_correct: bool, 
                       p_guess: float = None, p_slip: float = None, p_transit: float = None) -> float:
        """
        Calculates the new probability that a student knows a concept after an attempt.
        """
        guess = p_guess if p_guess is not None else self.p_guess_default
        slip = p_slip if p_slip is not None else self.p_slip_default
        transit = p_transit if p_transit is not None else self.p_transit_default

        # Calculate P(L_n | Evidence)
        if is_correct:
            # Student answered correctly
            prob_evidence = (p_known * (1 - slip)) + ((1 - p_known) * guess)
            if prob_evidence == 0:
                p_known_given_evidence = 0
            else:
                p_known_given_evidence = (p_known * (1 - slip)) / prob_evidence
        else:
            # Student answered incorrectly
            prob_evidence = (p_known * slip) + ((1 - p_known) * (1 - guess))
            if prob_evidence == 0:
                p_known_given_evidence = 0
            else:
                p_known_given_evidence = (p_known * slip) / prob_evidence

        # Calculate Next State P(L_{n+1})
        new_p_known = p_known_given_evidence + ((1 - p_known_given_evidence) * transit)
        
        # Bound limits
        return max(0.0001, min(0.9999, new_p_known))

    def process_q_matrix_update(self, current_states: Dict[str, float], 
                                q_matrix_weights: Dict[str, float], 
                                is_correct: bool) -> Dict[str, float]:
        """
        Updates multiple concepts based on a Q-Matrix definition.
        q_matrix_weights defines how strongly an item maps to each concept (e.g., {"math": 1.0, "physics": 0.5}).
        Currently treats partial mapping weights as modulating the 'transit' or utilizing evidence partially.
        Simple model: We update all concepts associated with the item. For concepts with lower weights, 
        we diluting the evidence impact by shifting the update closer to the original state.
        """
        new_states = {}
        for concept_id, weight in q_matrix_weights.items():
            current_p = current_states.get(concept_id, 0.1) # Default initial prior
            
            # Full BKT update
            full_updated_p = self.update_p_known(current_p, is_correct)
            
            # Modulate by weight (simple interpolation for partial mapping)
            # If weight = 1.0, full update applied. If weight = 0, no update applied.
            blended_p = current_p + weight * (full_updated_p - current_p)
            new_states[concept_id] = blended_p
            
        return new_states

    def apply_telemetry_fusion(self, 
                             current_p_slip: float, 
                             current_p_transit: float,
                             interaction_type: str,
                             intensity: float = 1.0) -> Tuple[float, float]:
        """
        Dynamically adjusts BKT priors based on interaction telemetry (Soft Evidence).
        
        interaction_type: 
        - 'hint_request': Student asked for Socratic hint. We increase p_slip slightly 
          because they might know it but needed a nudge, and increase p_transit because 
          the hint is a learning opportunity.
        - 'chat_engagement': Deep Socratic chat interaction. Significantly increases p_transit.
        - 'simulation_play': Active interaction with a dynamic component. Reduces p_slip.
        """
        new_slip = current_p_slip
        new_transit = current_p_transit
        
        if interaction_type == 'hint_request':
            # They needed a nudge, maybe they know it but slipped.
            new_slip = min(0.5, current_p_slip + (0.05 * intensity))
            new_transit = min(0.8, current_p_transit + (0.02 * intensity))
            
        elif interaction_type == 'chat_engagement':
            # Deep reflection => high probability of learning
            new_transit = min(0.9, current_p_transit + (0.1 * intensity))
            
        elif interaction_type == 'simulation_play':
            # Active learning reduces careless errors later
            new_slip = max(0.01, current_p_slip - (0.05 * intensity))
            new_transit = min(0.8, current_p_transit + (0.05 * intensity))
            
        elif interaction_type == 'affect_confused':
            # They explicitly indicated confusion (🤔)
            new_slip = min(0.6, current_p_slip + (0.1 * intensity))
            new_transit = max(0.01, current_p_transit - (0.02 * intensity))
            
        elif interaction_type == 'affect_insight':
            # They implicitly indicated a lightbulb moment (💡)
            new_transit = min(0.95, current_p_transit + (0.15 * intensity))
            new_slip = max(0.01, current_p_slip - (0.05 * intensity))
            
        elif interaction_type == 'affect_engaged':
            # Engaged (🤩) indicates flow and focus
            new_transit = min(0.85, current_p_transit + (0.05 * intensity))
            new_slip = max(0.01, current_p_slip - (0.02 * intensity))
            
        elif interaction_type == 'affect_disengaged':
            # Disengaged/bored (🥱) indicates potential for careless errors
            new_slip = min(0.7, current_p_slip + (0.15 * intensity))
            new_transit = max(0.01, current_p_transit - (0.05 * intensity))
            
        return new_slip, new_transit
