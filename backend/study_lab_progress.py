"""Research view of Simulation Lab progress, by Study ID (for completion and gift-card checks).

The completion rule mirrors frontend/src/lib/labProgress.js and is recomputed
here from the recorded trial events (event_logs), so it does not depend on
the browser's own "completed" record. Researchers only: the caller's Supabase
token must pass public.can_access_research_console().
"""
from __future__ import annotations

import re
from typing import Any

from study_enrollment import STUDY_TRACKS, StudyEnrollmentError, SupabaseAdmin

# simId used in event_logs -> lab id and required trials
LABS = {
    "fingrip": ("fingrip", 5),
    "trabecula": ("trabecula", 5),
    "geckogrip-unity": ("geckogrip", 4),
    "pinemorph": ("pinemorph", 5),
}
GOAL_RESULTS = re.compile(r"^(pass|passed|balanced|secure_?grip|success|safe)$", re.I)
EVENT_TYPES = ("sim_lab_chosen", "sim_unity_trial_completed", "sim_unity_final_design_submitted",
               "sim_lab_completed", "sim_lab_stuck")
INPUT_EVENT = "sim_unity_input_changed"
PAGE_SIZE = 1000  # Supabase's default maximum rows per request


def _norm(value: Any) -> str:
    return re.sub(r"[\s-]+", "_", str(value or "").strip().lower())


def compute_lab_progress(events: list[dict[str, Any]], required_trials: int) -> dict[str, Any]:
    """events: one lab's events, oldest first, each {"event_type", "event_data"}.

    Trial events carry no design settings, so a trial is a new design when an
    input changed since the previous trial (same rule as labProgress.js).
    """
    trials = [e.get("event_data") or {} for e in events if e["event_type"] == "sim_unity_trial_completed"]
    reported_done = max([int(t.get("opportunities_completed") or 0) for t in trials] + [0])
    reported_available = max([int(t.get("opportunities_available") or 0) for t in trials] + [0])
    required = reported_available or required_trials
    trials_done = reported_done or len(trials)

    designs_known = any(e["event_type"] == INPUT_EVENT for e in events)
    distinct, changed = 0, False
    for e in events:
        if e["event_type"] == INPUT_EVENT:
            changed = True
        elif e["event_type"] == "sim_unity_trial_completed":
            if distinct == 0 or changed:
                distinct += 1
            changed = False
    if not designs_known:
        distinct = len(trials)

    both = [t for t in trials if t.get("prediction") and t.get("result")]
    return {
        "trials_done": trials_done,
        "required": required,
        "distinct_designs": distinct,
        "designs_known": designs_known,
        "predictions_matched": sum(_norm(t["prediction"]) == _norm(t["result"]) for t in both),
        "predictions_compared": len(both),
        "goal_met": any(GOAL_RESULTS.match(_norm(t.get("result"))) for t in trials),
        "final_design_submitted": any(e["event_type"] == "sim_unity_final_design_submitted" for e in events),
        "complete": trials_done >= required and (not designs_known or distinct >= min(2, required)),
    }


def summarize(roster: list[dict[str, Any]], events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_user: dict[str, list[dict[str, Any]]] = {}
    for e in events:
        by_user.setdefault(e["user_id"], []).append(e)
    track_by_cohort = {spec["cohort_id"]: track for track, spec in STUDY_TRACKS.items()}

    rows = []
    for learner in roster:
        # Same-millisecond ties: the bridge records a settled input just before its trial.
        evs = sorted(by_user.get(learner["user_id"], []),
                     key=lambda e: (e.get("client_ts") or "", e["event_type"] != INPUT_EVENT))
        chosen = [e["event_target"] for e in evs if e["event_type"] == "sim_lab_chosen"]
        row = {
            "study_id": learner["learner_hash"],
            "track": track_by_cohort.get(learner["cohort_id"], learner["cohort_id"]),
            "lab": None, "trials_done": 0, "required": None, "distinct_designs": 0, "complete": False,
            "completed_at": None, "goal_met": False, "stuck_count": sum(e["event_type"] == "sim_lab_stuck" for e in evs),
            "last_activity": evs[-1]["client_ts"] if evs else None,
        }
        # Evaluate every lab with trials; report the completed one, else the most recently chosen/used.
        per_lab = {}
        for sim_id, (lab_id, required) in LABS.items():
            lab_evs = [e for e in evs if e["event_target"] == sim_id]
            trial_idx = [i for i, e in enumerate(lab_evs) if e["event_type"] == "sim_unity_trial_completed"]
            if not trial_idx:
                continue
            progress = compute_lab_progress(lab_evs, required)
            done_at = None
            if progress["complete"]:  # timestamp of the trial that met the requirement
                for i in trial_idx:
                    if compute_lab_progress(lab_evs[:i + 1], required)["complete"]:
                        done_at = lab_evs[i]["client_ts"]
                        break
            per_lab[lab_id] = {**progress, "completed_at": done_at}
        pick = next((lab for lab, p in per_lab.items() if p["complete"]), None)
        pick = pick or (chosen[-1] if chosen and chosen[-1] in per_lab else (chosen[-1] if chosen else None))
        pick = pick or (next(iter(per_lab)) if per_lab else None)
        if pick:
            row["lab"] = pick
            if pick in per_lab:
                p = per_lab[pick]
                row.update({k: p[k] for k in ("trials_done", "required", "distinct_designs", "complete", "completed_at", "goal_met")})
        rows.append(row)
    return sorted(rows, key=lambda r: (r["track"], r["study_id"]))


def _fetch_all(admin: SupabaseAdmin, params: dict[str, str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    while True:
        r = admin.http.get(f"{admin.url}/rest/v1/event_logs", headers=admin._headers(),
                           params={**params, "order": "client_ts.asc,id.asc", "limit": str(PAGE_SIZE), "offset": str(len(rows))})
        if r.status_code != 200:
            raise StudyEnrollmentError(502, "Could not load lab activity.")
        page = r.json()
        rows += page
        if len(page) < PAGE_SIZE:
            return rows


def lab_progress_report(access_token: str, admin: SupabaseAdmin) -> list[dict[str, Any]]:
    if not access_token:
        raise StudyEnrollmentError(401, "Please sign in first.")
    r = admin.http.post(f"{admin.url}/rest/v1/rpc/can_access_research_console",
                        headers={"apikey": admin.key, "Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                        json={})
    if r.status_code != 200 or r.json() is not True:
        raise StudyEnrollmentError(403, "Research access is required.")

    cohorts = ",".join(spec["cohort_id"] for spec in STUDY_TRACKS.values())
    r = admin.http.get(f"{admin.url}/rest/v1/cohort_learners", headers=admin._headers(),
                       params={"cohort_id": f"in.({cohorts})", "select": "user_id,learner_hash,cohort_id", "limit": "5000"})
    if r.status_code != 200:
        raise StudyEnrollmentError(502, "Could not load the study roster.")
    roster = r.json()
    if not roster:
        return []

    events: list[dict[str, Any]] = []
    ids = [row["user_id"] for row in roster]
    for start in range(0, len(ids), 100):
        users = f"in.({','.join(ids[start:start + 100])})"
        events += _fetch_all(admin, {"user_id": users, "event_type": f"in.({','.join(EVENT_TYPES)})",
                                     "select": "user_id,event_type,event_target,event_data,client_ts"})
        # Input changes only matter for their timing, so skip their payloads.
        events += _fetch_all(admin, {"user_id": users, "event_type": f"eq.{INPUT_EVENT}",
                                     "select": "user_id,event_type,event_target,client_ts"})
    return summarize(roster, events)
