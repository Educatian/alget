"""Offline tests for personal Study ID enrollment (fake Supabase, no network)."""
import json

import httpx
import pytest

import study_enrollment as se
from generate_study_ids import generate

BIO_ID = "BIO-7K3Q-9MZP"
BAS_ID = "BAS-4WXT-2HNR"


class FakeSupabase:
    def __init__(self, invites=None, app_metadata=None, user_id="user-1", user_status=200):
        self.invites = {sid: {"study_id": sid, "track": t, "redeemed_by": None} for sid, t in (invites or {}).items()}
        self.app_metadata = dict(app_metadata or {})
        self.user_id = user_id
        self.user_status = user_status
        self.roster = {}
        self.metadata_writes = 0

    def handler(self, request: httpx.Request) -> httpx.Response:
        path, q = request.url.path, request.url.params
        if path == "/auth/v1/user":
            if self.user_status != 200:
                return httpx.Response(self.user_status, json={})
            return httpx.Response(200, json={"id": self.user_id, "app_metadata": self.app_metadata})
        if path.startswith("/auth/v1/admin/users/") and request.method == "PUT":
            self.app_metadata = json.loads(request.content)["app_metadata"]
            self.metadata_writes += 1
            return httpx.Response(200, json={})
        if path == "/rest/v1/study_invites":
            sid = q["study_id"].removeprefix("eq.")
            row = self.invites.get(sid)
            if request.method == "GET":
                return httpx.Response(200, json=[row] if row else [])
            if request.method == "PATCH":  # only claims rows with redeemed_by is null
                if row and row["redeemed_by"] is None:
                    row["redeemed_by"] = json.loads(request.content)["redeemed_by"]
                    return httpx.Response(200, json=[row])
                return httpx.Response(200, json=[])
        if path == "/rest/v1/cohort_learners" and request.method == "POST":
            row = json.loads(request.content)
            self.roster[row["user_id"]] = row
            return httpx.Response(201)
        return httpx.Response(404)

    def admin(self):
        client = httpx.Client(transport=httpx.MockTransport(self.handler))
        return se.SupabaseAdmin(url="https://example.supabase.co", service_key="service", client=client)


def test_normalize_accepts_friendly_input_and_rejects_malformed():
    assert se.normalize_study_id("bio-7k3q-9mzp") == BIO_ID
    assert se.normalize_study_id(" BIO 7K3Q 9MZP ") == BIO_ID
    assert se.normalize_study_id("BIO7K3Q9MZP") == BIO_ID
    assert se.normalize_study_id("BIO-7K3Q-9MZ0") is None  # 0 is not in the alphabet
    assert se.normalize_study_id("XYZ-7K3Q-9MZP") is None
    assert se.normalize_study_id("") is None


def test_bio_id_enrolls_into_bio_track_with_that_id():
    fake = FakeSupabase(invites={BIO_ID: "bio"})
    result = se.enroll("token", "bio-7k3q-9mzp", fake.admin())

    assert result == {"enrolled": True, "track": "bio", "study_id": BIO_ID, "courses": ["bio-inspired"], "lab": True}
    assert fake.app_metadata["study_id"] == BIO_ID and fake.app_metadata["study_track"] == "bio"
    assert fake.invites[BIO_ID]["redeemed_by"] == "user-1"
    row = fake.roster["user-1"]
    assert row["learner_hash"] == BIO_ID and row["cohort_id"] == "study-bio" and row["display_name"] == "Study participant"


def test_basic_id_enrolls_into_basic_track():
    fake = FakeSupabase(invites={BAS_ID: "basic"})
    result = se.enroll("token", BAS_ID, fake.admin())
    assert result["track"] == "basic" and result["courses"] == ["statics", "dynamics"] and result["lab"] is False


def test_id_works_once_only():
    fake = FakeSupabase(invites={BIO_ID: "bio"})
    se.enroll("token", BIO_ID, fake.admin())
    other = FakeSupabase(user_id="user-2")
    other.invites = fake.invites  # same invite table, different person
    with pytest.raises(se.StudyEnrollmentError) as used:
        se.enroll("token", BIO_ID, other.admin())
    assert used.value.status_code == 409


def test_enrolled_user_keeps_id_and_track():
    fake = FakeSupabase(invites={BIO_ID: "bio", BAS_ID: "basic"})
    first = se.enroll("token", BIO_ID, fake.admin())
    second = se.enroll("token", BAS_ID, fake.admin())
    assert second["study_id"] == first["study_id"] == BIO_ID and second["track"] == "bio"
    assert fake.metadata_writes == 1 and fake.invites[BAS_ID]["redeemed_by"] is None


def test_retry_after_partial_failure_reuses_own_claim():
    fake = FakeSupabase(invites={BIO_ID: "bio"})
    fake.invites[BIO_ID]["redeemed_by"] = "user-1"  # claimed, but metadata never saved
    assert se.enroll("token", BIO_ID, fake.admin())["study_id"] == BIO_ID


def test_unknown_malformed_and_unauthenticated_are_rejected():
    with pytest.raises(se.StudyEnrollmentError) as unknown:
        se.enroll("token", BIO_ID, FakeSupabase().admin())
    assert unknown.value.status_code == 403
    with pytest.raises(se.StudyEnrollmentError) as bad:
        se.enroll("token", "not-an-id", FakeSupabase().admin())
    assert bad.value.status_code == 400
    with pytest.raises(se.StudyEnrollmentError) as unauth:
        se.enroll("token", BIO_ID, FakeSupabase(user_status=401).admin())
    assert unauth.value.status_code == 401


def test_existing_metadata_is_preserved():
    fake = FakeSupabase(invites={BIO_ID: "bio"}, app_metadata={"provider": "email"})
    se.enroll("token", BIO_ID, fake.admin())
    assert fake.app_metadata["provider"] == "email"


class FakeAuth(FakeSupabase):
    """Adds the admin user endpoints used by Study ID sign-in."""

    def __init__(self, invites=None):
        super().__init__(invites=invites)
        self.users = {}       # id -> {"id", "email", "password", "app_metadata"}
        self.created = 0

    def handler(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        body = json.loads(request.content) if request.content else {}
        if path == "/auth/v1/admin/users" and request.method == "POST":
            if any(u["email"] == body["email"] for u in self.users.values()):
                return httpx.Response(422, json={"msg": "already registered"})
            self.created += 1
            uid = f"user-{self.created}"
            self.users[uid] = {"id": uid, "email": body["email"], "password": body["password"],
                               "app_metadata": body.get("app_metadata", {})}
            return httpx.Response(200, json=self.users[uid])
        if path.startswith("/auth/v1/admin/users/"):
            uid = path.rsplit("/", 1)[1]
            user = self.users.get(uid)
            if not user:
                return httpx.Response(404, json={})
            if request.method == "PUT":
                user.update({k: v for k, v in body.items() if k in ("password", "app_metadata")})
            return httpx.Response(200, json=user)
        if path == "/auth/v1/admin/generate_link":
            user = next((u for u in self.users.values() if u["email"] == body["email"]), None)
            return httpx.Response(200, json={"user": user}) if user else httpx.Response(404, json={})
        if path == "/auth/v1/token":
            ok = any(u["email"] == body["email"] and u["password"] == body["password"] for u in self.users.values())
            return httpx.Response(200 if ok else 400, json={"access_token": "at", "refresh_token": "rt", "expires_in": 3600})
        return super().handler(request)


def test_first_study_id_login_creates_account_claims_invite_and_returns_session():
    fake = FakeAuth(invites={BIO_ID: "bio"})
    result = se.login_with_study_id("bio 7k3q 9mzp", fake.admin())

    assert result["access_token"] == "at" and result["refresh_token"] == "rt"
    assert result["track"] == "bio" and result["study_id"] == BIO_ID and result["lab"] is True
    (user,) = fake.users.values()
    assert user["email"] == "bio-7k3q-9mzp@participants.alget.example.com"
    assert user["app_metadata"]["study_track"] == "bio" and user["app_metadata"]["study_id"] == BIO_ID
    assert fake.invites[BIO_ID]["redeemed_by"] == user["id"]
    assert fake.roster[user["id"]]["learner_hash"] == BIO_ID


def test_returning_login_reuses_the_same_account_with_a_new_password():
    fake = FakeAuth(invites={BAS_ID: "basic"})
    se.login_with_study_id(BAS_ID, fake.admin())
    first_password = next(iter(fake.users.values()))["password"]
    again = se.login_with_study_id(BAS_ID, fake.admin())

    assert fake.created == 1 and again["track"] == "basic" and again["access_token"] == "at"
    assert next(iter(fake.users.values()))["password"] != first_password


def test_login_recovers_when_account_exists_but_invite_was_not_claimed():
    fake = FakeAuth(invites={BIO_ID: "bio"})
    fake.users["user-9"] = {"id": "user-9", "email": se.participant_email(BIO_ID), "password": "old", "app_metadata": {}}
    result = se.login_with_study_id(BIO_ID, fake.admin())
    assert result["study_id"] == BIO_ID and fake.invites[BIO_ID]["redeemed_by"] == "user-9" and fake.created == 0


def test_login_refuses_ids_redeemed_by_an_email_account():
    fake = FakeAuth(invites={BIO_ID: "bio"})
    fake.users["staff"] = {"id": "staff", "email": "staff@ua.edu", "password": "keep", "app_metadata": {}}
    fake.invites[BIO_ID]["redeemed_by"] = "staff"
    with pytest.raises(se.StudyEnrollmentError) as linked:
        se.login_with_study_id(BIO_ID, fake.admin())
    assert linked.value.status_code == 409 and fake.users["staff"]["password"] == "keep"


def test_login_rejects_unknown_and_malformed_ids():
    with pytest.raises(se.StudyEnrollmentError) as unknown:
        se.login_with_study_id(BIO_ID, FakeAuth().admin())
    assert unknown.value.status_code == 403
    with pytest.raises(se.StudyEnrollmentError) as bad:
        se.login_with_study_id("hello", FakeAuth().admin())
    assert bad.value.status_code == 400


def test_generator_makes_unique_valid_track_prefixed_ids():
    rows = generate({"basic": 50, "bio": 40})
    assert len(rows) == 90 and len({s for s, _ in rows}) == 90
    assert all(se.STUDY_ID_PATTERN.match(s) for s, _ in rows)
    assert all(s.startswith("BAS-") for s, t in rows if t == "basic")
    assert all(s.startswith("BIO-") for s, t in rows if t == "bio")
