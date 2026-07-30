# Agentic LMS runtime

ALGET's agentic layer turns learning evidence into reviewable plans. It does not give an LLM open-ended authority over learners, courses, or grades.

## Product workflows

### Learner study planner

1. The learner defines a goal, course, deadline, mastery target, and weekly time budget.
2. `POST /api/agentic/learner-plan` ranks current mastery evidence and drafts a bounded weekly plan.
3. The plan and evidence snapshot are persisted as an `agent_workflow` and `learner_study_plan` in `awaiting_approval`.
4. Only the owning learner can approve or cancel the plan through `review_learner_plan`.
5. The plan remains editable, pausable, and cancellable. Its memory scope is learner-owned.

### Instructor intervention queue

1. The instructor dashboard aggregates cohort mastery signals.
2. `POST /api/agentic/interventions/propose` creates a re-teaching proposal with concept, cohort count, average mastery, urgency, and a non-causal evidence label.
3. The proposal is persisted in `instructor_intervention_queue` as `awaiting_approval`.
4. An instructor or course administrator approves or rejects it through `review_instructor_intervention`.
5. Approval records the decision. It does not send a message, publish content, or finalize a grade.

## State and audit model

Supported workflow transitions are deterministic:

```text
draft -> awaiting_approval -> active -> paused -> active
                     |            |              |
                     +----------> cancelled <----+
active -> completed
```

Every persisted transition writes an `agent_workflow_events` record with actor, prior state, next state, event type, detail, and timestamp. Authenticated clients receive read-only table grants; mutations go through role-checked, security-definer RPCs and their audit writes.

## Tool policy

The registry in `backend/agentic_runtime.py` declares each tool's scope, risk, required role, approval owner, and execution availability. The policy evaluator is default-deny:

- Low risk: reading approved course content or one's own mastery evidence.
- Medium risk: drafting cohort interventions; instructor approval is required.
- High risk: learner messaging, publishing, enrollment changes, and final grades. These are deliberately unavailable for autonomous execution.

The runtime is deterministic today. A future model may propose the plan body, but it must pass the same schema, permission, transition, approval, and audit boundaries.

## Deployment

Apply `supabase/migrations/20260730100000_agentic_lms_runtime.sql` after the administrative control-plane migration. Then verify:

1. unauthenticated table reads are rejected;
2. learners can create and review only their own plans;
3. instructors can create and review interventions only with an instructor role;
4. workflow events preserve previous and next state;
5. approving an intervention produces no delivery or grading side effect.

Offline/demo mode mirrors the same states in `localStorage` under `alget_agentic_lms_v1`, so the UX can be evaluated without cloud persistence.
