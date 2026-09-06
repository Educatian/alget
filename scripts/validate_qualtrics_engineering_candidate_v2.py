"""Fail-closed structural audit for the non-live Qualtrics candidate v2 package."""
from __future__ import annotations

import csv
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

import create_qualtrics_engineering_candidate_v2 as candidate  # noqa: E402


PACKAGE = candidate.OUTPUT
REPORT = PACKAGE / "candidate_validation.json"
EXPECTED_COUNTS = {
    "01_ALGET_Engineering_PreSurvey_CandidateV2.qsf": 35,
    "02_ALGET_Engineering_PostSurvey_CandidateV2.qsf": 17,
    "03_ALGET_BioInspired_PostTest_CandidateV2.qsf": 18,
    "04_ALGET_GiftCard_Contact_CandidateV2.qsf": 8,
    "05_ALGET_BioInspired_RetentionTest_CandidateV2.qsf": 18,
}
FORM_PREFIX = {"A_pre": "PRE_", "B_post": "POST_", "C_retention": "RET_"}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def qsf_questions(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["SurveyEntry"]["SurveyStatus"] == "Inactive"
    assert "inactive review copy" in data["SurveyEntry"]["SurveyDescription"]
    questions = [element["Payload"] for element in data["SurveyElements"] if element["Element"] == "SQ"]
    declared = int(next(
        element["SecondaryAttribute"]
        for element in data["SurveyElements"]
        if element["Element"] == "QC"
    ))
    assert len(questions) == declared == EXPECTED_COUNTS[path.name]
    return questions


def qsf_flow(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return next(
        element["Payload"]["Flow"]
        for element in data["SurveyElements"]
        if element["Element"] == "FL"
    )


def validate() -> dict:
    manifest_path = PACKAGE / "candidate_manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    codebook_path = PACKAGE / "ALGET_Qualtrics_Codebook_CandidateV2.csv"
    with codebook_path.open(newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))
    by_tag = {row["export_tag"]: row for row in rows}
    selected = [row for row in rows if row["export_tag"] in candidate.TAG_TO_FAMILY]
    constructed = [row for row in rows if row["export_tag"] in candidate.CONSTRUCTED_FAMILY]
    qsf_by_name = {path.name: qsf_questions(path) for path in sorted(PACKAGE.glob("*.qsf"))}
    qsf_flow_by_name = {path.name: qsf_flow(path) for path in sorted(PACKAGE.glob("*.qsf"))}

    qsf_by_tag = {
        question["DataExportTag"]: question
        for questions in qsf_by_name.values()
        for question in questions
    }
    expected_key_balance = Counter({"1": 3, "2": 3, "3": 3, "4": 3})
    key_balance = {
        form: Counter(
            row["correct_choice"]
            for row in selected
            if row["export_tag"].startswith(prefix)
        )
        for form, prefix in FORM_PREFIX.items()
    }
    family_tags = defaultdict(list)
    mapped_distractors = True
    correct_qsf_alignment = True
    for row in selected:
        family_tags[row["item_family"]].append(row)
        choices = json.loads(row["choices_json"])
        correct = int(row["correct_choice"])
        misconceptions = json.loads(row["distractor_misconceptions_json"])
        mapped_distractors &= (
            len(choices) == 4
            and len(misconceptions) == 3
            and set(misconceptions) == {str(index) for index in range(1, 5) if index != correct}
            and all(code.startswith(row["export_tag"].lower() + "::") for code in misconceptions.values())
            and len(set(misconceptions.values())) == 3
        )
        qsf = qsf_by_tag[row["export_tag"]]
        qsf_choices = [qsf["Choices"][str(index)]["Display"] for index in range(1, 5)]
        correct_qsf_alignment &= qsf_choices == choices and choices[correct - 1] == row["correct_text"]

    family_form_coverage = all(
        len(items) == 3
        and {tag.split("_", 1)[0] for tag in (item["export_tag"] for item in items)}
        == {"PRE", "POST", "RET"}
        for items in family_tags.values()
    )
    no_exact_reuse = all(
        len({item["question_text"] for item in items}) == 3
        and len({item["choices_json"] for item in items}) == 3
        for items in family_tags.values()
    )
    family_construct_metadata = all(
        len({item["cognitive_operation"] for item in items}) == 1
        and len({item["correct_rationale"] for item in items}) == 1
        and all(item["cognitive_operation"] and item["correct_rationale"] for item in items)
        for items in family_tags.values()
    ) and len({row["cognitive_operation"] for row in selected}) == 12
    constructed_dimensions = all(
        json.loads(row["elicits_dimensions_json"]) == {
            "constraint_tradeoff_reasoning": True,
            "evidence_alignment": True,
            "mechanism_accuracy": True,
            "transfer_justification": True,
        }
        and (
            "mechanism" in row["question_text"].lower()
            or (
                row["task_family"] == "swarm"
                and "local" in row["question_text"].lower()
                and "rule" in row["question_text"].lower()
                and any(word in row["question_text"].lower() for word in ("system-level", "system behavior", "emergent"))
            )
        )
        and any(word in row["question_text"].lower() for word in ("test", "comparison"))
        and any(
            word in row["question_text"].lower()
            for word in (
                "predicted result",
                "predicted outcome",
                "result that would support or challenge",
            )
        )
        and any(
            word in row["question_text"].lower()
            for word in ("constraint", "trade-off", "boundary", "boundaries", "risk", "failure")
        )
        for row in constructed
    )

    diff_path = PACKAGE / "CURRENT_VS_CANDIDATE_DIFF.csv"
    with diff_path.open(newline="", encoding="utf-8-sig") as handle:
        diff_rows = list(csv.DictReader(handle))
    expert_template_path = PACKAGE / "fieldwork/ENGINEERING_EXPERT_REVIEW_TEMPLATE.csv"
    with expert_template_path.open(newline="", encoding="utf-8-sig") as handle:
        expert_rows = list(csv.DictReader(handle))
    expert_selected = [row for row in expert_rows if row["item_type"] == "selected_response"]
    expert_constructed = [row for row in expert_rows if row["item_type"] == "constructed_transfer"]
    files_match = all(
        (PACKAGE / item["path"]).exists()
        and (PACKAGE / item["path"]).stat().st_size == item["bytes"]
        and sha256(PACKAGE / item["path"]) == item["sha256"]
        for item in manifest["files"]
    )
    original_hashes_match = all(
        (candidate.base.OUTPUT / name).exists()
        and sha256(candidate.base.OUTPUT / name) == digest
        for name, digest in manifest["original_qsf_sha256"].items()
    )
    pii_tags = {"PII_FULL_NAME", "PII_EMAIL"}
    assessment_tags = set(candidate.TAG_TO_FAMILY) | set(candidate.CONSTRUCTED_FAMILY)
    assessment_rows = [row for row in rows if row["export_tag"] in assessment_tags]
    pii_by_file = {
        name: {
            question["DataExportTag"]: question
            for question in questions
            if question.get("DataExportTag") in pii_tags
        }
        for name, questions in qsf_by_name.items()
    }
    outcome_names = {
        "01_ALGET_Engineering_PreSurvey_CandidateV2.qsf",
        "02_ALGET_Engineering_PostSurvey_CandidateV2.qsf",
        "03_ALGET_BioInspired_PostTest_CandidateV2.qsf",
        "05_ALGET_BioInspired_RetentionTest_CandidateV2.qsf",
    }
    gift_name = "04_ALGET_GiftCard_Contact_CandidateV2.qsf"
    pre_name = "01_ALGET_Engineering_PreSurvey_CandidateV2.qsf"
    demographic_tags = candidate.DEMOGRAPHIC_TAGS
    demographic_by_file = {
        name: {
            question["DataExportTag"]: question
            for question in questions
            if question.get("DataExportTag") in demographic_tags
        }
        for name, questions in qsf_by_name.items()
    }
    race_question = demographic_by_file[pre_name].get("DEMO_RACE_ETHNICITY", {})
    race_choices = race_question.get("Choices", {})
    consent_notice = qsf_by_tag.get("CONSENT_NOTICE", {}).get("QuestionText", "")
    embedded_linkage_ok = all(
        flow
        and flow[0].get("Type") == "EmbeddedData"
        and {
            entry.get("Field") for entry in flow[0].get("EmbeddedData", [])
        } == set(candidate.EMBEDDED_LINKAGE_FIELDS)
        for flow in qsf_flow_by_name.values()
    )
    checks = {
        "five_inactive_qsf_files_have_expected_counts": set(qsf_by_name) == set(EXPECTED_COUNTS),
        "candidate_is_explicitly_non_live_and_non_validated": (
            manifest["status"] == "inactive_cloud_review_not_activated"
            and manifest["live_qualtrics_changed"] is False
            and manifest["original_package_changed"] is False
            and manifest["expert_or_pilot_evidence_claimed"] is False
        ),
        "all_manifest_files_match": files_match,
        "original_qsf_package_hashes_unchanged": original_hashes_match,
        "assessment_counts_are_36_selected_and_9_constructed": len(selected) == 36 and len(constructed) == 9,
        "all_selected_items_use_one_high_cognitive_demand": (
            {row["cognitive_demand"] for row in selected} == {"apply_analyze_or_evaluate"}
        ),
        "all_12_families_have_explicit_cognitive_operation_and_correct_rationale": (
            family_construct_metadata
        ),
        "all_12_families_cover_A_B_C_without_exact_reuse": (
            len(family_tags) == 12 and family_form_coverage and no_exact_reuse
        ),
        "all_selected_keys_are_balanced_and_qsf_aligned": (
            all(balance == expected_key_balance for balance in key_balance.values())
            and correct_qsf_alignment
        ),
        "all_108_distractors_have_item_specific_hypothesis_codes": mapped_distractors,
        "all_9_constructed_prompts_elicit_all_4_scored_dimensions": constructed_dimensions,
        "candidate_diff_is_complete_and_blank_for_expert_decision": (
            len(diff_rows) == 45
            and sum(row["change_type"] == "revised_candidate" for row in diff_rows) == 27
            and all(not row["expert_decision"] and not row["expert_comment"] for row in diff_rows)
        ),
        "fieldwork_packet_has_45_expert_rows": (
            manifest["fieldwork"] == {
                "expert_items": 45,
                "selected_response_items": 36,
                "constructed_transfer_items": 9,
            }
            and len(expert_rows) == 45
            and len(expert_selected) == 36
            and len(expert_constructed) == 9
            and all(
                row["item_family"]
                and row["cognitive_demand"]
                and row["cognitive_operation"]
                and row["correct_rationale"]
                and len(json.loads(row["distractor_misconceptions_json"])) == 3
                for row in expert_selected
            )
            and all(
                row["task_family"]
                and all(json.loads(row["elicits_dimensions_json"]).values())
                for row in expert_constructed
            )
        ),
        "pii_is_not_an_assessment_or_model_field": (
            not any(row["export_tag"] in pii_tags for row in assessment_rows)
            and all(row["private_pii"] == "False" for row in assessment_rows)
        ),
        "participant_facing_consent_draft_covers_core_irb_elements_and_remains_fail_closed": (
            "STUDENT REVIEW COPY" in consent_notice
            and "assigned by chance" in consent_notice
            and "Participation is voluntary" in consent_notice
            and "205-348-8461" in consent_notice
            and "[PI NAME, TITLE, EMAIL, PHONE]" in consent_notice
            and "[AMOUNT]" in consent_notice
        ),
        "all_forms_declare_alget_embedded_linkage_before_blocks": embedded_linkage_ok,
        "study_id_linked_demographics_and_direct_pii_are_privacy_separated": (
            all(not pii_by_file[name] for name in outcome_names)
            and set(pii_by_file[gift_name]) == pii_tags
            and all(
                question.get("DataVisibility", {}).get("Private") is True
                for question in pii_by_file[gift_name].values()
            )
            and "PII_ACK" not in qsf_by_tag
            and all(
                any(question.get("DataExportTag") == "STUDY_ID" for question in qsf_by_name[name])
                for name in outcome_names | {gift_name}
            )
            and set(demographic_by_file[pre_name]) == demographic_tags
            and all(
                not demographic_by_file[name]
                for name in set(qsf_by_name) - {pre_name}
            )
            and all(
                question.get("Validation", {}).get("Settings", {}).get("ForceResponse") == "ON"
                and any(
                    choice.get("Display") == "Prefer not to answer"
                    for choice in question.get("Choices", {}).values()
                )
                for question in demographic_by_file[pre_name].values()
            )
            and race_question.get("Selector") == "MAVR"
            and len(race_choices) == 8
            and race_choices.get("8", {}).get("ExclusiveAnswer") is True
            and by_tag["MAJOR_CATEGORY"]["question_type"] == "MC"
            and by_tag["MAJOR_CATEGORY"]["sensitive_demographic"] == "True"
            and "MAJOR" not in by_tag
        ),
    }
    report = {
        "status": "pass_candidate_structure_not_scientific_validation" if all(checks.values()) else "fail",
        "candidate_version": candidate.VERSION,
        "scientific_validity_claimed": False,
        "live_qualtrics_changed": False,
        "checks_passed": sum(checks.values()),
        "checks_total": len(checks),
        "checks": checks,
        "selected_response_items": len(selected),
        "constructed_items": len(constructed),
        "distractor_hypotheses": sum(
            len(json.loads(row["distractor_misconceptions_json"])) for row in selected
        ),
        "revised_candidates": sum(row["change_type"] == "revised_candidate" for row in diff_rows),
        "retained_candidates": sum(row["change_type"] == "retained_candidate" for row in diff_rows),
        "remaining_external_gates": [
            "6-to-8 content experts and 3-to-5 measurement experts",
            "8-to-12 cognitive interviews",
            "30-to-50 learner measurement pilot and form linking",
            "approved-version reconciliation and authenticated inactive Qualtrics UI QA",
            "visible-versus-embedded Study ID mismatch QA with synthetic responses",
        ],
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> int:
    report = validate()
    print(json.dumps(report, indent=2))
    return 0 if report["status"].startswith("pass_") else 1


if __name__ == "__main__":
    raise SystemExit(main())
