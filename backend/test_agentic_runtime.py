from datetime import date

import pytest

from agentic_runtime import (
    build_intervention_proposal,
    build_learner_plan,
    evaluate_tool_action,
    validate_transition,
)


def test_study_plan_prioritizes_low_mastery_and_preserves_learner_control():
    plan = build_learner_plan(
        course_id="statics",
        goal_title="Prepare for equilibrium quiz",
        target_date=date(2026, 8, 5),
        target_mastery=0.8,
        weekly_minutes=180,
        start_date=date(2026, 7, 30),
        mastery=[
            {"concept_id": "friction", "mastery_score": 0.7, "attempts_count": 4},
            {"concept_id": "equilibrium", "mastery_score": 0.35, "attempts_count": 2},
        ],
    )

    assert plan["focus_concepts"][0]["concept_id"] == "equilibrium"
    assert plan["sessions"][0]["why_now"].startswith("Current mastery evidence is 35%")
    assert plan["learner_control"]["requires_approval"] is True
    assert plan["evidence"]["causal_claim"] is False


def test_study_plan_rejects_past_deadline():
    with pytest.raises(ValueError, match="target_date"):
        build_learner_plan(
            course_id="statics",
            goal_title="Past goal",
            target_date=date(2026, 7, 29),
            target_mastery=0.8,
            weekly_minutes=180,
            mastery=[],
            start_date=date(2026, 7, 30),
        )


def test_intervention_is_a_draft_not_an_execution():
    proposal = build_intervention_proposal(
        course_id="statics",
        concept_id="free-body-diagrams",
        learner_count=7,
        average_mastery=0.38,
        target_user_ids=["learner-1"],
    )

    assert proposal["evidence"]["urgency"] == "urgent"
    assert proposal["delivery"] == {"executed": False, "requires_instructor_approval": True}


def test_tool_policy_blocks_unapproved_or_unimplemented_actions():
    assert evaluate_tool_action("study_plan.write_own", "learner")["reason"] == "approval_required"
    assert evaluate_tool_action("study_plan.write_own", "learner", approved=True)["allowed"] is True
    assert evaluate_tool_action("grade.finalize", "instructor", approved=True)["reason"] == "execution_not_implemented"


def test_workflow_transition_requires_approval():
    assert validate_transition("awaiting_approval", "active")["reason"] == "approval_required"
    assert validate_transition("awaiting_approval", "active", approved=True)["allowed"] is True
    assert validate_transition("completed", "active")["allowed"] is False
