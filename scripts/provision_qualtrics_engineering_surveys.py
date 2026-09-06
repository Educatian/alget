"""Provision the inactive ALGET engineering study surveys through Qualtrics API v3.

The source QSF files remain the instrument-of-record. This script recreates their
blocks and questions with supported Survey Definition endpoints, adds the required
early-termination branches, and verifies that every project remains inactive.

Secrets are read from an explicitly supplied token file or from
QUALTRICS_API_TOKEN/QUALTRICS_TOKEN. The script never prints the token and does not
publish or activate a survey.
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


LIVE_NAMES = {
    "01_ALGET_Engineering_PreSurvey_CandidateV2.qsf": (
        "ALGET Engineering Pre Survey - Candidate v2.3 - STUDENT REVIEW - INACTIVE"
    ),
    "02_ALGET_Engineering_PostSurvey_CandidateV2.qsf": (
        "ALGET Engineering Post Survey - Candidate v2.3 - STUDENT REVIEW - INACTIVE"
    ),
    "03_ALGET_BioInspired_PostTest_CandidateV2.qsf": (
        "ALGET Bio-Inspired Posttest - Candidate v2.3 - STUDENT REVIEW - INACTIVE"
    ),
    "04_ALGET_GiftCard_Contact_CandidateV2.qsf": (
        "ALGET Gift Card Contact - Candidate v2.3 - RESTRICTED - STUDENT REVIEW - INACTIVE"
    ),
    "05_ALGET_BioInspired_RetentionTest_CandidateV2.qsf": (
        "ALGET Bio-Inspired Retention - Candidate v2.3 - STUDENT REVIEW - INACTIVE"
    ),
}

EMBEDDED_LINKAGE_FIELDS = ("study_id", "wave", "cohort")


class QualtricsApi:
    def __init__(self, token: str, datacenter: str) -> None:
        self.base = f"https://{datacenter}.qualtrics.com/API/v3"
        self.headers = {
            "X-API-TOKEN": token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def call(self, method: str, path_or_url: str, payload: dict | None = None) -> dict:
        url = path_or_url if path_or_url.startswith("https://") else self.base + path_or_url
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(url, data=body, headers=self.headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:2000]
            raise RuntimeError(f"Qualtrics {method} {urllib.parse.urlsplit(url).path} failed ({exc.code}): {detail}") from exc

    def list_surveys(self) -> list[dict]:
        surveys: list[dict] = []
        url: str | None = "/surveys?offset=0"
        while url:
            response = self.call("GET", url)
            surveys.extend(response["result"]["elements"])
            url = response["result"].get("nextPage")
        return surveys


def qsf_elements(qsf: dict, element_type: str) -> list[dict]:
    return [element for element in qsf["SurveyElements"] if element["Element"] == element_type]


def end_branch(
    question_id: str,
    choice_id: int,
    description: str,
    flow_id: str,
    end_flow_id: str,
) -> dict:
    locator = f"q://{question_id}/SelectableChoice/{choice_id}"
    return {
        "Type": "Branch",
        "FlowID": flow_id,
        "Description": description,
        "BranchLogic": {
            "0": {
                "0": {
                    "LogicType": "Question",
                    "QuestionID": question_id,
                    "QuestionIsInLoop": "no",
                    "ChoiceLocator": locator,
                    "Operator": "Selected",
                    "QuestionIDFromLocator": question_id,
                    "LeftOperand": locator,
                    "Type": "Expression",
                    "Description": description,
                },
                "Type": "If",
            },
            "Type": "BooleanExpression",
        },
        "Flow": [{"Type": "EndSurvey", "FlowID": end_flow_id}],
    }


def build_flow(filename: str, blocks: list[dict], tag_to_qid: dict[str, str]) -> list[dict]:
    flow: list[dict] = [{
        "Type": "EmbeddedData",
        "FlowID": "FL_2",
        "EmbeddedData": [
            {
                "Description": field,
                "Type": "Recipient",
                "Field": field,
                "VariableType": "String",
                "Value": "",
                "AnalyzeText": False,
            }
            for field in EMBEDDED_LINKAGE_FIELDS
        ],
    }]
    next_flow_number = 3

    def append_end(question_tag: str, choice_id: int, description: str) -> None:
        nonlocal next_flow_number
        flow.append(
            end_branch(
                tag_to_qid[question_tag],
                choice_id,
                description,
                f"FL_{next_flow_number}",
                f"FL_{next_flow_number + 1}",
            )
        )
        next_flow_number += 2

    for index, block in enumerate(blocks, start=1):
        flow.append({"ID": block["new_id"], "Type": "Standard", "FlowID": f"FL_{next_flow_number}"})
        next_flow_number += 1

        if filename.startswith("01_") and index == 1:
            append_end("CONSENT", 2, "End: participant did not consent")
        elif filename.startswith("01_") and index == 2:
            append_end("AGE18", 2, "End: participant is under 18")
            append_end("AGE18", 3, "End: age eligibility not confirmed")
            append_end("ENROLLED", 2, "End: enrollment eligibility not met")
        elif filename.startswith("01_") and index == 3 and "PII_ACK" in tag_to_qid:
            append_end("PII_ACK", 2, "End before restricted contact fields")
        elif filename.startswith("02_") and index == 1 and "PII_ACK" in tag_to_qid:
            append_end("PII_ACK", 2, "End before restricted contact fields")
        elif filename.startswith("03_") and index == 1:
            append_end("TEST_INTEGRITY", 2, "End: assessment integrity not agreed")
        elif filename.startswith("04_") and index == 1:
            append_end("CONTACT_CONFIRM", 2, "End: contact storage not authorized")
        elif filename.startswith("05_") and index == 1:
            append_end("RET_INTEGRITY", 2, "End: retention integrity not agreed")
    return flow


def prepare_question(payload: dict) -> dict:
    question = copy.deepcopy(payload)
    question.pop("QuestionID", None)
    # This brand permits question creation but rejects DataVisibility.Private
    # with QMST_2.1. Keep the field private in the QSF instrument-of-record and
    # require the restricted-field setting to be applied/verified in the UI.
    visibility = question.get("DataVisibility")
    if isinstance(visibility, dict) and visibility.get("Private") is True:
        question.pop("DataVisibility", None)
    return question


def finalize_existing_survey(api: QualtricsApi, qsf_path: Path, survey_id: str, live_name: str) -> dict:
    """Apply flow/options to a fully populated inactive survey and verify it."""
    qsf = json.loads(qsf_path.read_text(encoding="utf-8"))
    source_questions = {
        element["Payload"]["QuestionID"]: element["Payload"] for element in qsf_elements(qsf, "SQ")
    }
    source_blocks = qsf_elements(qsf, "BL")[0]["Payload"]
    definition = api.call("GET", f"/survey-definitions/{survey_id}")["result"]
    actual_questions = definition.get("Questions", {})
    if len(actual_questions) != len(source_questions):
        raise RuntimeError(
            f"{survey_id}: incomplete existing survey has {len(actual_questions)} of {len(source_questions)} questions"
        )

    tag_to_qid = {
        question["DataExportTag"]: question_id for question_id, question in actual_questions.items()
    }
    first_tag_to_block: dict[str, str] = {}
    for block_id, block in definition.get("Blocks", {}).items():
        for element in block.get("BlockElements", []):
            question_id = element.get("QuestionID")
            if question_id in actual_questions:
                first_tag_to_block[actual_questions[question_id]["DataExportTag"]] = block_id
                break

    blocks: list[dict] = []
    for source_block in source_blocks:
        first_source_qid = source_block["BlockElements"][0]["QuestionID"]
        first_tag = source_questions[first_source_qid]["DataExportTag"]
        block_id = first_tag_to_block.get(first_tag)
        if not block_id:
            raise RuntimeError(f"{survey_id}: cannot map block beginning with {first_tag}")
        blocks.append({"new_id": block_id, "description": source_block["Description"]})

    current_flow = api.call("GET", f"/survey-definitions/{survey_id}/flow")["result"]
    current_flow["Flow"] = build_flow(qsf_path.name, blocks, tag_to_qid)
    current_flow["Properties"] = {"Count": len(current_flow["Flow"])}
    api.call("PUT", f"/survey-definitions/{survey_id}/flow", current_flow)

    options_elements = qsf_elements(qsf, "SO")
    if options_elements:
        options = api.call("GET", f"/survey-definitions/{survey_id}/options")["result"]
        options.update(options_elements[0]["Payload"])
        options["SurveyName"] = live_name
        options["SurveyTitle"] = live_name
        api.call("PUT", f"/survey-definitions/{survey_id}/options", options)
    api.call("PUT", f"/surveys/{survey_id}", {"isActive": False})

    survey_record = next(item for item in api.list_surveys() if item["id"] == survey_id)
    if survey_record.get("isActive"):
        raise RuntimeError(f"{survey_id}: survey unexpectedly active")
    return {
        "file": qsf_path.name,
        "survey_id": survey_id,
        "name": live_name,
        "active": False,
        "question_count": len(actual_questions),
        "block_count": len(blocks),
        "flow_element_count": len(current_flow["Flow"]),
        "status": "existing_finalized",
        "manual_qa_required": [
            "replace IRB hold/consent wording after approval",
            "verify study_id, wave, and cohort embedded data round-trip from ALGET links",
            "configure and independently verify selected-response scoring",
            "verify outcome forms contain Study ID only; restrict gift-project PII and audit collaborator/export permissions",
            "flag every early EndSurvey as Screened-Out and expose Q_TerminateFlag in exports",
            "synthetic-path test every branch and retain inactive export/hash/screenshots",
        ],
    }


def provision_survey(api: QualtricsApi, qsf_path: Path, live_name: str) -> dict:
    qsf = json.loads(qsf_path.read_text(encoding="utf-8"))
    questions = {element["Payload"]["QuestionID"]: element["Payload"] for element in qsf_elements(qsf, "SQ")}
    block_elements = qsf_elements(qsf, "BL")
    if len(block_elements) != 1:
        raise RuntimeError(f"{qsf_path.name}: expected one BL element")
    source_blocks = block_elements[0]["Payload"]

    created = api.call(
        "POST",
        "/survey-definitions",
        {"SurveyName": live_name, "Language": "EN", "ProjectCategory": "CORE"},
    )["result"]
    survey_id = created["SurveyID"]
    default_block_id = created.get("DefaultBlockID")

    blocks: list[dict] = []
    old_to_new_qid: dict[str, str] = {}
    tag_to_qid: dict[str, str] = {}

    for block_index, source_block in enumerate(source_blocks):
        description = source_block["Description"]
        if block_index == 0 and default_block_id:
            block_id = default_block_id
            try:
                api.call(
                    "PUT",
                    f"/survey-definitions/{survey_id}/blocks/{block_id}",
                    {"Type": "Standard", "Description": description},
                )
            except RuntimeError:
                # The block is still valid if this brand does not permit renaming it.
                pass
        else:
            block_id = api.call(
                "POST",
                f"/survey-definitions/{survey_id}/blocks",
                {"Type": "Standard", "Description": description},
            )["result"]["BlockID"]

        blocks.append({"new_id": block_id, "description": description})
        for block_question in source_block["BlockElements"]:
            old_qid = block_question["QuestionID"]
            payload = prepare_question(questions[old_qid])
            result = api.call(
                "POST",
                f"/survey-definitions/{survey_id}/questions?blockId={block_id}",
                payload,
            )["result"]
            new_qid = result["QuestionID"]
            old_to_new_qid[old_qid] = new_qid
            tag_to_qid[payload["DataExportTag"]] = new_qid

    current_flow = api.call("GET", f"/survey-definitions/{survey_id}/flow")["result"]
    current_flow["Flow"] = build_flow(qsf_path.name, blocks, tag_to_qid)
    current_flow["Properties"] = {"Count": len(current_flow["Flow"])}
    api.call("PUT", f"/survey-definitions/{survey_id}/flow", current_flow)

    options_elements = qsf_elements(qsf, "SO")
    if options_elements:
        options = api.call("GET", f"/survey-definitions/{survey_id}/options")["result"]
        options.update(options_elements[0]["Payload"])
        options["SurveyName"] = live_name
        options["SurveyTitle"] = live_name
        api.call("PUT", f"/survey-definitions/{survey_id}/options", options)

    api.call("PUT", f"/surveys/{survey_id}", {"isActive": False})
    definition = api.call("GET", f"/survey-definitions/{survey_id}")["result"]
    survey_record = next(item for item in api.list_surveys() if item["id"] == survey_id)
    actual_questions = len(definition.get("Questions", {}))
    expected_questions = len(questions)
    if actual_questions != expected_questions:
        raise RuntimeError(f"{survey_id}: expected {expected_questions} questions, found {actual_questions}")
    if survey_record.get("isActive"):
        raise RuntimeError(f"{survey_id}: survey unexpectedly active")

    return {
        "file": qsf_path.name,
        "survey_id": survey_id,
        "name": live_name,
        "active": False,
        "question_count": actual_questions,
        "block_count": len(blocks),
        "flow_element_count": len(current_flow["Flow"]),
        "status": "created",
        "manual_qa_required": [
            "replace IRB hold/consent wording after approval",
            "verify study_id, wave, and cohort embedded data round-trip from ALGET links",
            "configure and independently verify selected-response scoring",
            "mark PII fields sensitive/restricted and audit collaborator/export permissions",
            "synthetic-path test every branch and retain inactive export/hash/screenshots",
        ],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("qsf_dir", type=Path)
    parser.add_argument("--datacenter", default=os.environ.get("QUALTRICS_DATACENTER", "az1"))
    parser.add_argument(
        "--token-file",
        type=Path,
        help="Path to a text file containing only the Qualtrics API token.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    token = ""
    if args.token_file:
        if not args.token_file.is_file():
            print(f"Token file not found: {args.token_file}", file=sys.stderr)
            return 2
        token = args.token_file.read_text(encoding="utf-8-sig").strip()
    if not token:
        token = os.environ.get("QUALTRICS_API_TOKEN") or os.environ.get("QUALTRICS_TOKEN") or ""
    if not token:
        print("--token-file, QUALTRICS_API_TOKEN, or QUALTRICS_TOKEN is required", file=sys.stderr)
        return 2

    missing = [name for name in LIVE_NAMES if not (args.qsf_dir / name).is_file()]
    if missing:
        print(f"Missing QSF files: {', '.join(missing)}", file=sys.stderr)
        return 2

    api = QualtricsApi(token, args.datacenter)
    existing = {item["name"]: item for item in api.list_surveys()}
    results: list[dict] = []
    for filename, live_name in LIVE_NAMES.items():
        if live_name in existing:
            record = existing[live_name]
            results.append(finalize_existing_survey(api, args.qsf_dir / filename, record["id"], live_name))
            continue
        result = provision_survey(api, args.qsf_dir / filename, live_name)
        results.append(result)
        existing[live_name] = {"id": result["survey_id"], "name": live_name, "isActive": False}

    print(json.dumps({"datacenter": args.datacenter, "surveys": results}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
