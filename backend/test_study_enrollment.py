"""Offline tests for study track enrollment (fake Supabase, no network)."""
import json

import httpx
import pytest

import study_enrollment as se

ENV = {"STUDY_BASIC_ACCESS_CODE": "basic-code-123", "STUDY_BIO_ACCESS_CODE": "bio-code-456"}


class FakeSupabase:
    def __init__(self, app_metadata=None, user_status=200):
        self.app_metadata = dict(app_metadata or {})
        self.user_status = user_status
        self.roster = {}
        self.metadata_writes = 0

    def handler(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/auth/v1/user":
            if self.user_status != 200:
                return httpx.Response(self.user_status, json={})
            return httpx.Response(200, json={"id": "user-1", "app_metadata": self.app_metadata})
        if path.startswith("/auth/v1/admin/users/") and request.method == "PUT":
            self.app_metadata = json.loads(request.content)["app_metadata"]
            self.metadata_writes += 1
            return httpx.Response(200, json={})
        if path == "/rest/v1/cohort_learners" and request.method == "POST":
            row = json.loads(request.content)
            self.roster[row["user_id"]] = row
            return httpx.Response(201)
        return httpx.Response(404)

    def admin(self):
        client = httpx.Client(transport=httpx.MockTransport(self.handler))
        return se.SupabaseAdmin(url="https://example.supabase.co", service_key="service", client=client)


def test_codes_map_to_tracks_and_unset_codes_never_match():
    assert se.track_for_code("basic-code-123", ENV) == "basic"
    assert se.track_for_code(" bio-code-456 ", ENV) == "bio"
    assert se.track_for_code("wrong", ENV) is None
    assert se.track_for_code("", ENV) is None
    assert se.track_for_code("", {}) is None
    assert se.track_for_code("anything", {"STUDY_BASIC_ACCESS_CODE": ""}) is None


def test_enroll_basic_track_records_metadata_and_roster():
    fake = FakeSupabase()
    result = se.enroll("token", "basic-code-123", fake.admin(), ENV)

    assert result["track"] == "basic" and result["courses"] == ["statics", "dynamics"] and result["lab"] is False
    assert fake.app_metadata["study_track"] == "basic"
    assert fake.app_metadata["study_id"] == result["study_id"] and len(result["study_id"]) == 36
    row = fake.roster["user-1"]
    assert row["cohort_id"] == "fall2026-basic" and row["learner_hash"] == result["study_id"]
    assert row["display_name"] == "Study participant"  # no names or emails in the roster


def test_enroll_is_idempotent_and_never_switches_track():
    fake = FakeSupabase()
    first = se.enroll("token", "bio-code-456", fake.admin(), ENV)
    second = se.enroll("token", "basic-code-123", fake.admin(), ENV)

    assert second["track"] == "bio" and second["study_id"] == first["study_id"]
    assert fake.metadata_writes == 1


def test_existing_metadata_is_preserved():
    fake = FakeSupabase(app_metadata={"provider": "email", "roles": ["learner"]})
    se.enroll("token", "bio-code-456", fake.admin(), ENV)
    assert fake.app_metadata["provider"] == "email" and fake.app_metadata["roles"] == ["learner"]


def test_wrong_code_and_bad_token_are_rejected():
    with pytest.raises(se.StudyEnrollmentError) as wrong:
        se.enroll("token", "nope", FakeSupabase().admin(), ENV)
    assert wrong.value.status_code == 403

    with pytest.raises(se.StudyEnrollmentError) as unauth:
        se.enroll("token", "basic-code-123", FakeSupabase(user_status=401).admin(), ENV)
    assert unauth.value.status_code == 401

    with pytest.raises(se.StudyEnrollmentError) as missing:
        se.enroll("", "basic-code-123", FakeSupabase().admin(), ENV)
    assert missing.value.status_code == 401
