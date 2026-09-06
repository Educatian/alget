"""Update the inactive ALGET gift-card survey for manual email fulfillment.

This script modifies only the named inactive gift-card project. It never
publishes or activates a survey and never prints the API token.
"""
from __future__ import annotations

import argparse
import copy
import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_QSF = (
    ROOT
    / "research/measures/qualtrics_candidate_v2/04_ALGET_GiftCard_Contact_CandidateV2.qsf"
)
DEFAULT_PRE_QSF = (
    ROOT
    / "research/measures/qualtrics_candidate_v2/01_ALGET_Engineering_PreSurvey_CandidateV2.qsf"
)
DEFAULT_EVIDENCE = (
    ROOT / "research/evidence/qualtrics_gift_manual_email_update_2026-08-25.json"
)
DEFAULT_SURVEY_ID = "SV_0oz7vztCdDCiVr8"
DEFAULT_PRE_SURVEY_ID = "SV_5z5mWwX62DyFRCC"
DEFAULT_DATACENTER = "universityofalabama.pdx1"
LIVE_NAME = (
    "ALGET Gift Card Contact - Candidate v2.4 - RESTRICTED - "
    "MANUAL EMAIL REVIEW - INACTIVE"
)
EXPECTED_TAGS = {
    "INCENTIVE_NOTICE",
    "STUDY_ID",
    "CONTACT_CONFIRM",
    "PII_FULL_NAME",
    "PII_EMAIL",
    "DELIVERY_METHOD_NOTICE",
    "MANUAL_EMAIL_REVIEW_ACK",
    "MILESTONE",
}
DIRECT_PII_TAGS = {"PII_FULL_NAME", "PII_EMAIL"}
PROHIBITED_TAGS = {"PII_PHONE", "PII_CONTACT_PREF"}


class QualtricsApi:
    def __init__(self, token: str, datacenter: str) -> None:
        self.base = f"https://{datacenter}.qualtrics.com/API/v3"
        self.headers = {
            "X-API-TOKEN": token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def call(self, method: str, path: str, payload: dict | None = None) -> dict:
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            self.base + path, data=body, headers=self.headers, method=method
        )
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:2000]
            raise RuntimeError(
                f"Qualtrics {method} {path} failed ({exc.code}): {detail}"
            ) from exc


def load_token(path: Path | None) -> str:
    token = os.environ.get("QUALTRICS_API_TOKEN") or os.environ.get("QUALTRICS_TOKEN")
    if not token and path:
        token = path.read_text(encoding="utf-8-sig").splitlines()[0].strip()
    if not token:
        raise ValueError("Set a Qualtrics token environment variable or pass --token-file")
    return token


def qsf_questions(path: Path) -> dict[str, dict]:
    qsf = json.loads(path.read_text(encoding="utf-8"))
    return {
        element["Payload"]["DataExportTag"]: element["Payload"]
        for element in qsf["SurveyElements"]
        if element["Element"] == "SQ"
    }


def update_payload(source: dict) -> dict:
    payload = copy.deepcopy(source)
    payload.pop("QuestionID", None)
    # The UA brand currently rejects DataVisibility.Private through API
    # (403/QMST_2.1). Preserve Private=true in the QSF instrument-of-record,
    # but do not make the entire update fail at this unsupported field.
    if payload.get("DataVisibility", {}).get("Private") is True:
        payload.pop("DataVisibility", None)
    return payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--token-file", type=Path)
    parser.add_argument("--survey-id", default=DEFAULT_SURVEY_ID)
    parser.add_argument("--pre-survey-id", default=DEFAULT_PRE_SURVEY_ID)
    parser.add_argument("--datacenter", default=DEFAULT_DATACENTER)
    parser.add_argument("--qsf", type=Path, default=DEFAULT_QSF)
    parser.add_argument("--pre-qsf", type=Path, default=DEFAULT_PRE_QSF)
    parser.add_argument("--evidence", type=Path, default=DEFAULT_EVIDENCE)
    args = parser.parse_args()

    api = QualtricsApi(load_token(args.token_file), args.datacenter)
    source = qsf_questions(args.qsf)
    if set(source) != EXPECTED_TAGS:
        raise RuntimeError(f"Unexpected source tags: {sorted(source)}")

    before = api.call("GET", f"/survey-definitions/{args.survey_id}")["result"]
    if before.get("SurveyStatus") != "Inactive":
        raise RuntimeError("Refusing to edit a survey that is not inactive")
    actual_questions = before.get("Questions", {})
    if len(actual_questions) != len(source):
        raise RuntimeError("Cloud/source question counts differ")

    # Map source positions to the existing question IDs. The Candidate v2.3 and
    # v2.4 forms intentionally retain the same eight-question order.
    existing_by_position = sorted(
        actual_questions.items(),
        key=lambda pair: int(pair[0].removeprefix("QID")),
    )
    source_by_position = sorted(
        source.values(),
        key=lambda question: int(question["QuestionID"].removeprefix("QID")),
    )
    updated = []
    for (question_id, _), source_question in zip(existing_by_position, source_by_position):
        api.call(
            "PUT",
            f"/survey-definitions/{args.survey_id}/questions/{question_id}",
            update_payload(source_question),
        )
        updated.append({"question_id": question_id, "tag": source_question["DataExportTag"]})

    options = api.call("GET", f"/survey-definitions/{args.survey_id}/options")["result"]
    options["SurveyName"] = LIVE_NAME
    options["SurveyTitle"] = LIVE_NAME
    api.call("PUT", f"/survey-definitions/{args.survey_id}/options", options)
    api.call("PUT", f"/surveys/{args.survey_id}", {"isActive": False})

    # Keep the compensation description in the inactive pre-survey consent
    # review copy synchronized with the email-only manual-fulfillment policy.
    pre_source = qsf_questions(args.pre_qsf)["CONSENT_NOTICE"]
    pre_before = api.call("GET", f"/survey-definitions/{args.pre_survey_id}")["result"]
    if pre_before.get("SurveyStatus") != "Inactive":
        raise RuntimeError("Refusing to edit a pre-survey that is not inactive")
    pre_qid = next(
        question_id
        for question_id, question in pre_before.get("Questions", {}).items()
        if question.get("DataExportTag") == "CONSENT_NOTICE"
    )
    api.call(
        "PUT",
        f"/survey-definitions/{args.pre_survey_id}/questions/{pre_qid}",
        update_payload(pre_source),
    )
    api.call("PUT", f"/surveys/{args.pre_survey_id}", {"isActive": False})

    after = api.call("GET", f"/survey-definitions/{args.survey_id}")["result"]
    pre_after = api.call("GET", f"/survey-definitions/{args.pre_survey_id}")["result"]
    pre_consent = next(
        question
        for question in pre_after.get("Questions", {}).values()
        if question.get("DataExportTag") == "CONSENT_NOTICE"
    )
    tags = {q.get("DataExportTag") for q in after.get("Questions", {}).values()}
    private_pii = {
        q.get("DataExportTag")
        for q in after.get("Questions", {}).values()
        if q.get("DataExportTag") in DIRECT_PII_TAGS
        and q.get("DataVisibility", {}).get("Private") is True
    }
    email_question = next(
        q for q in after.get("Questions", {}).values()
        if q.get("DataExportTag") == "PII_EMAIL"
    )
    checks = {
        "survey_inactive": after.get("SurveyStatus") == "Inactive",
        "expected_eight_tags": tags == EXPECTED_TAGS,
        "only_name_and_email_are_direct_pii": (tags & DIRECT_PII_TAGS) == DIRECT_PII_TAGS,
        "phone_and_contact_preference_removed": not (tags & PROHIBITED_TAGS),
        "manual_review_ack_present": "MANUAL_EMAIL_REVIEW_ACK" in tags,
        "email_only_notice_present": "DELIVERY_METHOD_NOTICE" in tags,
        "email_format_validation_enabled": (
            email_question.get("Validation", {}).get("Settings", {}).get("Type")
            == "ContentType"
            and email_question.get("Validation", {}).get("Settings", {}).get("ContentType")
            == "ValidEmail"
            and email_question.get("Validation", {}).get("Settings", {}).get("ForceResponse")
            == "ON"
        ),
        "no_auto_publish_or_activation": after.get("SurveyStatus") == "Inactive",
        "pre_consent_describes_manual_email_fulfillment": (
            "email after manual completion verification"
            in pre_consent.get("QuestionText", "")
            and pre_after.get("SurveyStatus") == "Inactive"
        ),
    }
    evidence = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "survey_id": args.survey_id,
        "survey_name": LIVE_NAME,
        "pre_survey_id": args.pre_survey_id,
        "operation": "inactive_manual_email_fulfillment_update",
        "updated_questions": updated,
        "direct_pii_tags": sorted(DIRECT_PII_TAGS),
        "private_pii_tags_readback": sorted(private_pii),
        "private_field_api_constraint": (
            "UA brand rejects DataVisibility.Private via API; QSF remains Private=true and "
            "cloud project must remain owner-only until brand-admin control is available."
        ),
        "checks": checks,
        "passed": all(checks.values()),
    }
    args.evidence.parent.mkdir(parents=True, exist_ok=True)
    args.evidence.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(evidence, indent=2))
    if not evidence["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
