"""Destructive-in-staging QA for ALGET engineering assignment, RLS, and export.

The script refuses the production Supabase project, requires an explicit
staging acknowledgement, creates only synthetic fixtures, and removes them in
a finally block. Secrets, passwords, emails, and bearer tokens are never
written to the report.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import secrets
import sys
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote, urlencode, urlparse
from urllib.request import Request, urlopen


PRODUCTION_PROJECT_REF = "tyyjkkykcggukfbkwpia"
STUDY_EXPERIMENT = "alget-bio-inspired-agentic-rct-v1"
STUDY_COHORT = "bio-inspired-intervention-2026"
STUDY_COURSE = "bio-inspired"
HEX64 = re.compile(r"^[0-9a-f]{64}$")


def project_ref_from_url(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    suffix = ".supabase.co"
    return host[: -len(suffix)] if host.endswith(suffix) else ""


def assert_staging_target(url: str, acknowledged: bool) -> str:
    if not acknowledged:
        raise ValueError("--acknowledge-staging is required")
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if host in {"127.0.0.1", "localhost", "::1"}:
        if parsed.scheme != "http":
            raise ValueError("local Supabase QA must use an http loopback URL")
        return "local-alget"
    project_ref = project_ref_from_url(url)
    if not project_ref:
        raise ValueError(
            "ALGET_STAGING_SUPABASE_URL must be a project https://<ref>.supabase.co "
            "URL or an http loopback URL"
        )
    if project_ref == PRODUCTION_PROJECT_REF:
        raise ValueError("refusing to run destructive QA against the ALGET production project")
    return project_ref


@dataclass
class Result:
    status: int
    body: object


class SupabaseHttp:
    def __init__(self, base_url: str, anon_key: str, service_key: str):
        self.base_url = base_url.rstrip("/")
        self.anon_key = anon_key
        self.service_key = service_key

    def request(self, method: str, path: str, *, bearer: str, api_key: str, payload=None, prefer=None) -> Result:
        headers = {
            "apikey": api_key,
            "Authorization": f"Bearer {bearer}",
            "Accept": "application/json",
        }
        data = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(payload).encode("utf-8")
        if prefer:
            headers["Prefer"] = prefer
        request = Request(self.base_url + path, data=data, headers=headers, method=method)
        try:
            with urlopen(request, timeout=30) as response:
                raw = response.read()
                return Result(response.status, json.loads(raw) if raw else None)
        except HTTPError as error:
            raw = error.read()
            try:
                body = json.loads(raw) if raw else None
            except json.JSONDecodeError:
                body = None
            return Result(error.code, body)

    def admin(self, method: str, path: str, payload=None) -> Result:
        return self.request(method, path, bearer=self.service_key, api_key=self.service_key, payload=payload)

    def service_rest(self, method: str, path: str, payload=None, prefer=None) -> Result:
        return self.request(method, path, bearer=self.service_key, api_key=self.service_key, payload=payload, prefer=prefer)

    def user_rest(self, method: str, path: str, access_token: str, payload=None, prefer=None) -> Result:
        return self.request(method, path, bearer=access_token, api_key=self.anon_key, payload=payload, prefer=prefer)

    def anon_rest(self, method: str, path: str) -> Result:
        return self.request(method, path, bearer=self.anon_key, api_key=self.anon_key)

    def create_user(self, email: str, password: str, role: str | None = None) -> str:
        body = {"email": email, "password": password, "email_confirm": True}
        if role:
            body["app_metadata"] = {"role": role}
        result = self.admin("POST", "/auth/v1/admin/users", body)
        if result.status not in (200, 201) or not isinstance(result.body, dict) or not result.body.get("id"):
            raise RuntimeError(f"synthetic user creation failed with HTTP {result.status}")
        return result.body["id"]

    def sign_in(self, email: str, password: str) -> str:
        result = self.request(
            "POST", "/auth/v1/token?grant_type=password",
            bearer=self.anon_key, api_key=self.anon_key,
            payload={"email": email, "password": password},
        )
        if result.status != 200 or not isinstance(result.body, dict) or not result.body.get("access_token"):
            raise RuntimeError(f"synthetic sign-in failed with HTTP {result.status}")
        return result.body["access_token"]


def link_hash(study_id: str) -> str:
    return hashlib.sha256(f"alget-study-link-v1:{study_id.lower().strip()}".encode()).hexdigest()


def blocked(result: Result) -> bool:
    return result.status in (400, 401, 403, 404) or result.status == 200 and result.body == []


def require_http(result: Result, allowed: tuple[int, ...], operation: str):
    if result.status not in allowed:
        raise RuntimeError(f"{operation} failed with HTTP {result.status}")
    return result.body


def run_qa(api: SupabaseHttp, project_ref: str) -> dict:
    suffix = secrets.token_hex(6)
    users: list[str] = []
    sessions: list[str] = []
    study_hash = None
    checks: dict[str, bool] = {}
    cleanup_errors: list[str] = []

    def record(name: str, condition: bool):
        checks[name] = bool(condition)
        if not condition:
            raise RuntimeError(f"QA assertion failed: {name}")

    try:
        operator_email = f"alget-qa-operator-{suffix}@example.com"
        learner_email = f"alget-qa-learner-{suffix}@example.com"
        ordinary_email = f"alget-qa-ordinary-{suffix}@example.com"
        operator_password = secrets.token_urlsafe(24) + "Aa1!"
        learner_password = secrets.token_urlsafe(24) + "Aa1!"
        ordinary_password = secrets.token_urlsafe(24) + "Aa1!"

        operator_id = api.create_user(operator_email, operator_password, "course_admin")
        learner_id = api.create_user(learner_email, learner_password)
        ordinary_id = api.create_user(ordinary_email, ordinary_password)
        users.extend([operator_id, learner_id, ordinary_id])
        operator_token = api.sign_in(operator_email, operator_password)
        learner_token = api.sign_in(learner_email, learner_password)
        ordinary_token = api.sign_in(ordinary_email, ordinary_password)

        study_id = str(uuid.uuid4())
        study_hash = link_hash(study_id)
        seed_hash = hashlib.sha256(f"staging-seed:{suffix}".encode()).hexdigest()
        block = f"qa-{suffix}"

        anon_schedule = api.anon_rest("GET", "/rest/v1/engineering_study_allocation_schedule?select=study_link_hash&limit=1")
        record("anonymous_cannot_read_allocation_schedule", blocked(anon_schedule))

        self_insert = api.user_rest(
            "POST", "/rest/v1/cohort_learners", ordinary_token,
            payload={
                "user_id": ordinary_id, "display_name": "Synthetic Ordinary Learner",
                "cohort_id": STUDY_COHORT, "cohort_label": "Synthetic QA",
                "course_id": STUDY_COURSE, "learner_hash": str(uuid.uuid4()), "profile": {},
            },
            prefer="return=representation",
        )
        record("authenticated_user_cannot_self_enroll_research_roster", self_insert.status in (400, 401, 403))

        roster_body = {
            "user_id": learner_id,
            "display_name": "Synthetic Study Learner",
            "cohort_id": STUDY_COHORT,
            "cohort_label": "Synthetic Engineering QA",
            "course_id": STUDY_COURSE,
            "learner_hash": study_id,
            "profile": {"track": "research", "synthetic_qa": True},
            "email": learner_email,
            "status": "invited",
            "invited_by": operator_id,
            "invited_at": datetime.now(timezone.utc).isoformat(),
        }
        require_http(api.service_rest("POST", "/rest/v1/cohort_learners", roster_body, "return=representation"), (200, 201), "service roster insert")

        schedule_body = {
            "study_link_hash": study_hash,
            "experiment_key": STUDY_EXPERIMENT,
            "course_id": STUDY_COURSE,
            "course_section": "staging-qa",
            "baseline_band": "baseline_mid",
            "stratum_key": "staging-qa:baseline_mid",
            "assignment_arm": "treatment_annotation_adaptive",
            "allocation_block": block,
            "allocation_position": 1,
            "assignment_seed_hash": seed_hash,
        }
        require_http(api.service_rest("POST", "/rest/v1/engineering_study_allocation_schedule", schedule_body, "return=representation"), (200, 201), "service schedule insert")

        roster_filter = quote(study_id, safe="")
        ordinary_read = api.user_rest("GET", f"/rest/v1/cohort_learners?select=user_id&learner_hash=eq.{roster_filter}", ordinary_token)
        record("ordinary_authenticated_user_cannot_read_research_roster", ordinary_read.status == 200 and ordinary_read.body == [])
        operator_read = api.user_rest("GET", f"/rest/v1/cohort_learners?select=user_id&learner_hash=eq.{roster_filter}", operator_token)
        record("accountable_operator_can_read_restricted_research_roster", operator_read.status == 200 and len(operator_read.body or []) == 1)
        own_read = api.user_rest("GET", f"/rest/v1/cohort_learners?select=user_id&learner_hash=eq.{roster_filter}", learner_token)
        record("learner_can_read_own_research_roster_row", own_read.status == 200 and len(own_read.body or []) == 1)

        claim = api.user_rest("POST", "/rest/v1/rpc/claim_engineering_study_assignment", learner_token, payload={})
        claim_rows = require_http(claim, (200,), "first assignment claim")
        record("claim_returns_preprovisioned_treatment_arm", len(claim_rows or []) == 1 and claim_rows[0].get("assignment_arm") == "treatment_annotation_adaptive")
        first_assignment_hash = claim_rows[0].get("assignment_hash")
        record("claim_returns_nonsemantic_assignment_hash", bool(HEX64.fullmatch(first_assignment_hash or "")))

        repeat = api.user_rest("POST", "/rest/v1/rpc/claim_engineering_study_assignment", learner_token, payload={})
        repeat_rows = require_http(repeat, (200,), "repeat assignment claim")
        record("repeat_claim_is_idempotent", len(repeat_rows or []) == 1 and repeat_rows[0].get("assignment_hash") == first_assignment_hash)

        learner_schedule = api.user_rest("GET", "/rest/v1/engineering_study_allocation_schedule?select=*&limit=1", learner_token)
        record("learner_cannot_read_allocation_schedule", blocked(learner_schedule))
        learner_export = api.user_rest("GET", "/rest/v1/engineering_sim_event_export?select=*&limit=1", learner_token)
        record("learner_cannot_read_research_export", blocked(learner_export))
        service_schedule = api.service_rest("GET", f"/rest/v1/engineering_study_allocation_schedule?select=study_link_hash,claimed_user_id&study_link_hash=eq.{study_hash}")
        record("service_role_can_read_claimed_schedule", service_schedule.status == 200 and len(service_schedule.body or []) == 1 and service_schedule.body[0].get("claimed_user_id") == learner_id)

        experiments = require_http(api.service_rest("GET", f"/rest/v1/experiments?select=id&experiment_key=eq.{STUDY_EXPERIMENT}"), (200,), "experiment lookup")
        experiment_id = experiments[0]["id"]
        arms = require_http(api.service_rest("GET", f"/rest/v1/experiment_arms?select=id,arm_key&experiment_id=eq.{experiment_id}"), (200,), "arm lookup")
        comparison_arm_id = next(row["id"] for row in arms if row["arm_key"] == "comparison_practice_only")
        crossover = api.user_rest(
            "PATCH",
            f"/rest/v1/experiment_assignments?user_id=eq.{learner_id}&experiment_id=eq.{experiment_id}",
            learner_token,
            payload={"arm_id": comparison_arm_id},
            prefer="return=representation",
        )
        record("learner_cannot_mutate_persisted_arm", crossover.status in (400, 401, 403) or crossover.status == 200 and crossover.body == [])

        valid_session = str(uuid.uuid4())
        invalid_numeric_session = str(uuid.uuid4())
        ordinary_session = str(uuid.uuid4())
        other_course_session = str(uuid.uuid4())
        sessions.extend([valid_session, invalid_numeric_session, ordinary_session, other_course_session])

        def event(user_id: str, session_id: str, course_id: str, client_seq: int, data: dict):
            return {
                "user_id": user_id, "session_id": session_id, "course_id": course_id,
                "section_id": f"{course_id}/01/01", "event_type": "sim_unity_trial_completed",
                "client_seq": client_seq, "payload": {"data": data},
            }

        valid_event = event(learner_id, valid_session, STUDY_COURSE, 1, {
            "source_app": "fingrip", "source_schema": "bio-design-learning-event/1.0",
            "app_id": "fingriplab", "event_name": "trial_completed",
            "opportunity_index": 1, "opportunities_completed": 1, "opportunities_available": 5,
            "normalized_opportunity_progress": 0.2, "input_name": "modulus,rib_angle",
            "input_value": "learner-authored-value-must-not-export",
            "prediction": "PASS", "confidence": 80, "result": "PASS",
            "constraint_flags": "unsafe", "revision_attempt": 1,
            "is_final_design": False, "competency_score": 72,
            "detail": "learner-authored detail must not export",
            "final_design": "learner-authored final design must not export",
        })
        invalid_event = event(learner_id, invalid_numeric_session, STUDY_COURSE, 2, {
            "source_app": "fingrip", "event_name": "trial_completed",
            "opportunity_index": "not-a-number", "confidence": "not-a-number",
            "competency_score": "not-a-number", "prediction": "PASS", "result": "SLIP",
        })
        ordinary_event = event(ordinary_id, ordinary_session, STUDY_COURSE, 1, {"source_app": "fingrip", "event_name": "trial_completed"})
        other_course_event = event(learner_id, other_course_session, "statics", 1, {"source_app": "fingrip", "event_name": "trial_completed"})
        for label, token, payload in (
            ("valid study event", learner_token, valid_event),
            ("invalid numeric study event", learner_token, invalid_event),
            ("ordinary learner event", ordinary_token, ordinary_event),
            ("other course event", learner_token, other_course_event),
        ):
            require_http(api.user_rest("POST", "/rest/v1/interaction_events", token, payload, "return=representation"), (200, 201), label)

        valid_export = api.service_rest("GET", f"/rest/v1/engineering_sim_event_export?select=*&session_id=eq.{valid_session}")
        valid_rows = require_http(valid_export, (200,), "valid event export")
        record("study_event_exports_once_without_cross_experiment_duplication", len(valid_rows or []) == 1)
        exported = valid_rows[0]
        exported_payload = exported.get("payload") or {}
        record("export_has_authoritative_assignment", exported.get("assignment_arm") == "treatment_annotation_adaptive" and exported.get("experiment_key") == STUDY_EXPERIMENT)
        record("prediction_and_result_are_domain_separated_hashes", HEX64.fullmatch(exported_payload.get("prediction", "")) is not None and exported_payload.get("prediction") == exported_payload.get("result"))
        record("constraint_state_is_derived_boolean", exported_payload.get("constraint_violation") is True)
        forbidden = {"input_value", "constraint_flags", "detail", "final_design", "finalDesign"}
        record("export_excludes_raw_or_free_text_surfaces", forbidden.isdisjoint(exported_payload))

        invalid_export = api.service_rest("GET", f"/rest/v1/engineering_sim_event_export?select=payload&session_id=eq.{invalid_numeric_session}")
        invalid_rows = require_http(invalid_export, (200,), "invalid numeric export")
        invalid_payload = invalid_rows[0].get("payload") if invalid_rows else {}
        record("malformed_numeric_values_do_not_break_export", len(invalid_rows or []) == 1 and not {"opportunity_index", "confidence", "competency_score"}.intersection(invalid_payload or {}))

        ordinary_export = api.service_rest("GET", f"/rest/v1/engineering_sim_event_export?select=session_id&session_id=eq.{ordinary_session}")
        record("nonstudy_learner_events_are_excluded", ordinary_export.status == 200 and ordinary_export.body == [])
        other_course_export = api.service_rest("GET", f"/rest/v1/engineering_sim_event_export?select=session_id&session_id=eq.{other_course_session}")
        record("other_course_events_are_excluded", other_course_export.status == 200 and other_course_export.body == [])

    finally:
        for session_id in sessions:
            result = api.service_rest("DELETE", f"/rest/v1/interaction_events?session_id=eq.{session_id}", prefer="return=minimal")
            if result.status not in (200, 204):
                cleanup_errors.append("interaction_events")
        if users:
            learner_ids = ",".join(users)
            result = api.service_rest("DELETE", f"/rest/v1/experiment_assignments?user_id=in.({learner_ids})", prefer="return=minimal")
            if result.status not in (200, 204):
                cleanup_errors.append("experiment_assignments")
            result = api.service_rest("DELETE", f"/rest/v1/cohort_learners?user_id=in.({learner_ids})", prefer="return=minimal")
            if result.status not in (200, 204):
                cleanup_errors.append("cohort_learners")
        if study_hash:
            result = api.service_rest("DELETE", f"/rest/v1/engineering_study_allocation_schedule?study_link_hash=eq.{study_hash}", prefer="return=minimal")
            if result.status not in (200, 204):
                cleanup_errors.append("engineering_study_allocation_schedule")
        for user_id in reversed(users):
            result = api.admin("DELETE", f"/auth/v1/admin/users/{user_id}")
            if result.status not in (200, 204):
                cleanup_errors.append("auth.users")

    checks["synthetic_fixture_cleanup_completed"] = not cleanup_errors
    return {
        "status": "pass" if all(checks.values()) else "fail",
        "project_ref": project_ref,
        "production_project_ref": PRODUCTION_PROJECT_REF,
        "production_changed": False,
        "synthetic_only": True,
        "checks_passed": sum(checks.values()),
        "checks_total": len(checks),
        "checks": checks,
        "cleanup_errors": sorted(set(cleanup_errors)),
        "secrets_or_contact_values_recorded": False,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--acknowledge-staging", action="store_true")
    parser.add_argument("--output", type=Path, default=Path("research/evidence/engineering_staging_rls_qa.json"))
    args = parser.parse_args()

    url = os.environ.get("ALGET_STAGING_SUPABASE_URL", "")
    anon_key = os.environ.get("ALGET_STAGING_SUPABASE_ANON_KEY", "")
    service_key = os.environ.get("ALGET_STAGING_SUPABASE_SERVICE_ROLE_KEY", "")
    try:
        project_ref = assert_staging_target(url, args.acknowledge_staging)
        if not anon_key or not service_key:
            raise ValueError("staging anon and service-role environment variables are required")
        report = run_qa(SupabaseHttp(url, anon_key, service_key), project_ref)
    except Exception as error:  # report a bounded message without HTTP bodies or credentials
        report = {
            "status": "fail",
            "production_changed": False,
            "synthetic_only": True,
            "error_type": type(error).__name__,
            "error": str(error),
            "secrets_or_contact_values_recorded": False,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "output": str(args.output)}))
    return 0 if report["status"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())
