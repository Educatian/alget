"""Offline tests for the Simulation Lab research view (fake Supabase, no network)."""
import httpx
import pytest

import study_lab_progress as slp
from study_enrollment import StudyEnrollmentError, SupabaseAdmin


def ev(user, etype, target, ts, data=None):
    return {"user_id": user, "event_type": etype, "event_target": target, "client_ts": ts, "event_data": data or {}}


def trial(user, target, ts, n, available=4, **extra):
    # Real trial events carry no settings: input_value is 0.
    return ev(user, "sim_unity_trial_completed", target, ts,
              {"opportunities_completed": n, "opportunities_available": available, "input_value": 0, **extra})


def change(user, target, ts):
    return {"user_id": user, "event_type": "sim_unity_input_changed", "event_target": target, "client_ts": ts}


def test_rule_counts_designs_from_input_changes_between_trials():
    g = "geckogrip-unity"
    varied = [change("u", g, "01"), trial("u", g, "02", 1, prediction="SLIP RISK", result="CONTACT LOSS"),
              change("u", g, "03"), trial("u", g, "04", 2), change("u", g, "05"), trial("u", g, "06", 3),
              change("u", g, "07"), trial("u", g, "08", 4)]
    p = slp.compute_lab_progress(varied, 4)
    assert p["complete"] is True and p["distinct_designs"] == 4 and p["goal_met"] is False

    same = [change("u", g, "01")] + [trial("u", g, f"0{i}", i) for i in range(1, 5)]
    assert slp.compute_lab_progress(same, 4)["complete"] is False

    no_inputs = [trial("u", g, f"0{i}", i) for i in range(1, 5)]
    assert slp.compute_lab_progress(no_inputs, 4)["complete"] is True


def test_real_run_shape_repeated_trial_numbers_and_extra_runs():
    g = "geckogrip-unity"
    events = [change("u", g, "21:23:58"), trial("u", g, "21:24:23", 1), trial("u", g, "21:24:55", 1),
              change("u", g, "21:25:00"), trial("u", g, "21:25:15", 2, prediction="SECURE GRIP", result="SECURE GRIP"),
              change("u", g, "21:25:30"), trial("u", g, "21:25:36", 3), change("u", g, "21:26:00"),
              trial("u", g, "21:26:14", 4), trial("u", g, "21:26:18", 4), trial("u", g, "21:26:21", 4)]
    p = slp.compute_lab_progress(events, 4)
    assert p["complete"] is True and p["trials_done"] == 4 and p["predictions_matched"] == 1 and p["goal_met"] is True


def test_summary_by_study_id_with_completion_time_and_tie_order():
    roster = [{"user_id": "u1", "learner_hash": "BIO-AAAA-AAAA", "cohort_id": "study-bio"},
              {"user_id": "u2", "learner_hash": "BIO-BBBB-BBBB", "cohort_id": "study-bio"},
              {"user_id": "u3", "learner_hash": "BAS-CCCC-CCCC", "cohort_id": "study-basic"}]
    g = "geckogrip-unity"
    # Trials listed before their same-millisecond input changes, as the report's two queries return them.
    events = [ev("u1", "sim_lab_chosen", "geckogrip", "10:00")]
    events += [trial("u1", g, f"10:0{i}", i) for i in range(1, 5)]
    events += [change("u1", g, f"10:0{i}") for i in range(1, 5)]
    events += [ev("u2", "sim_lab_chosen", "pinemorph", "11:00"),
               trial("u2", "pinemorph", "11:05", 1, available=5), ev("u2", "sim_lab_stuck", "pinemorph", "11:06")]
    rows = {r["study_id"]: r for r in slp.summarize(roster, events)}

    assert rows["BIO-AAAA-AAAA"]["lab"] == "geckogrip" and rows["BIO-AAAA-AAAA"]["complete"] is True
    assert rows["BIO-AAAA-AAAA"]["distinct_designs"] == 4 and rows["BIO-AAAA-AAAA"]["completed_at"] == "10:04"
    assert rows["BIO-BBBB-BBBB"]["lab"] == "pinemorph" and rows["BIO-BBBB-BBBB"]["trials_done"] == 1
    assert rows["BIO-BBBB-BBBB"]["complete"] is False and rows["BIO-BBBB-BBBB"]["stuck_count"] == 1
    assert rows["BAS-CCCC-CCCC"]["track"] == "basic" and rows["BAS-CCCC-CCCC"]["lab"] is None


def admin_with(handler):
    return SupabaseAdmin(url="https://x.supabase.co", service_key="k", client=httpx.Client(transport=httpx.MockTransport(handler)))


def test_report_refuses_non_researchers():
    def handler(request):
        if request.url.path.endswith("/rpc/can_access_research_console"):
            return httpx.Response(200, json=False)
        return httpx.Response(500)
    with pytest.raises(StudyEnrollmentError) as denied:
        slp.lab_progress_report("token", admin_with(handler))
    assert denied.value.status_code == 403


def test_report_pages_past_the_row_limit():
    roster = [{"user_id": "u1", "learner_hash": "BIO-AAAA-AAAA", "cohort_id": "study-bio"}]
    f = "fingrip"
    trials = [trial("u1", f, f"t{i:04d}b", i, available=5) for i in range(1, 6)]
    inputs = [change("u1", f, f"t{i:04d}a") for i in range(1, 2500)]  # more than one page

    def handler(request):
        path, q = request.url.path, request.url.params
        if path.endswith("/rpc/can_access_research_console"):
            assert request.headers["authorization"] == "Bearer token"  # checked as the caller, not the service role
            return httpx.Response(200, json=True)
        if path.endswith("/cohort_learners"):
            return httpx.Response(200, json=roster)
        if path.endswith("/event_logs"):
            source = inputs if q["event_type"] == "eq.sim_unity_input_changed" else trials
            offset, limit = int(q["offset"]), int(q["limit"])
            return httpx.Response(200, json=source[offset:offset + limit])
        return httpx.Response(404)

    (row,) = slp.lab_progress_report("token", admin_with(handler))
    assert row["study_id"] == "BIO-AAAA-AAAA" and row["lab"] == "fingrip" and row["complete"] is True
    assert row["distinct_designs"] == 5
