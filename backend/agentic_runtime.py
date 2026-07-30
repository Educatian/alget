"""Deterministic, auditable primitives for ALGET's agentic LMS runtime.

The runtime deliberately separates planning from execution.  These functions
produce bounded plans and permission decisions; durable state and approvals are
stored by the Supabase workflow tables.  No function in this module sends a
message, publishes content, changes enrollment, or writes a grade.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any


WORKFLOW_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"awaiting_approval", "cancelled"},
    "awaiting_approval": {"active", "cancelled", "blocked"},
    "active": {"paused", "completed", "blocked", "cancelled"},
    "paused": {"active", "cancelled"},
    "blocked": {"awaiting_approval", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}


TOOL_REGISTRY: list[dict[str, Any]] = [
    {
        "id": "course.read",
        "label": "Read course content",
        "risk": "low",
        "roles": ["learner", "instructor", "course_admin", "admin"],
        "approval": "none",
    },
    {
        "id": "mastery.read_own",
        "label": "Read own mastery evidence",
        "risk": "low",
        "roles": ["learner"],
        "approval": "none",
    },
    {
        "id": "study_plan.write_own",
        "label": "Draft or revise own study plan",
        "risk": "low",
        "roles": ["learner"],
        "approval": "learner",
    },
    {
        "id": "cohort.aggregate.read",
        "label": "Read cohort-level learning signals",
        "risk": "medium",
        "roles": ["instructor", "course_admin", "admin"],
        "approval": "none",
    },
    {
        "id": "intervention.draft",
        "label": "Draft a cohort intervention",
        "risk": "medium",
        "roles": ["instructor", "course_admin", "admin"],
        "approval": "instructor",
    },
    {
        "id": "learner.message",
        "label": "Send a learner communication",
        "risk": "high",
        "roles": ["instructor", "course_admin", "admin"],
        "approval": "instructor",
        "executable": False,
    },
    {
        "id": "grade.finalize",
        "label": "Finalize a grade",
        "risk": "high",
        "roles": ["instructor"],
        "approval": "instructor",
        "executable": False,
    },
    {
        "id": "content.publish",
        "label": "Publish course content",
        "risk": "high",
        "roles": ["course_admin", "admin"],
        "approval": "course_admin",
        "executable": False,
    },
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def evaluate_tool_action(tool_id: str, actor_role: str, approved: bool = False) -> dict[str, Any]:
    """Return a policy decision without executing the requested tool."""
    tool = next((entry for entry in TOOL_REGISTRY if entry["id"] == tool_id), None)
    if not tool:
        return {"allowed": False, "reason": "unknown_tool", "tool_id": tool_id}
    if actor_role not in tool["roles"]:
        return {"allowed": False, "reason": "role_not_permitted", "tool": tool}
    if tool.get("executable") is False:
        return {"allowed": False, "reason": "execution_not_implemented", "tool": tool}
    if tool["approval"] != "none" and not approved:
        return {"allowed": False, "reason": "approval_required", "tool": tool}
    return {"allowed": True, "reason": "policy_passed", "tool": tool}


def validate_transition(current: str, target: str, *, approved: bool = False) -> dict[str, Any]:
    """Validate a workflow transition and make the approval gate explicit."""
    allowed_targets = WORKFLOW_TRANSITIONS.get(current)
    if allowed_targets is None:
        return {"allowed": False, "reason": "unknown_current_status"}
    if target not in allowed_targets:
        return {"allowed": False, "reason": "invalid_transition"}
    if current == "awaiting_approval" and target == "active" and not approved:
        return {"allowed": False, "reason": "approval_required"}
    return {"allowed": True, "reason": "transition_allowed"}


def build_learner_plan(
    *,
    course_id: str,
    goal_title: str,
    target_date: date,
    target_mastery: float,
    weekly_minutes: int,
    mastery: list[dict[str, Any]],
    start_date: date | None = None,
) -> dict[str, Any]:
    """Build a one-week learner-controlled plan from explicit mastery evidence."""
    start = start_date or date.today()
    if target_date < start:
        raise ValueError("target_date must be today or later")
    if not 0.5 <= target_mastery <= 1.0:
        raise ValueError("target_mastery must be between 0.5 and 1.0")
    if not 60 <= weekly_minutes <= 1200:
        raise ValueError("weekly_minutes must be between 60 and 1200")

    normalized = []
    for row in mastery:
        concept_id = str(row.get("concept_id") or "").strip()
        if not concept_id:
            continue
        score = float(row.get("mastery_score", row.get("p_known", 0.0)) or 0.0)
        normalized.append({
            "concept_id": concept_id,
            "mastery": max(0.0, min(1.0, score)),
            "attempts": int(row.get("attempts_count", 0) or 0),
        })
    normalized.sort(key=lambda item: (item["mastery"], item["attempts"], item["concept_id"]))
    focus = [item for item in normalized if item["mastery"] < target_mastery]
    if not focus:
        focus = normalized[:3] or [{"concept_id": "course-foundations", "mastery": 0.0, "attempts": 0}]

    session_count = max(3, min(7, round(weekly_minutes / 35)))
    session_minutes = max(20, min(50, weekly_minutes // session_count))
    days_available = max(1, min(7, (target_date - start).days + 1))
    sessions = []
    for index in range(session_count):
        concept = focus[index % len(focus)]
        offset = round(index * max(0, days_available - 1) / max(1, session_count - 1))
        mode = ["explain", "worked-example", "retrieval-practice", "teach-back"][index % 4]
        sessions.append({
            "id": f"session-{index + 1}",
            "scheduled_for": (start + timedelta(days=offset)).isoformat(),
            "minutes": session_minutes,
            "concept_id": concept["concept_id"],
            "mode": mode,
            "actions": [
                "Review the learning objective and one canonical example",
                f"Complete a {mode.replace('-', ' ')} activity",
                "Record confidence before checking feedback",
                "Finish with one retrieval question",
            ],
            "why_now": (
                f"Current mastery evidence is {round(concept['mastery'] * 100)}% "
                f"from {concept['attempts']} recorded attempt(s), below the {round(target_mastery * 100)}% goal."
            ),
        })

    return {
        "schema_version": "agentic-study-plan-v1",
        "course_id": course_id,
        "goal": goal_title.strip(),
        "target_date": target_date.isoformat(),
        "target_mastery": target_mastery,
        "weekly_minutes": weekly_minutes,
        "generated_at": utc_now(),
        "planning_horizon": {"starts_on": start.isoformat(), "days": days_available},
        "focus_concepts": focus[:8],
        "sessions": sessions,
        "evidence": {
            "source": "learner_mastery_snapshot",
            "concept_count": len(normalized),
            "weak_concept_count": len([item for item in normalized if item["mastery"] < target_mastery]),
            "causal_claim": False,
        },
        "learner_control": {
            "requires_approval": True,
            "can_edit": True,
            "can_pause": True,
            "can_cancel": True,
            "memory_scope": "learner-owned",
        },
    }


def build_intervention_proposal(
    *,
    course_id: str,
    concept_id: str,
    learner_count: int,
    average_mastery: float,
    target_user_ids: list[str] | None = None,
) -> dict[str, Any]:
    """Prepare, but never deliver, an evidence-backed instructor intervention."""
    if learner_count < 1:
        raise ValueError("learner_count must be positive")
    average = max(0.0, min(1.0, float(average_mastery)))
    urgency = "urgent" if average < 0.4 else "monitor"
    return {
        "schema_version": "agentic-intervention-v1",
        "course_id": course_id,
        "concept_id": concept_id,
        "title": f"Re-teach {concept_id.replace('_', ' ').replace('-', ' ')}",
        "summary": (
            f"Prepare a short compare-and-correct activity for {learner_count} learner(s); "
            "do not send or grade automatically."
        ),
        "recommended_actions": [
            "Open with one diagnostic contrast example",
            "Ask learners to explain the difference before feedback",
            "Assign one low-stakes retrieval check",
            "Review the next evidence snapshot before further action",
        ],
        "evidence": {
            "learner_count": learner_count,
            "average_mastery": round(average, 4),
            "threshold": 0.6,
            "urgency": urgency,
            "causal_claim": False,
        },
        "target_user_ids": target_user_ids or [],
        "risk_level": "medium",
        "delivery": {"executed": False, "requires_instructor_approval": True},
        "generated_at": utc_now(),
    }
