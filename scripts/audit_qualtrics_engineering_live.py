"""Read-only Qualtrics audit for the inactive ALGET engineering study projects."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = Path(
    r"C:\Users\jewoo\Desktop\_System\Work\25_Service\IRB\AlGET\2026_revision\Qualtrics"
    r"\ALGET_Qualtrics_Live_Project_Manifest.json"
)
DEFAULT_EVIDENCE = ROOT / "research/evidence/qualtrics_live_readonly_audit_2026-08-15.json"
DEFAULT_CODEBOOK = ROOT / "research/measures/qualtrics_candidate_v2/ALGET_Qualtrics_Codebook_CandidateV2.csv"
PII_TAGS = {"PII_FULL_NAME", "PII_EMAIL"}
SCORING_PREFIXES = ("PRE_", "POST_", "RET_")


def load_token(token_file: Path | None) -> str:
    token = os.environ.get("QUALTRICS_API_TOKEN") or os.environ.get("QUALTRICS_TOKEN")
    if not token and token_file:
        token = token_file.read_text(encoding="utf-8").splitlines()[0].strip()
    if not token:
        raise ValueError("Set QUALTRICS_API_TOKEN/QUALTRICS_TOKEN or pass --token-file")
    return token


def api_get(base: str, token: str, path: str) -> dict:
    request = urllib.request.Request(
        base + path,
        headers={"X-API-TOKEN": token, "Accept": "application/json"},
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.loads(response.read().decode("utf-8"))


def positive_scoring_choices(question: dict) -> list[int]:
    positive = []
    for row in question.get("GradingData") or []:
        grades = row.get("Grades") or {}
        if any(float(value) > 0 for value in grades.values()):
            positive.append(int(row["ChoiceID"]))
    return positive


def evaluate_survey(
    survey: dict,
    expected_count: int,
    source: str | None = None,
    scoring_key: dict[str, int] | None = None,
    expected_question_text: dict[str, str] | None = None,
    response_counts: dict[str, int] | None = None,
) -> dict:
    questions = list(survey.get("Questions", {}).values())
    tags = {question.get("DataExportTag") for question in questions}
    pii_present = sorted(tags & PII_TAGS)
    private_pii = sorted(
        question.get("DataExportTag") for question in questions
        if question.get("DataExportTag") in PII_TAGS
        and question.get("DataVisibility", {}).get("Private") is True
    )
    scored = sorted(
        question.get("DataExportTag") for question in questions
        if question.get("DataExportTag", "").startswith(SCORING_PREFIXES)
        and question.get("GradingData")
    )
    options = survey.get("SurveyOptions", {})
    scoring = survey.get("Scoring", {})
    flow_text = json.dumps(survey.get("SurveyFlow", {}), sort_keys=True)
    flow_checks = {
        "flow_has_nonconsent_end": "participant did not consent" in flow_text,
        "flow_has_under18_end": "participant is under 18" in flow_text,
        "flow_has_ineligible_end": "enrollment eligibility not met" in flow_text,
        "flow_has_contact_denial_end": (
            "restricted contact fields" in flow_text or "contact storage not authorized" in flow_text
        ),
        "flow_has_test_integrity_end": "assessment integrity not agreed" in flow_text,
        "flow_has_retention_integrity_end": "retention integrity not agreed" in flow_text,
    }
    required_flow_keys = {
        "01_": (
            "flow_has_nonconsent_end",
            "flow_has_under18_end",
            "flow_has_ineligible_end",
            "flow_has_contact_denial_end",
        ),
        "02_": ("flow_has_contact_denial_end",),
        "03_": ("flow_has_test_integrity_end",),
        "04_": ("flow_has_contact_denial_end",),
        "05_": ("flow_has_retention_integrity_end",),
    }
    required_flow_checks = {
        key: flow_checks[key]
        for prefix, keys in required_flow_keys.items()
        if source and source.startswith(prefix)
        for key in keys
        if key != "flow_has_contact_denial_end" or "PII_ACK" in tags or "CONTACT_CONFIRM" in tags
    }
    privacy_checks = {}
    if source and source.startswith(("01_", "02_", "03_", "05_")):
        privacy_checks["outcome_form_has_no_direct_pii"] = not pii_present
    elif source and source.startswith("04_"):
        privacy_checks["gift_form_has_minimized_direct_pii"] = set(pii_present) == PII_TAGS
    structure_checks = {
        "inactive": survey.get("SurveyStatus") == "Inactive",
        "no_auditable_responses": int((response_counts or {}).get("auditable", 0)) == 0,
        "question_count": len(questions) == expected_count,
        "ballot_box_prevention": str(options.get("BallotBoxStuffingPrevention")).lower() == "true",
        "no_index": str(options.get("NoIndex")).lower() in {"yes", "true"},
        "secure_response_files": str(options.get("SecureResponseFiles")).lower() == "true",
        "score_feedback_hidden": scoring.get("ScoringSummaryAfterQuestions") == 0 and scoring.get("ScoringSummaryAfterSurvey") == 0,
        **required_flow_checks,
        **privacy_checks,
    }
    if source and source.startswith("01_") and expected_question_text:
        live_text = {
            question.get("DataExportTag"): question.get("QuestionText", "")
            for question in questions
        }
        structure_checks["consent_review_text_matches_local"] = all(
            live_text.get(tag) == expected_question_text.get(tag)
            for tag in ("CONSENT_NOTICE", "CONSENT")
        )
    scoring_key_checks = {}
    for question in questions:
        tag = question.get("DataExportTag")
        if scoring_key and tag in scoring_key:
            positive = positive_scoring_choices(question)
            scoring_key_checks[tag] = {
                "expected_choice": scoring_key[tag],
                "positive_choices": positive,
                "pass": positive == [scoring_key[tag]],
            }
    return {
        "structure_checks": structure_checks,
        "structure_pass": all(structure_checks.values()),
        "question_count": len(questions),
        "response_counts": response_counts or {},
        "pii_tags_present": pii_present,
        "pii_tags_private": private_pii,
        "scored_selected_response_tags": scored,
        "scoring_key_checks": scoring_key_checks,
        "scoring_key_pass": bool(scoring_key_checks) and all(
            row["pass"] for row in scoring_key_checks.values()
        ),
        **flow_checks,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--token-file", type=Path)
    parser.add_argument("--datacenter", default="az1")
    parser.add_argument("--codebook", type=Path, default=DEFAULT_CODEBOOK)
    parser.add_argument("--output", type=Path, default=DEFAULT_EVIDENCE)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    with args.codebook.open(newline="", encoding="utf-8-sig") as handle:
        scoring_key = {
            row["export_tag"]: int(row["correct_choice"])
            for row in csv.DictReader(handle)
            if row.get("correct_choice") and row.get("export_tag", "").startswith(SCORING_PREFIXES)
        }
    token = load_token(args.token_file)
    base = f"https://{args.datacenter}.qualtrics.com/API/v3"
    whoami = api_get(base, token, "/whoami")
    results = {}
    for item in manifest["surveys"]:
        survey_id = item["survey_id"]
        definition = api_get(base, token, f"/survey-definitions/{survey_id}")["result"]
        survey_record = api_get(base, token, f"/surveys/{survey_id}")["result"]
        source_qsf = json.loads((args.codebook.parent / item["source"]).read_text(encoding="utf-8"))
        expected_question_text = {
            element["Payload"].get("DataExportTag"): element["Payload"].get("QuestionText", "")
            for element in source_qsf["SurveyElements"]
            if element.get("Element") == "SQ"
        }
        results[survey_id] = {
            "source": item["source"],
            **evaluate_survey(
                definition,
                int(item.get("question_count") or item["questions"]),
                item["source"],
                scoring_key,
                expected_question_text,
                survey_record.get("responseCounts", {}),
            ),
        }
    structure_pass = all(item["structure_pass"] for item in results.values())
    structure_holds = {
        survey_id: sorted(
            key for key, value in item["structure_checks"].items()
            if value is False
        )
        for survey_id, item in results.items()
        if any(value is False for value in item["structure_checks"].values())
    }
    report = {
        "status": (
            "pass_structure_pending_authenticated_ui_qa"
            if structure_pass else "hold_required_flow_and_authenticated_ui_qa"
        ),
        "audit_mode": "read_only_no_response_access",
        "authenticated": bool(whoami.get("result")),
        "datacenter": args.datacenter,
        "credential_recorded": False,
        "responses_or_contacts_read": False,
        "manifest_sha256": hashlib.sha256(args.manifest.read_bytes()).hexdigest(),
        "surveys": results,
        "required_flow_holds": {
            survey_id: [key for key in keys if key.startswith("flow_has_")]
            for survey_id, keys in structure_holds.items()
            if any(key.startswith("flow_has_") for key in keys)
        },
        "structure_holds": structure_holds,
        "remaining_authenticated_ui_gates": {
            "score_12_selected_response_items_on_each_A_B_C_form": all(
                len(item["scored_selected_response_tags"]) == 12 and item["scoring_key_pass"]
                for item in results.values()
                if item["source"].startswith(("01_", "03_", "05_"))
            ),
            "mark_all_pii_fields_sensitive_or_restricted": all(
                set(item["pii_tags_present"]) == set(item["pii_tags_private"])
                for item in results.values()
            ),
            "outcome_forms_exclude_direct_pii_and_gift_form_is_minimized": all(
                value
                for item in results.values()
                for key, value in item["structure_checks"].items()
                if key in {"outcome_form_has_no_direct_pii", "gift_form_has_minimized_direct_pii"}
            ),
            "synthetic_path_mobile_duplicate_scoring_export_qa": False,
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({
        "status": report["status"],
        "authenticated": report["authenticated"],
        "survey_count": len(results),
        "remaining_authenticated_ui_gates": report["remaining_authenticated_ui_gates"],
    }, indent=2))
    return 0 if structure_pass else 1


if __name__ == "__main__":
    raise SystemExit(main())
