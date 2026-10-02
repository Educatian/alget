"""Study enrollment and sign-in with personal Study IDs.

The research team pre-generates Study IDs (generate_study_ids.py), loads them
into public.study_invites, and emails each participant their own ID. The team
keeps the name/email <-> Study ID key outside ALGET.

Participants sign in with the Study ID alone (login_with_study_id): the first
time, the server creates a Supabase account with a placeholder address
(<study-id>@participants.alget.example.com, never emailed) and claims the
invite; afterwards the same ID signs back into that account from any device.
The Study ID therefore works like a password. ALGET stores no participant
names or emails.

Staff who are already signed in with email can still redeem an ID with
enroll(). Either way the track and Study ID are kept in the account's
app_metadata (writable only with the service role, so learners cannot change
their own track) and in public.cohort_learners for the roster.

Study ID format: BAS-XXXX-XXXX (basic track) or BIO-XXXX-XXXX (bio-inspired),
using an alphabet without look-alike characters (no I, O, 0, 1).
"""
from __future__ import annotations

import os
import re
import secrets
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
        self.update_user(user_id, {"app_metadata": app_metadata})

    def update_user(self, user_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        r = self.http.put(f"{self.url}/auth/v1/admin/users/{user_id}", headers=self._headers(), json=changes)
        if r.status_code >= 300:
            raise StudyEnrollmentError(502, "Could not save study enrollment.")
        return r.json()

    def get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        r = self.http.get(f"{self.url}/auth/v1/admin/users/{user_id}", headers=self._headers())
        if r.status_code == 404:
            return None
        if r.status_code != 200:
            raise StudyEnrollmentError(502, "Could not sign in right now.")
        return r.json()

    def create_user(self, email: str, password: str, app_metadata: dict[str, Any]) -> dict[str, Any] | None:
        """Create a confirmed account. Returns None if the email is already registered."""
        r = self.http.post(f"{self.url}/auth/v1/admin/users", headers=self._headers(),
                           json={"email": email, "password": password, "email_confirm": True,
                                 "app_metadata": app_metadata})
        if r.status_code in (409, 422):
            return None
        if r.status_code >= 300:
            raise StudyEnrollmentError(502, "Could not create the study account.")
        return r.json()

    def find_user_by_email(self, email: str) -> dict[str, Any] | None:
        """Look up an existing account by email (generate_link returns the user without sending mail)."""
        r = self.http.post(f"{self.url}/auth/v1/admin/generate_link", headers=self._headers(),
                           json={"type": "magiclink", "email": email})
        if r.status_code >= 300:
            return None
        data = r.json()
        return data.get("user") or (data if data.get("id") else None)

    def password_sign_in(self, email: str, password: str) -> dict[str, Any]:
        r = self.http.post(f"{self.url}/auth/v1/token", headers=self._headers(),
                           params={"grant_type": "password"}, json={"email": email, "password": password})
        if r.status_code != 200:
            raise StudyEnrollmentError(502, "Could not sign in right now.")
        return r.json()

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

    _sync_roster(admin, user_id, track, study_id)
    return public_enrollment(track, study_id)


def _sync_roster(admin: SupabaseAdmin, user_id: str, track: str, study_id: str) -> None:
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


def participant_email(study_id: str) -> str:
    """Placeholder account address for a Study ID. example.com is reserved, so nothing is ever delivered."""
    return f"{study_id.lower()}@participants.alget.example.com"


def _study_metadata(track: str, study_id: str) -> dict[str, Any]:
    return {"study_track": track, "study_id": study_id, "study_cohort": STUDY_TRACKS[track]["cohort_id"],
            "study_login": "study_id", "study_enrolled_at": datetime.now(timezone.utc).isoformat()}


def login_with_study_id(raw_study_id: str, admin: SupabaseAdmin) -> dict[str, Any]:
    """Sign in (creating the account on first use) with a personal Study ID alone.

    Returns Supabase session tokens plus the enrollment. Each sign-in sets a
    fresh random password on the participant account and immediately signs in
    with it, so no password is ever stored or shown; existing sessions on other
    devices stay valid.
    """
    study_id = normalize_study_id(raw_study_id)
    if not study_id:
        raise StudyEnrollmentError(400, "Please check your Study ID. It looks like BIO-7K3Q-9MZP.")
    invite = admin.get_invite(study_id)
    if not invite or invite.get("track") not in STUDY_TRACKS:
        raise StudyEnrollmentError(403, "That Study ID was not found. Please check your invitation email.")
    track = invite["track"]
    email = participant_email(study_id)
    password = secrets.token_urlsafe(32)

    user_id = invite.get("redeemed_by")
    if user_id:
        user = admin.get_user_by_id(user_id)
        if not user:
            raise StudyEnrollmentError(409, "This Study ID needs attention. Please contact the research team.")
        if (user.get("email") or "").lower() != email:
            # Redeemed by a staff account signed in with email; that account keeps using email sign-in.
            raise StudyEnrollmentError(409, "This Study ID is linked to an email account. Please sign in with email.")
        meta = {**(user.get("app_metadata") or {}), **_study_metadata(track, study_id)}
        meta["study_enrolled_at"] = (user.get("app_metadata") or {}).get("study_enrolled_at", meta["study_enrolled_at"])
        admin.update_user(user_id, {"password": password, "app_metadata": meta})
    else:
        user = admin.create_user(email, password, _study_metadata(track, study_id))
        if user is None:  # account exists from an earlier attempt that did not finish claiming
            user = admin.find_user_by_email(email)
            if not user or not user.get("id"):
                raise StudyEnrollmentError(502, "Could not sign in right now. Please try again.")
            admin.update_user(user["id"], {"password": password,
                                           "app_metadata": {**(user.get("app_metadata") or {}),
                                                            **_study_metadata(track, study_id)}})
        user_id = user["id"]
        if not admin.claim_invite(study_id, user_id):
            # Claimed between our read and write. Fine if it was this same account (e.g. a double click).
            latest = admin.get_invite(study_id) or {}
            if latest.get("redeemed_by") != user_id:
                raise StudyEnrollmentError(409, "That Study ID has already been used. Please contact the research team.")

    _sync_roster(admin, user_id, track, study_id)
    session = admin.password_sign_in(email, password)
    return {"access_token": session["access_token"], "refresh_token": session["refresh_token"],
            "expires_in": session.get("expires_in"), **public_enrollment(track, study_id)}
