"""Implementation contracts for the 1--3 year agentic textbook roadmap.

The runtime deliberately keeps the consequential operations explicit.  This
module is deterministic so it can be used by the API, a local demo, and
contract tests without requiring a model provider or a live Supabase project.
It does not claim that a source citation proves every generated sentence.
"""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import re
from typing import Any, Iterable
from uuid import uuid4


ROADMAP_CONTRACT_VERSION = "roadmap-runtime-v1"
SOURCE_HASH_RE = re.compile(r"^[0-9a-f]{64}$")
DECISIONS = {"accept", "modify", "reject", "defer"}
INCIDENT_STATUSES = ("open", "triaged", "contained", "resolved")
INCIDENT_TRANSITIONS = {
    "open": {"triaged"},
    "triaged": {"contained", "resolved"},
    "contained": {"resolved"},
    "resolved": set(),
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_text(value: str) -> str:
    return hashlib.sha256(str(value).encode("utf-8")).hexdigest()


def _text(value: Any) -> str:
    return str(value or "").strip()


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def build_runtime_package(
    *,
    course_id: str,
    source_text: str,
    source: dict[str, Any],
    sections: list[dict[str, Any]],
    policy: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build the source-grounded package used by the shadow-to-publish flow."""

    source_record = deepcopy(source)
    source_record.setdefault("sha256", sha256_text(source_text))
    source_record.setdefault("title", "Untitled course source")
    source_record.setdefault("canonical_url", None)
    source_record.setdefault("licence_url", None)
    source_record.setdefault("retrieved_at", utc_now())
    normalized_sections = []
    for index, section in enumerate(sections):
        reading = section.get("reading") or {}
        normalized_sections.append(
            {
                "id": _text(section.get("id")) or f"section-{index + 1}",
                "title": _text(section.get("title")) or f"Section {index + 1}",
                "reading": {
                    "content": _text(reading.get("content")),
                    "estimated_minutes": int(reading.get("estimated_minutes") or 8),
                },
                "learning_objectives": [x for x in _list(section.get("learning_objectives")) if _text(x)],
                "references": [deepcopy(x) for x in _list(section.get("references")) if isinstance(x, dict)],
                "activity": deepcopy(section.get("activity") or {"status": "proposed"}),
                "simulation": deepcopy(section.get("simulation") or {"status": "proposed"}),
                "tutor": deepcopy(section.get("tutor") or {"status": "proposed", "approval": "required"}),
                "social": deepcopy(section.get("social") or {"status": "proposed", "dismissible": True}),
            }
        )
    return {
        "schema_version": ROADMAP_CONTRACT_VERSION,
        "course_id": _text(course_id),
        "source": source_record,
        "sections": normalized_sections,
        "runtime": {
            "tutor": "course_scoped",
            "analytics": ["mastery", "metacognitive_calibration", "evidence_alignment", "transfer", "social_reasoning"],
            "social_cues": "passive_optional",
            "high_risk_actions": "default_deny",
        },
        "policy": deepcopy(policy or {"release_gate": "human_approval_required", "autonomy": "bounded"}),
        "release": {
            "status": "shadow_draft",
            "student_visible": False,
            "automatic_publish": False,
            "approval": None,
        },
        "created_at": utc_now(),
    }


def validate_runtime_package(package: dict[str, Any]) -> dict[str, Any]:
    """Validate release invariants and return warnings without overclaiming."""

    errors: list[str] = []
    warnings: list[str] = []
    if not _text(package.get("course_id")):
        errors.append("course_id_required")
    source = package.get("source") if isinstance(package.get("source"), dict) else {}
    source_hash = _text(source.get("sha256")).lower()
    if not SOURCE_HASH_RE.fullmatch(source_hash):
        errors.append("source_sha256_required")
    sections = package.get("sections")
    if not isinstance(sections, list) or not sections:
        errors.append("sections_required")
    else:
        for index, section in enumerate(sections):
            if not _text(section.get("id")):
                errors.append(f"section_{index}_id_required")
            if not _text((section.get("reading") or {}).get("content")):
                errors.append(f"section_{index}_reading_required")
            refs = section.get("references") or []
            if not refs:
                warnings.append(f"section_{index}_no_references")
            for ref_index, reference in enumerate(refs):
                url = _text(reference.get("url")) if isinstance(reference, dict) else ""
                if url and not url.lower().startswith("https://"):
                    errors.append(f"section_{index}_reference_{ref_index}_unsafe_url")
    release = package.get("release") if isinstance(package.get("release"), dict) else {}
    status = _text(release.get("status")) or "shadow_draft"
    if status == "published":
        approval = release.get("approval") if isinstance(release.get("approval"), dict) else {}
        if not _text(approval.get("actor_id")) or not _text(approval.get("approved_at")):
            errors.append("published_requires_human_approval")
        if release.get("automatic_publish"):
            errors.append("automatic_publish_forbidden")
    if status not in {"shadow_draft", "review", "published", "rolled_back"}:
        errors.append("invalid_release_status")
    return {
        "valid": not errors,
        "schema_version": package.get("schema_version", ROADMAP_CONTRACT_VERSION),
        "errors": errors,
        "warnings": warnings,
        "claims_are_not_independently_verified": True,
    }


def record_agent_decision(
    *,
    course_id: str,
    actor_id: str,
    actor_role: str,
    decision: str,
    proposal_id: str,
    original: Any,
    revised: Any = None,
    rationale: str = "",
    evidence_ids: Iterable[str] = (),
) -> dict[str, Any]:
    if decision not in DECISIONS:
        raise ValueError("invalid_agent_decision")
    if not _text(course_id) or not _text(actor_id) or not _text(proposal_id):
        raise ValueError("decision_identity_required")
    if decision == "modify" and revised is None:
        raise ValueError("modified_decision_requires_revised_value")
    event = {
        "id": f"decision-{uuid4().hex}",
        "schema_version": "agent-decision-v1",
        "course_id": course_id,
        "proposal_id": proposal_id,
        "actor": {"id": actor_id, "role": actor_role},
        "decision": decision,
        "original": deepcopy(original),
        "revised": deepcopy(revised if decision == "modify" else original),
        "rationale": _text(rationale),
        "evidence_ids": [x for x in evidence_ids if _text(x)],
        "created_at": utc_now(),
    }
    event["event_hash"] = sha256_text(f"{event['proposal_id']}|{event['decision']}|{event['created_at']}")
    return event


def summarize_social_outcomes(events: Iterable[dict[str, Any]]) -> dict[str, Any]:
    """Compute outcome metrics; clicks alone never count as learning gains."""

    rows = [event for event in events if isinstance(event, dict)]
    cue_events = [event for event in rows if _text(event.get("event_type")) in {"peer_pulse_seen", "your_cue_selected", "evidence_echo_opened"}]
    compare_started = [event for event in rows if _text(event.get("event_type")) == "social_round_started"]
    compare_completed = [event for event in rows if _text(event.get("event_type")) == "social_evidence_compared" and event.get("evidence_submitted")]
    return {
        "schema_version": "social-outcomes-v1",
        "cue_impressions": len(cue_events),
        "evidence_compare_started": len(compare_started),
        "evidence_compare_completed": len(compare_completed),
        "evidence_compare_completion_rate": round(len(compare_completed) / len(compare_started), 4) if compare_started else None,
        "learning_gain_claim": "not_inferred_from_clicks",
        "missing_evidence": not bool(compare_completed),
    }


def to_caliper_event(*, event_type: str, actor_id: str, course_id: str, object_id: str, action: str, extensions: dict[str, Any] | None = None) -> dict[str, Any]:
    """Map an internal event to a Caliper-compatible envelope."""

    return {
        "@context": "http://purl.imsglobal.org/ctx/caliper/v1p2",
        "type": event_type,
        "id": f"urn:alget:event:{uuid4().hex}",
        "eventTime": utc_now(),
        "actor": {"id": f"urn:alget:user:{actor_id}", "type": "Person"},
        "action": action,
        "object": {"id": f"urn:alget:course:{course_id}:{object_id}", "type": "DigitalResource"},
        "extensions": {"course_id": course_id, **(extensions or {})},
    }


def normalize_oneroster_users(users: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized = []
    for user in users:
        if not isinstance(user, dict) or not _text(user.get("sourcedId")):
            raise ValueError("oneroster_sourced_id_required")
        role = _text(user.get("role") or "student").lower()
        if role not in {"student", "teacher", "administrator"}:
            raise ValueError("oneroster_role_invalid")
        normalized.append({
            "sourcedId": _text(user["sourcedId"]),
            "status": _text(user.get("status") or "active"),
            "role": role,
            "orgs": [x for x in _list(user.get("orgs")) if _text(x)],
            "metadata": {"source": "oneroster", "privacy_scope": "course_only"},
        })
    return normalized


def build_case_competency(*, uri: str, statement: str, human_code: str, document_uri: str) -> dict[str, Any]:
    if not all(_text(value) for value in (uri, statement, human_code, document_uri)):
        raise ValueError("case_competency_fields_required")
    return {
        "uri": uri,
        "fullStatement": statement,
        "humanCodingScheme": human_code,
        "CFDocument": {"uri": document_uri},
        "type": "CFItem",
        "source": "alget",
    }


def build_lti13_context(*, issuer: str, client_id: str, deployment_id: str, context_id: str, course_id: str, resource_link_id: str, roles: Iterable[str]) -> dict[str, Any]:
    if not _text(issuer).lower().startswith("https://"):
        raise ValueError("lti13_issuer_must_be_https")
    if not all(_text(value) for value in (client_id, deployment_id, context_id, course_id, resource_link_id)):
        raise ValueError("lti13_context_fields_required")
    normalized_roles = sorted({_text(role) for role in roles if _text(role)}) or ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"]
    return {
        "schema_version": "lti13-context-v1",
        "iss": issuer,
        "client_id": client_id,
        "deployment_id": deployment_id,
        "context": {"id": context_id, "course_id": course_id},
        "resource_link": {"id": resource_link_id},
        "roles": normalized_roles,
        "privacy_scope": "course_only",
        "launch_state": "requires_oidc_validation",
        "jwt_validation_required": True,
    }


class ModelRegistry:
    """Small deterministic registry used by runtime and release checks."""

    def __init__(self) -> None:
        self._records: dict[str, dict[str, Any]] = {}

    def register(self, *, provider: str, model_id: str, version: str, capabilities: Iterable[str], approved_by: str | None = None, status: str = "draft") -> dict[str, Any]:
        if not all(_text(x) for x in (provider, model_id, version)):
            raise ValueError("model_identity_required")
        if status == "production" and not _text(approved_by):
            raise ValueError("production_model_requires_approval")
        key = f"{provider}:{model_id}:{version}"
        record = {
            "id": key,
            "provider": provider,
            "model_id": model_id,
            "version": version,
            "capabilities": sorted({_text(x) for x in capabilities if _text(x)}),
            "status": status,
            "approved_by": approved_by,
            "registered_at": utc_now(),
        }
        self._records[key] = record
        return deepcopy(record)

    def retire(self, key: str, actor_id: str) -> dict[str, Any]:
        if key not in self._records:
            raise KeyError("model_not_found")
        self._records[key]["status"] = "retired"
        self._records[key]["retired_by"] = actor_id
        self._records[key]["retired_at"] = utc_now()
        return deepcopy(self._records[key])

    def list(self) -> list[dict[str, Any]]:
        return deepcopy(list(self._records.values()))


def build_privacy_export(*, subject_id: str, records: Iterable[dict[str, Any]]) -> dict[str, Any]:
    selected = []
    for record in records:
        if not isinstance(record, dict):
            continue
        owners = {record.get("user_id"), record.get("owner_id"), record.get("actor_id"), record.get("subject_id")}
        if subject_id in owners:
            selected.append(deepcopy(record))
    return {"schema_version": "privacy-export-v1", "subject_id": subject_id, "generated_at": utc_now(), "records": selected}


def build_privacy_deletion_plan(*, subject_id: str, records: Iterable[dict[str, Any]]) -> dict[str, Any]:
    record_ids = []
    for record in records:
        if isinstance(record, dict) and subject_id in {record.get("user_id"), record.get("owner_id"), record.get("actor_id"), record.get("subject_id")}:
            if _text(record.get("id")):
                record_ids.append(record["id"])
    return {"schema_version": "privacy-deletion-v1", "subject_id": subject_id, "status": "ready_for_confirmation", "record_ids": record_ids, "requires_explicit_confirmation": True}


def apply_privacy_deletion(*, subject_id: str, records: Iterable[dict[str, Any]]) -> dict[str, Any]:
    remaining, removed = [], []
    for record in records:
        owners = {record.get("user_id"), record.get("owner_id"), record.get("actor_id"), record.get("subject_id")} if isinstance(record, dict) else set()
        if isinstance(record, dict) and subject_id in owners:
            removed.append(record.get("id"))
        else:
            remaining.append(deepcopy(record))
    return {"schema_version": "privacy-deletion-v1", "subject_id": subject_id, "status": "deleted", "removed_ids": [x for x in removed if x], "remaining_records": remaining}


def create_incident(*, course_id: str, severity: str, category: str, summary: str, detected_by: str) -> dict[str, Any]:
    if severity not in {"low", "medium", "high", "critical"}:
        raise ValueError("incident_severity_invalid")
    if not all(_text(x) for x in (course_id, category, summary, detected_by)):
        raise ValueError("incident_fields_required")
    return {
        "id": f"incident-{uuid4().hex}",
        "schema_version": "incident-v1",
        "course_id": course_id,
        "severity": severity,
        "category": category,
        "summary": summary,
        "detected_by": detected_by,
        "status": "open",
        "timeline": [{"status": "open", "actor_id": detected_by, "at": utc_now()}],
    }


def transition_incident(incident: dict[str, Any], *, target_status: str, actor_id: str, note: str = "") -> dict[str, Any]:
    current = _text(incident.get("status"))
    if target_status not in INCIDENT_STATUSES or target_status not in INCIDENT_TRANSITIONS.get(current, set()):
        raise ValueError("incident_transition_invalid")
    updated = deepcopy(incident)
    updated["status"] = target_status
    updated.setdefault("timeline", []).append({"status": target_status, "actor_id": actor_id, "note": _text(note), "at": utc_now()})
    return updated


def build_evaluation_manifest(*, course_id: str, intervention: str, comparison: str, primary_outcome: str, secondary_outcomes: Iterable[str]) -> dict[str, Any]:
    if not all(_text(x) for x in (course_id, intervention, comparison, primary_outcome)):
        raise ValueError("evaluation_manifest_fields_required")
    return {
        "schema_version": "evaluation-manifest-v1",
        "course_id": course_id,
        "intervention": intervention,
        "comparison": comparison,
        "primary_outcome": primary_outcome,
        "secondary_outcomes": [x for x in secondary_outcomes if _text(x)],
        "preregistered": False,
        "causal_claim_status": "not_established",
        "created_at": utc_now(),
    }
