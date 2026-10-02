"""Fall 2026 study enrollment: track codes -> study track + Study ID.

Participants are invited by email with a track code. A signed-in learner
redeems the code once; the server records the track and a random Study ID
in the user's Supabase app_metadata (writable only with the service role,
so learners cannot change their own track) and in public.cohort_learners
for the research roster. No names or emails are written to the roster.

Track codes live in Worker secrets STUDY_BASIC_ACCESS_CODE and
STUDY_BIO_ACCESS_CODE. There are no fallback codes: an unset code never
matches, so enrollment stays closed until the secrets are configured.
"""
from __future__ import annotations

import hmac
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx

STUDY_TRACKS: dict[str, dict[str, Any]] = {
    "basic": {
        "env": "STUDY_BASIC_ACCESS_CODE",
        "cohort_id": "fall2026-basic",
        "cohort_label": "Fall 2026 study - basic track",
        "course_id": "statics",
        "courses": ["statics", "dynamics"],
        "lab": False,
    },
    "bio": {
        "env": "STUDY_BIO_ACCESS_CODE",
        "cohort_id": "fall2026-bio",
        "cohort_label": "Fall 2026 study - bio-inspired track",
        "course_id": "bio-inspired",
        "courses": ["bio-inspired"],
        "lab": True,
    },
}


class StudyEnrollmentError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def track_for_code(passcode: str, env: dict[str, str] | None = None) -> str | None:
    """Return the track whose configured code matches, or None."""
    env = os.environ if env is None else env
    candidate = (passcode or "").strip()
    if not candidate:
        return None
    for track, spec in STUDY_TRACKS.items():
        expected = (env.get(spec["env"]) or "").strip()
        if expected and hmac.compare_digest(candidate.encode(), expected.encode()):
            return track
    return None


def public_enrollment(track: str, study_id: str) -> dict[str, Any]:
    spec = STUDY_TRACKS[track]
    return {"enrolled": True, "track": track, "study_id": study_id,
            "courses": list(spec["courses"]), "lab": spec["lab"]}


class SupabaseAdmin:
    """Minimal Supabase Auth admin + REST client using the service role key."""

    def __init__(self, url: str | None = None, service_key: str | None = None, client: httpx.Client | None = None):
        self.url = (url or os.environ.get("SUPABASE_URL") or "").rstrip("/")
        self.key = service_key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
        if not self.url or not self.key:
            raise StudyEnrollmentError(503, "Study enrollment is not configured.")
        self.http = client or httpx.Client(timeout=15.0)

    def _headers(self, bearer: str | None = None) -> dict[str, str]:
        return {"apikey": self.key, "Authorization": f"Bearer {bearer or self.key}", "Content-Type": "application/json"}

    def get_user(self, access_token: str) -> dict[str, Any]:
        r = self.http.get(f"{self.url}/auth/v1/user", headers=self._headers(access_token))
        if r.status_code != 200:
            raise StudyEnrollmentError(401, "Please sign in again.")
        return r.json()

    def set_app_metadata(self, user_id: str, app_metadata: dict[str, Any]) -> None:
        r = self.http.put(f"{self.url}/auth/v1/admin/users/{user_id}", headers=self._headers(),
                          json={"app_metadata": app_metadata})
        if r.status_code >= 300:
            raise StudyEnrollmentError(502, "Could not save study enrollment.")

    def upsert_roster(self, row: dict[str, Any]) -> None:
        headers = {**self._headers(), "Prefer": "resolution=merge-duplicates,return=minimal"}
        r = self.http.post(f"{self.url}/rest/v1/cohort_learners?on_conflict=user_id", headers=headers, json=row)
        if r.status_code >= 300:
            raise StudyEnrollmentError(502, "Could not save study roster entry.")


def enroll(access_token: str, passcode: str, admin: SupabaseAdmin, env: dict[str, str] | None = None) -> dict[str, Any]:
    """Redeem a track code for the signed-in user. Idempotent; never switches tracks."""
    if not access_token:
        raise StudyEnrollmentError(401, "Please sign in first.")
    user = admin.get_user(access_token)
    user_id = user.get("id")
    if not user_id:
        raise StudyEnrollmentError(401, "Please sign in again.")
    meta = dict(user.get("app_metadata") or {})

    existing_track, existing_id = meta.get("study_track"), meta.get("study_id")
    if existing_track in STUDY_TRACKS and existing_id:
        track, study_id = existing_track, existing_id  # already enrolled: keep track, just re-sync roster
    else:
        track = track_for_code(passcode, env)
        if not track:
            raise StudyEnrollmentError(403, "That study code is not valid.")
        study_id = str(uuid.uuid4())
        meta.update({"study_track": track, "study_id": study_id,
                     "study_cohort": STUDY_TRACKS[track]["cohort_id"],
                     "study_enrolled_at": datetime.now(timezone.utc).isoformat()})
        admin.set_app_metadata(user_id, meta)

    spec = STUDY_TRACKS[track]
    admin.upsert_roster({
        "user_id": user_id,
        "display_name": "Study participant",
        "cohort_id": spec["cohort_id"],
        "cohort_label": spec["cohort_label"],
        "course_id": spec["course_id"],
        "learner_hash": study_id,
        "profile": {"study_track": track},
    })
    return public_enrollment(track, study_id)
