from server import (
    AdaptiveMasteryState,
    AdaptiveRecommendationRequest,
    AdaptiveTelemetrySummary,
    build_adaptive_recommendation,
)


def test_adaptive_recommendation_prioritizes_explain_when_friction_is_high():
    response = build_adaptive_recommendation(
        AdaptiveRecommendationRequest(
            section_id="bio-inspired/04/01",
            section_title="Directional Adhesion",
            concept_ids=["directional_adhesion"],
            stuck_reason="2 consecutive incorrect answers",
            mastery=[
                AdaptiveMasteryState(
                    concept_id="directional_adhesion",
                    p_known=0.28,
                    attempts_count=3,
                    correct_count=1,
                )
            ],
            telemetry=AdaptiveTelemetrySummary(
                stuck_events=1,
                consecutive_wrong=2,
                hint_requests=2,
                practice_attempts=3,
                correct_attempts=1,
                affect_confused=1,
            ),
        )
    )

    assert response.learner_state.readiness == "support"
    assert response.primary_recommendation.action == "explain"
    assert response.primary_recommendation.focus_concepts == ["directional_adhesion"]


def test_adaptive_recommendation_allows_advancing_when_mastery_is_stable():
    response = build_adaptive_recommendation(
        AdaptiveRecommendationRequest(
            section_id="bio-inspired/02/01",
            section_title="Shark Skin Drag Reduction",
            concept_ids=["fluid_dynamics"],
            mastery=[
                AdaptiveMasteryState(
                    concept_id="fluid_dynamics",
                    p_known=0.91,
                    attempts_count=5,
                    correct_count=5,
                )
            ],
            telemetry=AdaptiveTelemetrySummary(
                practice_attempts=4,
                correct_attempts=4,
                affect_insight=1,
                affect_engaged=1,
            ),
        )
    )

    assert response.learner_state.readiness == "advance"
    assert response.primary_recommendation.action == "advance"
    assert response.reasoning.action_scores["advance"] >= response.reasoning.action_scores["explain"]


def test_adaptive_recommendation_prefers_representation_for_idle_reentry():
    response = build_adaptive_recommendation(
        AdaptiveRecommendationRequest(
            section_id="bio-inspired/03/02",
            section_title="Lotus Effect",
            concept_ids=["surface_energy"],
            stuck_reason="idle for 95 seconds",
            mastery=[
                AdaptiveMasteryState(
                    concept_id="surface_energy",
                    p_known=0.57,
                    attempts_count=4,
                    correct_count=2,
                )
            ],
            telemetry=AdaptiveTelemetrySummary(
                idle_events=1,
                practice_attempts=2,
                correct_attempts=1,
                affect_engaged=1,
            ),
        )
    )

    assert response.primary_recommendation.action == "represent"
    assert response.reasoning.policy_strategy == "heuristic_bandit_v2"
    assert response.reasoning.action_scores["represent"] >= response.reasoning.action_scores["practice"]
