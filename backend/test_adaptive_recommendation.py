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


def test_adaptive_recommendation_uses_annotation_and_artifact_evidence():
    response = build_adaptive_recommendation(
        AdaptiveRecommendationRequest(
            section_id="cat100-supplement/01/06",
            section_title="Critique AI Suggestions Against Evidence",
            concept_ids=["artifact_evidence"],
            mastery=[
                AdaptiveMasteryState(
                    concept_id="artifact_evidence",
                    p_known=0.7,
                    attempts_count=4,
                    correct_count=3,
                )
            ],
            telemetry=AdaptiveTelemetrySummary(
                practice_attempts=3,
                correct_attempts=2,
                annotation_questions=2,
                annotation_confusions=2,
                annotation_helpful_reactions=3,
                artifact_trace_count=1,
                artifact_quality_average=0.25,
                artifact_trace_completeness=0.4,
            ),
        )
    )

    assert "annotation_friction" in response.reasoning.evidence_snapshot
    assert "artifact_gap" in response.reasoning.evidence_snapshot
    assert any(code in response.reasoning.reason_codes for code in ["annotation_friction", "artifact_quality_gap"])
    assert response.primary_recommendation.action != "advance"
