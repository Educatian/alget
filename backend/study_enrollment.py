"""Study enrollment with personal, one-time Study IDs.

The research team pre-generates Study IDs (scripts/generate_study_ids.py),
loads them into public.study_invites, and emails each participant their own
ID. The team keeps the name/email <-> Study ID key outside ALGET. A signed-in
learner redeems their ID once: the server claims the invite row, then records
the track and Study ID in the user's Supabase app_metadata (writable only with
the service role, so learners cannot change their own track) and in
public.cohort_learners for the roster. No names or emails are written by ALGET.

Study ID format: BAS-XXXX-XXXX (basic track) or BIO-XXXX-XXXX (bio-inspired),
using an alphabet without look-alike characters (no I, O, 0, 1).
"""
from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Any

import httpx

STUDY_TRACKS: dict[str, dict[str, Any]] = {
    "basic": {
        "prefix": "BAS",
        "cohort_id": "study-basic",
        "cohort_label": "Research study - basic track",
        "course_id": "statics",
        "courses": ["statics", "dynamics"],
        "lab": False,
    },
    "bio": {
        "prefix": "BIO",
        "cohort_id": "study-bio",
        "cohort_label": "Research study - bio-inspired track",
        "course_id": "bio-inspired",
        "courses": ["bio-inspired"],
        "lab": True,
    },
}

ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
STUDY_ID_PATTERN = re.compile(rf"^(BAS|BIO)-[{ID_ALPHABET}]{{4}}-[{ID_ALPHABET}]{{4}}$")


class StudyEnrollmentError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def normalize_study_id(raw: str) -> str | None:
    """Uppercase, drop spaces, accept missing dashes; return None if malformed."""
    compact = re.sub(r"[\s-]", "", (raw or "").upper())
    if len(compact) != 11:
        return None
    candidate = f"{compact[:3]}-{compact[3:7]}-{compact[7:]}"
    return candidate if STUDY_ID_PATTERN.match(candidate) else None


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

    def get_invite(self, study_id: str) -> dict[str, Any] | None:
        r = self.http.get(f"{self.url}/rest/v1/study_invites", headers=self._headers(),
                          params={"study_id": f"eq.{study_id}", "select": "study_id,track,redeemed_by"})
        if r.status_code != 200:
            raise StudyEnrollmentError(502, "Could not check the Study ID right now.")
        rows = r.json()
        return rows[0] if rows else None

    def claim_invite(self, study_id: str, user_id: str) -> bool:
        """Atomically claim an unredeemed invite. Returns False if someone else already holds it."""
        headers = {**self._headers(), "Prefer": "return=representation"}
        r = self.http.patch(f"{self.url}/rest/v1/study_invites", headers=headers,
                            params={"study_id": f"eq.{study_id}", "redeemed_by": "is.null"},
                            json={"redeemed_by": user_id, "redeemed_at": datetime.now(timezone.utc).isoformat()})
        if r.status_code >= 300:
            raise StudyEnrollmentError(502, "Could not save study enrollment.")
        return bool(r.json())

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


def enroll(access_token: str, raw_study_id: str, admin: SupabaseAdmin) -> dict[str, Any]:
    """Redeem a personal Study ID for the signed-in user. Idempotent; never switches IDs or tracks."""
    if not access_token:
        raise StudyEnrollmentError(401, "Please sign in first.")
    user = admin.get_user(access_token)
    user_id = user.get("id")
    if not user_id:
        raise StudyEnrollmentError(401, "Please sign in again.")
    meta = dict(user.get("app_metadata") or {})

    existing_track, existing_id = meta.get("study_track"), meta.get("study_id")
    if existing_track in STUDY_TRACKS and existing_id:
        track, study_id = existing_track, existing_id  # already enrolled: keep it, just re-sync roster
    else:
        study_id = normalize_study_id(raw_study_id)
        if not study_id:
            raise StudyEnrollmentError(400, "Please check your Study ID. It looks like BIO-7K3Q-9MZP.")
        invite = admin.get_invite(study_id)
        if not invite or invite.get("track") not in STUDY_TRACKS:
            raise StudyEnrollmentError(403, "That Study ID was not found. Please check your invitation email.")
        if invite.get("redeemed_by") not in (None, user_id):
            raise StudyEnrollmentError(409, "That Study ID has already been used. Please contact the research team.")
        if invite.get("redeemed_by") is None and not admin.claim_invite(study_id, user_id):
            raise StudyEnrollmentError(409, "That Study ID has already been used. Please contact the research team.")
        track = invite["track"]
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
