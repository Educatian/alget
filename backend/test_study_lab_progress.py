"""Offline tests for the Simulation Lab research view (fake Supabase, no network)."""
import json

import httpx
import pytest

import study_lab_progress as slp
from study_enrollment import StudyEnrollmentError, SupabaseAdmin


def trial(value, **extra):
    return {"input_name": "rib", "input_value": value, **extra}


def test_rule_requires_trials_and_two_designs_but_not_the_goal():
    five_varied = [trial(n, prediction="PASS", result="SLIP") for n in range(5)]
    assert slp.compute_lab_progress(five_varied, 5)["complete"] is True
    assert slp.compute_lab_progress(five_varied, 5)["goal_met"] is False
    same = [trial(1) for _ in range(5)]
    assert slp.compute_lab_progress(same, 5)["complete"] is False
    assert slp.compute_lab_progress(five_varied[:3], 5)["complete"] is False
    unknown = [{"prediction": "secure grip", "result": "SECURE_GRIP"} for _ in range(4)]
    p = slp.compute_lab_progress(unknown, 4)
    assert p["complete"] is True and p["designs_known"] is False and p["goal_met"] is True


def ev(user, etype, target, ts, data=None):
    return {"user_id": user, "event_type": etype, "event_target": target, "client_ts": ts, "event_data": data or {}}


def test_summary_by_study_id():
    roster = [{"user_id": "u1", "learner_hash": "BIO-AAAA-AAAA", "cohort_id": "study-bio"},
              {"user_id": "u2", "learner_hash": "BIO-BBBB-BBBB", "cohort_id": "study-bio"},
              {"user_id": "u3", "learner_hash": "BAS-CCCC-CCCC", "cohort_id": "study-basic"}]
    events = [ev("u1", "sim_lab_chosen", "geckogrip", "2026-10-03T10:00")]
    events += [ev("u1", "sim_unity_trial_completed", "geckogrip-unity", f"2026-10-03T10:0{i + 1}", trial(i)) for i in range(4)]
    events += [ev("u2", "sim_lab_chosen", "pinemorph", "2026-10-03T11:00"),
               ev("u2", "sim_unity_trial_completed", "pinemorph", "2026-10-03T11:05", trial(1)),
               ev("u2", "sim_lab_stuck", "pinemorph", "2026-10-03T11:06")]
    rows = {r["study_id"]: r for r in slp.summarize(roster, events)}

    assert rows["BIO-AAAA-AAAA"]["lab"] == "geckogrip" and rows["BIO-AAAA-AAAA"]["complete"] is True
    assert rows["BIO-AAAA-AAAA"]["completed_at"] == "2026-10-03T10:04"
    assert rows["BIO-BBBB-BBBB"]["lab"] == "pinemorph" and rows["BIO-BBBB-BBBB"]["trials_done"] == 1
    assert rows["BIO-BBBB-BBBB"]["complete"] is False and rows["BIO-BBBB-BBBB"]["stuck_count"] == 1
    assert rows["BAS-CCCC-CCCC"]["track"] == "basic" and rows["BAS-CCCC-CCCC"]["lab"] is None


def test_report_refuses_non_researchers():
    def handler(request):
        if request.url.path.endswith("/rpc/can_access_research_console"):
            return httpx.Response(200, json=False)
        return httpx.Response(500)
    admin = SupabaseAdmin(url="https://x.supabase.co", service_key="k", client=httpx.Client(transport=httpx.MockTransport(handler)))
    with pytest.raises(StudyEnrollmentError) as denied:
        slp.lab_progress_report("token", admin)
    assert denied.value.status_code == 403


def test_report_for_researcher():
    roster = [{"user_id": "u1", "learner_hash": "BIO-AAAA-AAAA", "cohort_id": "study-bio"}]
    events = [ev("u1", "sim_unity_trial_completed", "fingrip", f"t{i}", trial(i)) for i in range(5)]

    def handler(request):
        path = request.url.path
        if path.endswith("/rpc/can_access_research_console"):
            assert request.headers["authorization"] == "Bearer token"  # checked as the caller, not the service role
            return httpx.Response(200, json=True)
        if path.endswith("/cohort_learners"):
            return httpx.Response(200, json=roster)
        if path.endswith("/event_logs"):
            return httpx.Response(200, json=events)
        return httpx.Response(404)
    admin = SupabaseAdmin(url="https://x.supabase.co", service_key="k", client=httpx.Client(transport=httpx.MockTransport(handler)))
    (row,) = slp.lab_progress_report("token", admin)
    assert row["study_id"] == "BIO-AAAA-AAAA" and row["lab"] == "fingrip" and row["complete"] is True
