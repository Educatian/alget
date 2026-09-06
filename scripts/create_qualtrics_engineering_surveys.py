"""Generate import-ready Qualtrics QSF files for the ALGET engineering study.

The files are inactive by design. Review consent, compensation, and PII language
against the approved IRB before activation.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

OUTPUT = Path(r"C:\Users\jewoo\Desktop\_System\Work\25_Service\IRB\AlGET\2026_revision\Qualtrics")
LIKERT5 = ["Strongly disagree", "Disagree", "Neither agree nor disagree", "Agree", "Strongly agree"]
FREQ5 = ["Never", "Once or twice", "Monthly", "Weekly", "Daily or almost daily"]
GESE_ITEMS = [
    "I can master the content in the engineering-related courses I am taking this semester.",
    "I can master the content in even the most challenging engineering course if I try.",
    "I can do a good job on almost all my engineering coursework if I do not give up.",
    "I can learn the content taught in my engineering-related courses.",
    "I can earn a good grade in my engineering-related courses.",
]
GESE_SCALE = [
    "1 - Completely uncertain", "2", "3", "4", "5", "6 - Completely certain",
]


def qid(index):
    return f"QID{index}"


def base_payload(text, question_type, selector, export_tag, private=False, required=False):
    payload = {
        "QuestionText": text,
        "QuestionDescription": text.replace("<br>", " ")[:250],
        "DefaultChoices": False,
        "DataExportTag": export_tag,
        "QuestionType": question_type,
        "Selector": selector,
        "DataVisibility": {"Private": private, "Hidden": False},
        "Configuration": {"QuestionDescriptionOption": "UseText"},
        "Validation": {"Settings": {"ForceResponse": "ON" if required else "OFF", "Type": "None"}},
        "GradingData": [],
        "Language": [],
        "NextChoiceId": 1,
        "NextAnswerId": 1,
    }
    return payload


def descriptive(text, tag):
    return {"kind": "question", "type": "DB", "selector": "TB", "text": text, "tag": tag, "required": False}


def text_entry(text, tag, required=False, private=False, content_type=None):
    return {
        "kind": "question",
        "type": "TE",
        "selector": "SL",
        "text": text,
        "tag": tag,
        "required": required,
        "private": private,
        "content_type": content_type,
    }


def mc(text, tag, choices, required=False, private=False, correct=None):
    return {"kind": "question", "type": "MC", "selector": "SAVR", "text": text, "tag": tag, "choices": choices, "required": required, "private": private, "correct": correct}


def matrix(text, tag, statements, answers=LIKERT5, required=False):
    return {"kind": "question", "type": "Matrix", "selector": "Likert", "subselector": "SingleAnswer", "text": text, "tag": tag, "statements": statements, "answers": answers, "required": required}


def page_break():
    return {"kind": "page_break"}


def question_payload(spec, question_id):
    payload = base_payload(spec["text"], spec["type"], spec["selector"], spec["tag"], spec.get("private", False), spec.get("required", False))
    payload["QuestionID"] = question_id
    if spec["type"] == "TE":
        payload["SearchSource"] = {"AllowFreeResponse": "false"}
        if spec.get("content_type"):
            payload["Validation"]["Settings"].update(
                {
                    "ForceResponseType": "ON",
                    "Type": "ContentType",
                    "MinChars": "1",
                    "ContentType": (
                        "ValidEmail" if spec["content_type"] == "Email" else spec["content_type"]
                    ),
                    "ValidDateType": "DateWithFormat",
                    "ValidPhoneType": "ValidUSPhone",
                    "ValidZipType": "ValidUSZip",
                    "ValidNumber": {"Min": "", "Max": "", "NumDecimals": ""},
                }
            )
    if spec["type"] == "MC":
        payload["SubSelector"] = "TX"
        exclusive_choices = set(spec.get("exclusive_choices", []))
        payload["Choices"] = {
            str(i): {
                "Display": choice,
                **({"ExclusiveAnswer": True} if i in exclusive_choices else {}),
            }
            for i, choice in enumerate(spec["choices"], 1)
        }
        payload["ChoiceOrder"] = [str(i) for i in range(1, len(spec["choices"]) + 1)]
        payload["NextChoiceId"] = len(spec["choices"]) + 1
    if spec["type"] == "Matrix":
        payload["SubSelector"] = spec["subselector"]
        payload["Choices"] = {str(i): {"Display": item} for i, item in enumerate(spec["statements"], 1)}
        payload["ChoiceOrder"] = [str(i) for i in range(1, len(spec["statements"]) + 1)]
        payload["Answers"] = {str(i): {"Display": item} for i, item in enumerate(spec["answers"], 1)}
        payload["AnswerOrder"] = [str(i) for i in range(1, len(spec["answers"]) + 1)]
        payload["ChoiceDataExportTags"] = False
        payload["Configuration"].update({"MobileFirst": True, "RepeatHeaders": "none", "WhiteSpace": "OFF"})
        payload["NextChoiceId"] = len(spec["statements"]) + 1
        payload["NextAnswerId"] = len(spec["answers"]) + 1
    return payload


def build_qsf(name, slug, blocks):
    survey_id = f"SV_ALGET{slug.upper()}2026"
    all_specs = []
    block_payloads = []
    q_counter = 0
    for b_index, block in enumerate(blocks, 1):
        elements = []
        for spec in block["items"]:
            if spec["kind"] == "page_break":
                elements.append({"Type": "Page Break"})
                continue
            q_counter += 1
            spec = dict(spec)
            spec["question_id"] = qid(q_counter)
            all_specs.append(spec)
            elements.append({"Type": "Question", "QuestionID": spec["question_id"]})
        block_payloads.append({
            "Type": "Default",
            "Description": block["name"],
            "ID": f"BL_ALGET{slug.upper()}{b_index}",
            "BlockElements": elements,
            "Options": {"BlockLocking": "false", "RandomizeQuestions": "false", "BlockVisibility": "Expanded"},
        })

    flow = [{"ID": block["ID"], "Type": "Block", "FlowID": f"FL_{index + 2}"} for index, block in enumerate(block_payloads)]
    elements = [
        {"SurveyID": survey_id, "Element": "BL", "PrimaryAttribute": "Survey Blocks", "SecondaryAttribute": None, "TertiaryAttribute": None, "Payload": block_payloads},
        {"SurveyID": survey_id, "Element": "FL", "PrimaryAttribute": "Survey Flow", "SecondaryAttribute": None, "TertiaryAttribute": None, "Payload": {"Flow": flow, "Properties": {"Count": len(flow)}, "FlowID": "FL_1", "Type": "Root"}},
        {"SurveyID": survey_id, "Element": "SO", "PrimaryAttribute": "Survey Options", "SecondaryAttribute": None, "TertiaryAttribute": None, "Payload": {
            "BackButton": "true", "SaveAndContinue": "true", "SurveyProtection": "PublicSurvey", "BallotBoxStuffingPrevention": "true", "NoIndex": "Yes", "SecureResponseFiles": "true", "SurveyExpiration": "None", "SurveyTermination": "DefaultMessage", "Header": "", "Footer": "", "ProgressBarDisplay": "Text", "PartialData": "+1 week", "ValidationMessage": "", "PreviousButton": "Back", "NextButton": "Next", "SurveyTitle": name, "SurveyName": name, "ProtectSelectionIds": True}},
        {"SurveyID": survey_id, "Element": "SCO", "PrimaryAttribute": "Scoring", "SecondaryAttribute": None, "TertiaryAttribute": None, "Payload": {"ScoringCategories": [], "ScoringCategoryGroups": [], "ScoringSummaryCategory": None, "ScoringSummaryAfterQuestions": 0, "ScoringSummaryAfterSurvey": 0, "DefaultScoringCategory": None, "AutoScoringCategory": None}},
        {"SurveyID": survey_id, "Element": "PROJ", "PrimaryAttribute": "CORE", "SecondaryAttribute": None, "TertiaryAttribute": "1.1.0", "Payload": {"ProjectCategory": "CORE", "SchemaVersion": "1.1.0"}},
        {"SurveyID": survey_id, "Element": "STAT", "PrimaryAttribute": "Survey Statistics", "SecondaryAttribute": None, "TertiaryAttribute": None, "Payload": {"MobileCompatible": True, "ID": "Survey Statistics"}},
    ]
    for spec in all_specs:
        payload = question_payload(spec, spec["question_id"])
        elements.append({"SurveyID": survey_id, "Element": "SQ", "PrimaryAttribute": spec["question_id"], "SecondaryAttribute": spec["text"][:250], "TertiaryAttribute": None, "Payload": payload})
    elements.append({"SurveyID": survey_id, "Element": "QC", "PrimaryAttribute": "Survey Question Count", "SecondaryAttribute": str(q_counter), "TertiaryAttribute": None, "Payload": None})
    qsf = {
        "SurveyEntry": {"SurveyID": survey_id, "SurveyName": name, "SurveyDescription": "ALGET engineering intervention study. Inactive IRB revision draft.", "SurveyOwnerID": "UR_IMPORT", "SurveyBrandID": "qualtrics", "DivisionID": None, "SurveyLanguage": "EN", "SurveyActiveResponseSet": None, "SurveyStatus": "Inactive", "SurveyStartDate": "0000-00-00 00:00:00", "SurveyExpirationDate": "0000-00-00 00:00:00", "SurveyCreationDate": "2026-08-15 00:00:00", "CreatorID": "UR_IMPORT", "LastModified": "2026-08-15 00:00:00", "LastAccessed": "0000-00-00 00:00:00", "LastActivated": None, "Deleted": None},
        "SurveyElements": elements,
    }
    return qsf, all_specs


def identity_blocks(stage):
    email_purpose = (
        "Email address for the IRB-approved research-account invitation, study follow-up, and gift-card delivery"
        if stage == "Pre-survey"
        else "Email address for study follow-up and gift-card delivery"
    )
    return [
        {
            "name": f"{stage} contact-information acknowledgement",
            "items": [
                descriptive("<b>IRB HOLD:</b> Do not activate until the revised protocol, consent, compensation amount, and identifiable-data plan are approved. Contact information is used only for approved study administration and gift-card delivery and must be removed from analysis exports.", "IRB_HOLD"),
                text_entry("Study ID assigned by the research team", "STUDY_ID", required=True),
                mc("I understand that contact information is stored separately from the analysis file and is not used to determine grades.", "PII_ACK", ["Yes", "No"], required=True),
            ],
        },
        {
            "name": f"{stage} restricted contact details",
            "items": [
                text_entry("Full name for gift-card delivery records", "PII_FULL_NAME", required=True, private=True),
                text_entry(email_purpose, "PII_EMAIL", required=True, private=True),
                mc("Preferred gift-card contact method", "PII_CONTACT_PREF", ["Email", "Text message", "No preference"], required=True, private=True),
                text_entry("Mobile phone number for gift-card delivery, if text delivery is selected (optional)", "PII_PHONE", private=True),
            ],
        },
    ]


pre_blocks = [
    {"name": "Consent", "items": [
        descriptive("Replace this notice with the current IRB-approved consent language before activation. Participation is voluntary and does not affect course standing or grades.", "CONSENT_NOTICE"),
        mc("Do you consent to participate in the ALGET research study described in the approved consent form?", "CONSENT", ["I consent", "I do not consent"], required=True),
    ]},
    {"name": "Eligibility", "items": [
        mc("Are you at least 18 years old?", "AGE18", ["Yes", "No", "Prefer not to answer"], required=True),
        mc("Are you currently enrolled in the participating course or approved study section?", "ENROLLED", ["Yes", "No"], required=True),
    ]},
    *identity_blocks("Pre-survey"),
    {"name": "Background", "items": [
        mc("Current year in college", "YEAR", ["First year", "Second year", "Third year", "Fourth year", "Fifth year or later", "Graduate student", "Other", "Prefer not to answer"]),
        text_entry("Engineering or related major/program", "MAJOR"),
        matrix("Prior coursework completed or currently taking", "COURSEWORK", ["Statics", "Dynamics", "Mechanics/materials", "Biology", "Engineering design"], ["Not taken", "Currently taking", "Completed"], required=True),
        mc("How often have you used generative AI for coursework in the past six months?", "GENAI_FREQ", FREQ5, required=True),
        mc("How often have you used an interactive 3D or Unity-based learning simulation?", "SIM3D_FREQ", FREQ5, required=True),
        mc("Which device will you primarily use for ALGET?", "DEVICE", ["Windows laptop/desktop", "Mac laptop/desktop", "Chromebook", "Tablet", "Phone", "Other"], required=True),
        mc("Do you need an accessibility accommodation for the textbook or simulations?", "ACCESS_NEED", ["No", "Yes", "Prefer to discuss privately"], required=True),
    ]},
    {"name": "General Engineering Self-Efficacy", "items": [
        matrix("How certain are you that you can do each of the following?", "GESE_PRE", GESE_ITEMS, GESE_SCALE, required=True),
        descriptive("The five-item General Engineering Self-Efficacy scale follows Mamaril et al. (2016), DOI 10.1002/jee.20121. Preserve all five items and the 1-to-6 response scale; confirm reproduction permission before activation.", "GESE_NOTE"),
    ]},
    {"name": "Baseline concept diagnostic", "items": [
        mc("Which biological structure is an open-cell porous solid that achieves structural efficiency by distributing loads through a cellular network?", "PRE_CELLULAR", ["Shark dermal skin", "Turtle shell", "Cancellous bone", "Gecko spatulae"], required=True, correct=3),
        mc("Why can a stiff-platelet/soft-matrix architecture such as nacre resist fracture better than one brittle uniform phase?", "PRE_NACRE", ["Interfaces deflect cracks and dissipate energy", "The soft phase eliminates all stress", "The mineral becomes flexible", "The structure has no defects"], required=True, correct=1),
        mc("Gecko-inspired dry adhesion primarily depends on which mechanism?", "PRE_GECKO", ["Liquid mucus", "Microscopic suction", "Contact splitting and van der Waals interactions", "Electromagnetic charging"], required=True, correct=3),
        mc("Properly scaled shark-skin riblets can reduce drag mainly by doing what?", "PRE_RIBLET", ["Creating a frictionless oil layer", "Organizing near-wall vortices and limiting cross-flow", "Preventing water contact", "Making all flow laminar"], required=True, correct=2),
        mc("Trailing-edge serrations reduce aeroacoustic noise mainly by changing what?", "PRE_SERRATION", ["Turbulent structures and pressure fluctuations near the edge", "Motor vibration", "Sound absorption inside the wing", "Bird speed only"], required=True, correct=1),
        mc("Morpho-like structural color is produced mainly by what?", "PRE_COLOR", ["Wavelength-scale geometry and interference", "Blue pigment", "Bioluminescence", "Sky reflection"], required=True, correct=1),
        mc("A termite-inspired passive ventilation system works only when designers account for what?", "PRE_THERMAL", ["Outer appearance alone", "Coupled airflow, thermal mass, openings, and climate", "Mechanical fans only", "A universal mound shape"], required=True, correct=2),
        mc("Microcapsule self-healing materials have which important limitation?", "PRE_HEALING", ["They make the material unbreakable", "Healing capacity and eligible damage modes are finite", "They eliminate inspection", "They add no cost or mass"], required=True, correct=2),
        mc("In swarm intelligence, stigmergy is what form of coordination?", "PRE_SWARM", ["Central commands", "Direct private messages", "Indirect coordination through environmental traces", "Random movement without rules"], required=True, correct=3),
        mc("Which action best represents a function-first biomimetic search?", "PRE_FUNCTION_FIRST", ["Choose a visually interesting organism first", "Copy a natural shape without testing", "Select the most complex biological example", "Define the required function and constraints before searching biological strategies"], required=True, correct=4),
        mc("Which evidence provides the strongest basis for transferring a biological analogy into engineering?", "PRE_ANALOGY", ["The design looks like the organism", "The organism is widely known", "The biological example has many parts", "The same causal mechanism operates under the relevant constraints"], required=True, correct=4),
        mc("An AI recommendation conflicts with a controlled simulation result. What should the learner do?", "PRE_AI_RELIANCE", ["Accept the recommendation because it was generated by AI", "Ignore every future recommendation", "Repeat the prompt until the desired answer appears", "Compare the cited evidence and trace, then revise or reject the recommendation"], required=True, correct=4),
    ]},
    {"name": "Baseline constructed transfer", "items": [
        text_entry("BASELINE TRANSFER 1. A bicycle component must be lightweight but carry a known dominant load and occasional impact. Propose a bio-inspired structural principle and explain the mechanism and two trade-offs.", "PRE_TRANSFER_STRUCTURE", required=True),
        text_entry("BASELINE TRANSFER 2. A robot must grip a fragile glass vial and release it without residue. Propose a bio-inspired attachment strategy, one test, and one likely failure mode.", "PRE_TRANSFER_ADHESION", required=True),
        text_entry("BASELINE TRANSFER 3. A fleet of delivery robots must reassign tasks when communication is intermittent. Propose a biologically inspired local rule and identify one scaling risk.", "PRE_TRANSFER_SWARM", required=True),
    ]},
]


post_blocks = [
    *identity_blocks("Post-survey"),
    {"name": "General Engineering Self-Efficacy", "items": [
        matrix("How certain are you that you can do each of the following now?", "GESE_POST", GESE_ITEMS, GESE_SCALE, required=True),
        descriptive("Use the same five-item General Engineering Self-Efficacy wording and 1-to-6 response scale as the pre-survey. Score only when all permission and measurement gates are satisfied.", "GESE_POST_NOTE"),
    ]},
    {"name": "Completion and fidelity", "items": [
        mc("Which ALGET study condition did the system appear to provide?", "PERCEIVED_ARM", ["Support changed based on my work", "Support followed a mostly fixed sequence", "I could not tell"], required=True),
        matrix("Please rate the following statements about the support you received.", "MANIP_CHECK", [
            "The support changed in response to my earlier work.",
            "The system explained why a support action was shown.",
            "I could choose whether to use or reject a recommendation.",
            "The support followed the same sequence regardless of my work.",
        ], required=True),
        mc("Did a technical problem prevent completion of any assigned activity?", "TECH_INTERRUPT", ["No", "Yes, partly", "Yes, completely"], required=True),
        text_entry("If you experienced a technical problem, briefly describe the affected activity. Do not include sensitive personal information.", "TECH_COMMENT"),
    ]},
    {"name": "User Engagement Scale Short Form", "items": [
        matrix("Thinking about your full ALGET experience, indicate your agreement.", "UES_SF", [
            "I lost myself in this experience.",
            "The time I spent using ALGET just slipped away.",
            "I was absorbed in this experience.",
            "I felt frustrated while using ALGET.",
            "I found ALGET confusing to use.",
            "Using ALGET was taxing.",
            "ALGET was attractive.",
            "ALGET was aesthetically appealing.",
            "ALGET appealed to my visual senses.",
            "Using ALGET was worthwhile.",
            "My experience was rewarding.",
            "I felt interested in this experience.",
        ], required=True),
    ]},
    {"name": "System Usability Scale", "items": [
        matrix("For each statement, indicate your agreement.", "SUS", [
            "I think that I would like to use ALGET frequently.",
            "I found ALGET unnecessarily complex.",
            "I thought ALGET was easy to use.",
            "I think that I would need the support of a technical person to be able to use ALGET.",
            "I found the various functions in ALGET were well integrated.",
            "I thought there was too much inconsistency in ALGET.",
            "I would imagine that most people would learn to use ALGET very quickly.",
            "I found ALGET very cumbersome to use.",
            "I felt very confident using ALGET.",
            "I needed to learn a lot of things before I could get going with ALGET.",
        ], required=True),
    ]},
    {"name": "AI transparency and reliance", "items": [
        matrix("Thinking specifically about ALGET's AI-supported recommendations, indicate your agreement.", "AI_RELIANCE_DEV", [
            "I could tell what evidence a recommendation was based on.",
            "I verified important recommendations before relying on them.",
            "I rejected recommendations that did not fit the engineering evidence.",
            "The AI sometimes appeared more certain than the available evidence justified.",
            "I understood that the AI could be wrong.",
            "I remained responsible for the final engineering decision.",
            "I could distinguish AI guidance from instructor-approved course content.",
            "I knew how to report an unhelpful or unsafe recommendation.",
        ], required=True),
        descriptive("These are study-authored process items, not a validated trust scale. Replace or supplement them with a permission-cleared validated trust/distrust instrument before confirmatory use.", "TRUST_NOTE"),
    ]},
    {"name": "Overall learning experience", "items": [
        mc("Overall, how much mental effort did you invest in the ALGET modules?", "PAAS_EFFORT", ["1 - Very, very low", "2", "3", "4", "5", "6", "7", "8", "9 - Very, very high"], required=True),
        text_entry("Describe one point when evidence from ALGET changed an engineering decision you made.", "DECISION_CHANGE"),
        text_entry("What should be changed before ALGET is used with another engineering class?", "IMPROVEMENT"),
        mc("May the research team contact you about an optional follow-up interview?", "INTERVIEW_OK", ["Yes", "No"], required=True),
        mc("Gift-card eligibility check: I completed the assigned pre-survey, learning activities, and post-study measures to the best of my ability.", "INCENTIVE_ELIGIBILITY_SELF", ["Yes", "No", "Not sure"], required=True),
    ]},
]


posttest_items = [
    mc("A lightweight bracket has the same mass in two designs. Design X spreads material along principal load paths; Design Y distributes it uniformly. Under one dominant load direction, which prediction is most defensible?", "POST_LOAD_PATH", ["Design Y must be stiffer because it is uniform", "Both must behave identically because mass is equal", "Design X cannot carry compression because it is porous", "Design X may achieve better stiffness-to-mass if local buckling is controlled"], required=True, correct=4),
    mc("A laminated composite stops a crack by repeated deflection and interface sliding. Which change would most directly threaten that toughening mechanism?", "POST_HIERARCHY", ["Eliminating weak interfaces so the laminate behaves as one brittle phase", "Adding a second observation scale", "Reducing surface pigment", "Measuring crack length more often"], required=True, correct=1),
    mc("A reusable wall-climbing pad holds strongly in shear but releases when peeled. What feature best explains both behaviors?", "POST_DIRECTIONAL", ["A permanently tacky liquid", "Directional fibril geometry and load-dependent contact area", "A vacuum pump", "A surface that is equally sticky in every direction"], required=True, correct=2),
    mc("Riblets that reduce drag at one flow speed increase drag after being enlarged tenfold for a different vehicle. What is the best explanation?", "POST_SCALE_FLOW", ["Biological designs work only in water", "Any roughness always increases drag", "The material color changed", "The feature scale no longer matches the near-wall flow structure"], required=True, correct=4),
    mc("A turbine blade with extremely dense serrations becomes quieter at one condition but loses efficiency. Which design conclusion is strongest?", "POST_SERRATION_TRADEOFF", ["Maximize serration density in every case", "Remove all serrations", "Optimize spacing and scale jointly for acoustic and aerodynamic objectives", "Noise and efficiency cannot be evaluated together"], required=True, correct=3),
    mc("An optical film shifts reflected color when its periodic spacing increases. Which relation is most relevant?", "POST_OPTICAL_SCALE", ["Reflected wavelength is coupled to feature spacing and refractive index", "Color depends only on chemical dye concentration", "Smaller features always reflect redder light", "Viewing geometry cannot matter"], required=True, correct=1),
    mc("A termite-inspired building works in a dry climate but overheats in a humid climate with different day-night cycling. What should the designer do first?", "POST_CLIMATE_TRANSFER", ["Copy the same vent dimensions", "Re-match airflow, thermal mass, heat loads, and climate boundary conditions", "Increase wall thickness without analysis", "Add decorative mound shapes"], required=True, correct=2),
    mc("A microcapsule healing system repairs the first small crack but not a second crack at the same location. Which limitation is most likely?", "POST_HEALING_LIMIT", ["The first rupture depleted the local healing agent", "Self-healing materials never work", "The crack became invisible", "Inspection caused the failure"], required=True, correct=1),
    mc("A robot swarm uses virtual markers left on a shared map to attract agents to unfinished tasks. This is best classified as what?", "POST_STIGMERGY", ["Centralized control", "Stigmergic coordination", "Random walk", "Direct pairwise negotiation only"], required=True, correct=2),
    mc("Which proposal demonstrates function-first biomimetic search?", "POST_FUNCTION_FIRST", ["Choose a favorite animal and copy its shape", "Browse attractive nature photographs", "Define required heat rejection and constraints, then search biological thermoregulation strategies", "Select the strongest biological material without a use case"], required=True, correct=3),
    mc("Two bio-inspired concepts look similar to organisms, but only one preserves the same causal mechanism under the engineering constraints. Which should be preferred?", "POST_ANALOGY", ["The more visually realistic concept", "The concept with more biological labels", "Either, because appearance proves transfer", "The mechanism-preserving concept"], required=True, correct=4),
    mc("A learner accepts a confident AI recommendation that conflicts with simulation evidence. Which action best demonstrates appropriate reliance?", "POST_AI_RELIANCE", ["Keep the recommendation because confidence implies correctness", "Ignore all AI support", "Inspect the cited evidence, compare the trace, and revise or reject the recommendation", "Repeat the same prompt until the recommendation agrees"], required=True, correct=3),
    text_entry("TRANSFER TASK 1. A drone frame must be light, resist a known dominant load path, and survive occasional off-axis impacts. Propose a bio-inspired structural strategy. Explain the biological mechanism, map it to the frame, and discuss at least two constraints or trade-offs.", "POST_TRANSFER_STRUCTURE", required=True),
    text_entry("TRANSFER TASK 2. Design a reversible attachment for a maintenance robot that must grip a smooth panel under shear and release without residue. Explain the mechanism, the loading direction, one test, and one likely failure mode.", "POST_TRANSFER_ADHESION", required=True),
    text_entry("TRANSFER TASK 3. A warehouse robot team must allocate tasks after communication outages. Propose a biologically inspired coordination rule, explain how local information creates system behavior, and identify a scaling risk.", "POST_TRANSFER_SWARM", required=True),
]


posttest_blocks = [
    {"name": "Study linkage", "items": [
        descriptive("This assessment is a development form. Do not use as the confirmatory primary outcome until expert review, cognitive interviews, and pilot item analysis are complete.", "TEST_HOLD"),
        text_entry("Study ID assigned by the research team", "STUDY_ID", required=True),
        mc("I will complete this assessment without external AI assistance unless the approved protocol explicitly allows it.", "TEST_INTEGRITY", ["I agree", "I do not agree"], required=True),
    ]},
    {"name": "Selected-response concept and transfer", "items": posttest_items[:12]},
    {"name": "Constructed transfer", "items": posttest_items[12:]},
]


incentive_blocks = [
    {"name": "Gift-card contact authorization", "items": [
        descriptive("This separate survey stores identifiable gift-card delivery information for manual fulfillment by email. Designated compensation staff will compare the Study ID with approved completion records, then email the gift card to the address provided. Submitting this form does not by itself establish eligibility. Do not merge names or email addresses into the analysis dataset; join only a payment-status flag by Study ID.", "INCENTIVE_NOTICE"),
        text_entry("Study ID assigned by the research team", "STUDY_ID", required=True),
        mc("I agree to provide my name and email address for manual eligibility verification, gift-card delivery, and payment records.", "CONTACT_CONFIRM", ["Yes", "No"], required=True),
    ]},
    {"name": "Restricted gift-card contact details", "items": [
        text_entry("Full name for gift-card delivery records", "PII_FULL_NAME", required=True, private=True),
        text_entry("Email address where the gift card should be sent after manual verification", "PII_EMAIL", required=True, private=True, content_type="Email"),
        descriptive("Delivery method: email only. The research team will manually verify the selected milestone against completion records before sending a gift card. No gift card is sent automatically from Qualtrics.", "DELIVERY_METHOD_NOTICE"),
        mc("I understand that the research team will manually verify completion before emailing any approved gift card.", "MANUAL_EMAIL_REVIEW_ACK", ["Yes", "No"], required=True),
        mc("Which approved milestone should the research team verify?", "MILESTONE", ["Pre-study measures", "Post-study measures", "Retention measures", "Follow-up interview", "Other approved milestone"], required=True),
    ]},
]


retention_items = [
    mc("A prosthetic lattice preserves mass but rotates its struts away from the dominant load direction. What is the most likely result?", "RET_LOAD_PATH", ["Stiffness must increase because porosity is unchanged", "The material becomes isotropic", "Load-path efficiency may decrease even at the same relative density", "Orientation cannot affect buckling"], required=True, correct=3),
    mc("A layered shell composite increases crack resistance through tablet pull-out and interface sliding. Which observation best supports the intended mechanism?", "RET_HIERARCHY", ["Cracks repeatedly deflect and dissipate energy at interfaces", "The composite has the highest hardness only", "Every layer fractures simultaneously", "The interfaces carry no shear"], required=True, correct=1),
    mc("A dry adhesive must carry a vertical load but release when rolled from an edge. Which design choice is most relevant?", "RET_DIRECTIONAL", ["Uniform liquid glue", "A perfectly rigid flat pad", "Magnetic particles in every surface", "Compliant directional fibrils that change contact under shear and peel"], required=True, correct=4),
    mc("A riblet coating works in a wind tunnel but fails after surface wear doubles its effective groove width. What should be checked first?", "RET_SCALE_FLOW", ["Pigment concentration", "Whether groove scale still matches the near-wall flow regime", "Whether all turbulence has disappeared", "Whether the coating resembles shark skin visually"], required=True, correct=2),
    mc("An owl-inspired fan blade becomes quieter but consumes more power. What is the best next design step?", "RET_SERRATION_TRADEOFF", ["Use the quietest geometry regardless of efficiency", "Remove all edge features", "Evaluate a Pareto trade-off across noise, efficiency, loading, and operating condition", "Increase serration density without testing"], required=True, correct=3),
    mc("A multilayer optical sensor changes color when layer spacing swells. What mechanism makes this useful?", "RET_OPTICAL_SCALE", ["The reflected wavelength shifts with optical path spacing and refractive index", "The material creates new pigment molecules", "All wavelengths are absorbed equally", "Color is independent of geometry"], required=True, correct=1),
    mc("A passive cooling strategy is moved from a hot-dry climate to a hot-humid climate. Which transfer decision is strongest?", "RET_CLIMATE_TRANSFER", ["Keep every dimension unchanged", "Copy the biological exterior more accurately", "Assume thermal mass always cools", "Re-evaluate heat loads, airflow drivers, humidity, cycling, and occupancy before resizing the system"], required=True, correct=4),
    mc("A vascular self-healing composite can deliver agent repeatedly but adds channels that reduce baseline strength. What does this illustrate?", "RET_HEALING_LIMIT", ["Healing eliminates all structural trade-offs", "Repair capacity and original mechanical performance must be optimized together", "Inspection is unnecessary", "Channel geometry cannot affect failure"], required=True, correct=2),
    mc("Warehouse robots read task markers left in a shared digital environment rather than receiving a central schedule. This is an example of what?", "RET_STIGMERGY", ["Direct teleoperation", "Random search", "Stigmergic coordination", "A single-agent controller"], required=True, correct=3),
    mc("A team needs a surface that sheds contaminants. Which search query is most function-first?", "RET_FUNCTION_FIRST", ["Biological strategies for preventing particle attachment under wet and dry conditions", "Beautiful leaves", "Animals with green surfaces", "The most famous biomimetic products"], required=True, correct=1),
    mc("A building façade copies pine-cone scales but uses a material that cannot swell under humidity. Why is the analogy weak?", "RET_ANALOGY", ["The façade is too large", "The color differs", "The organism is a plant", "The visible form was copied without preserving the actuation mechanism"], required=True, correct=4),
    mc("An AI hint agrees with the learner's first idea but cites no source and conflicts with a later test. What is the most appropriate response?", "RET_AI_RELIANCE", ["Keep it because it confirms the first idea", "Treat it as provisional, inspect evidence, and update the decision using the test", "Delete all test results", "Increase confidence without revising"], required=True, correct=2),
    text_entry("RETENTION TRANSFER 1. A lightweight protective enclosure must carry repeated directional loads and survive occasional impacts. Propose and justify a bio-inspired architecture, including mechanism and boundary conditions.", "RET_TRANSFER_STRUCTURE", required=True),
    text_entry("RETENTION TRANSFER 2. A service robot needs reversible, residue-free attachment to a smooth panel in a dusty environment. Propose the mechanism, test sequence, and mitigation for contamination.", "RET_TRANSFER_ADHESION", required=True),
    text_entry("RETENTION TRANSFER 3. A wildfire-monitoring drone swarm must coordinate after communication links fail. Specify a local coordination rule, expected emergent behavior, and one scaling or safety risk.", "RET_TRANSFER_SWARM", required=True),
]


retention_blocks = [
    {"name": "Retention linkage", "items": [
        descriptive("Administer 3 to 4 weeks after the immediate posttest. Keep this development form inactive until expert review and pilot linking are complete.", "RETENTION_HOLD"),
        text_entry("Study ID assigned by the research team", "STUDY_ID", required=True),
        mc("I will complete this assessment without external AI assistance unless the approved protocol explicitly allows it.", "RET_INTEGRITY", ["I agree", "I do not agree"], required=True),
    ]},
    {"name": "Retention selected response", "items": retention_items[:12]},
    {"name": "Retention constructed transfer", "items": retention_items[12:]},
]


def write_codebook(records):
    fields = ["survey", "question_id", "export_tag", "question_type", "private_pii", "required", "correct_choice", "correct_text", "choices_json", "question_text"]
    with (OUTPUT / "ALGET_Qualtrics_Codebook.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for survey, specs in records:
            for spec in specs:
                writer.writerow({
                    "survey": survey,
                    "question_id": spec["question_id"],
                    "export_tag": spec["tag"],
                    "question_type": spec["type"],
                    "private_pii": spec.get("private", False),
                    "required": spec.get("required", False),
                    "correct_choice": spec.get("correct", ""),
                    "correct_text": spec.get("choices", [])[spec["correct"] - 1] if spec.get("correct") else "",
                    "choices_json": json.dumps(spec.get("choices", []), ensure_ascii=False),
                    "question_text": spec["text"].replace("<b>", "").replace("</b>", ""),
                })


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    packages = [
        ("ALGET Engineering Pre-Survey and Baseline Test", "pre", pre_blocks, "01_ALGET_Engineering_PreSurvey.qsf"),
        ("ALGET Engineering Post-Survey", "post", post_blocks, "02_ALGET_Engineering_PostSurvey.qsf"),
        ("ALGET Bio-Inspired Design Post-Test", "posttest", posttest_blocks, "03_ALGET_BioInspired_PostTest.qsf"),
        ("ALGET Gift-Card Contact Record", "incentive", incentive_blocks, "04_ALGET_GiftCard_Contact.qsf"),
        ("ALGET Bio-Inspired Design Retention Test", "retention", retention_blocks, "05_ALGET_BioInspired_RetentionTest.qsf"),
    ]
    records = []
    for name, slug, blocks, filename in packages:
        qsf, specs = build_qsf(name, slug, blocks)
        (OUTPUT / filename).write_text(json.dumps(qsf, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        records.append((name, specs))
    write_codebook(records)
    (OUTPUT / "README_IMPORT_AND_IRB_CHECKS.md").write_text("""# ALGET Qualtrics import package

Import each QSF using Qualtrics Projects > Create new project > Survey > From a file. Keep every project inactive until IRB approval.

Required pre-activation checks:

1. Replace the consent placeholder with the exact IRB-approved consent language and configure immediate termination for no consent, under 18, or not enrolled.
2. Insert the approved gift-card amount, eligibility rule, funding source, delivery timing, and tax language if required by the institution.
3. Restrict PII blocks and the separate gift-card survey to designated compensation staff. Export analysis files without `PII_*` columns.
4. Use a random Study ID or Qualtrics Contact List personalized link. Do not derive the ID from initials, date of birth, or other personal facts.
5. Verify reproduction/use permissions for the intact five-item General Engineering Self-Efficacy scale, UES-SF, and SUS. Keep the study-authored AI-reliance items exploratory unless a permission-cleared validated instrument is frozen before cognitive interviews.
6. Expert-review and pilot the pretest, posttest, and retention test as linked parallel forms. Correct-choice numbers and text are in `ALGET_Qualtrics_Codebook.csv`; Qualtrics scoring must be configured and independently checked after import.
7. Set survey expiration, prevent multiple submissions as allowed by the protocol, verify mobile/desktop behavior, and test all display/termination logic with synthetic respondents.
8. Redirect pre and post completion to the separate gift-card contact record if the IRB approves separation. The pre/post QSF files also contain PII blocks because the investigator explicitly requested duplicate contact capture; the safer production configuration is to remove those duplicate blocks after validating the contact survey.
9. Administer `05_ALGET_BioInspired_RetentionTest.qsf` 3 to 4 weeks after the immediate posttest. Do not include the long post-survey scales again.
""", encoding="utf-8")
    (OUTPUT / "QUALTRICS_LIVE_QA_RUNBOOK.md").write_text("""# ALGET Qualtrics live-import and QA runbook

Status: import-ready development package. Keep all projects inactive until every gate below passes and the IRB-approved wording has replaced every hold notice.

## Why the QSF files stop short of live logic

The import files preserve questions, choices, blocks, required-response settings, private-field flags, and export tags. Qualtrics does not publish a stable QSF serialization contract for branch conditions or scoring. Do not inject guessed JSON. Configure those features in the authenticated UI, export each inactive project back to QSF, and retain that export as the execution snapshot.

## Import order and project names

1. `01_ALGET_Engineering_PreSurvey.qsf` → `ALGET 2026 Engineering Pre Survey - INACTIVE`
2. `02_ALGET_Engineering_PostSurvey.qsf` → `ALGET 2026 Engineering Post Survey - INACTIVE`
3. `03_ALGET_BioInspired_PostTest.qsf` → `ALGET 2026 Bio-Inspired Posttest - INACTIVE`
4. `04_ALGET_GiftCard_Contact.qsf` → `ALGET 2026 Gift Card Contact - RESTRICTED - INACTIVE`
5. `05_ALGET_BioInspired_RetentionTest.qsf` → `ALGET 2026 Bio-Inspired Retention - INACTIVE`

Use Projects → Create new project → Survey → From a file. Do not publish while importing or testing.

## Access and privacy controls

- Pre and post contain explicitly requested name and contact questions, so they are identifiable surveys even if default response metadata is anonymized.
- Limit ownership to the PI/data custodian. Give compensation staff access only to the restricted contact project. Do not grant analysts `View Restricted Data`, response editing, report access, or survey sharing that exposes PII.
- Mark `PII_FULL_NAME`, `PII_EMAIL`, `PII_PHONE`, and `PII_CONTACT_PREF` as sensitive/restricted in Data & Analysis after import. The QSF private flag is not a substitute for collaborator-permission QA.
- Enable Anonymize Responses only if approved. It removes default IP/location and contact association, not names or contact details typed into questions.
- Disable public indexing, use HTTPS, set an approved expiration, and use personal links or an approved authenticator. Never put treatment assignment in a URL.
- Export two files: a restricted linkage/compensation file and a de-identified analysis file. The analysis file must contain no `PII_*`, IP address, latitude/longitude, recipient name/email, raw open-text identifiers, or contact-list identifiers.

## Required Survey Flow

### Pre survey

1. Show `Consent`.
2. If `CONSENT != I consent`, end immediately. Unless the IRB explicitly authorizes a screening log, choose the end option that does not record the response.
3. Show `Eligibility`.
4. If `AGE18 != Yes` OR `ENROLLED != Yes`, end immediately under the IRB-approved screen-out rule.
5. Show `Pre-survey contact-information acknowledgement`.
6. If `PII_ACK != Yes`, end before `Pre-survey restricted contact details` and do not retain typed PII.
7. Continue through contact, background, GESE, baseline selected response, and baseline constructed transfer.

### Post survey

1. Show `Post-survey contact-information acknowledgement`.
2. If `PII_ACK != Yes`, end before the restricted contact block or route to an IRB-approved no-contact post-survey path. Freeze this decision before launch.
3. Continue through GESE, manipulation check, UES-SF, SUS, exploratory AI-reliance items, effort, and open response.

### Gift-card contact survey

1. Show `Gift-card contact authorization`.
2. If `CONTACT_CONFIRM != Yes`, end before `Restricted gift-card contact details` and do not record contact information.
3. Display `PII_PHONE` only when delivery preference is `Text message`; define the approved fallback when `No preference` is selected.

### Posttest and retention test

If `TEST_INTEGRITY != I agree` or `RET_INTEGRITY != I agree`, end before the assessment blocks. Do not show scores or answer keys to respondents.

## Scoring

- Create a `Concept_Selected_Response` scoring category.
- In pre, posttest, and retention, assign 1 point only to the correct option for each of the 12 selected-response items in `ALGET_Qualtrics_Codebook.csv`; assign 0 to all distractors.
- Expected selected-response range is 0–12 for each form. Leave the three constructed-transfer tasks unscored in Qualtrics; use the blinded rubric workflow.
- Do not use Qualtrics score as the confirmatory outcome until expert review, cognitive interviews, and pilot item analysis are complete.

## Synthetic path tests

Use UUIDv4 test Study IDs and fictional contact data. Delete all test responses before launch.

| Test | Path | Required result |
|---|---|---|
| PRE-01 | No consent | Immediate approved ending; no eligibility, PII, or outcome items |
| PRE-02 | Consent; under 18 or prefer not | Approved screen-out; no PII or outcome items |
| PRE-03 | Consent; 18+; not enrolled | Approved screen-out; no PII or outcome items |
| PRE-04 | Eligible; `PII_ACK=No` | No restricted contact block |
| PRE-05 | Eligible; `PII_ACK=Yes` | Required name/email/preference; valid completion |
| POST-01 | `PII_ACK=No` | Frozen IRB-approved no-contact path behaves exactly as specified |
| GIFT-01 | `CONTACT_CONFIRM=No` | No contact detail block and no payout record |
| TEST-01 | Integrity not agreed | No assessment questions or score |
| SCORE-01 | All 12 correct | Score 12 |
| SCORE-02 | All 12 distractors | Score 0 |
| SCORE-03 | One correct at a time | Exactly 1 point for the codebook answer on every item |
| EXPORT-01 | De-identified export | No PII/default identifying metadata; one row per Study ID and stage |
| EXPORT-02 | Restricted payout export | Study ID, approved contact fields, milestone, and payment status only |

Repeat eligible completion on desktop and mobile preview. Verify page breaks, keyboard navigation, screen-reader labels, back-button behavior after branches, save-and-continue policy, duplicate prevention, expiration, custom endings, redirects, and response status.

## Freeze evidence before activation

Retain: imported project IDs, inactive QSF exports, SHA-256 hashes, screenshots of Survey Flow/scoring/options/collaboration permissions, synthetic test matrix with pass/fail and tester/date, codebook, final IRB approval, instrument version, and preregistration link. Any later survey edit requires a new export, hash, and deviation decision.

Official platform references:

- https://www.qualtrics.com/support/survey-platform/survey-module/survey-flow/standard-elements/branch-logic/
- https://www.qualtrics.com/support/survey-platform/survey-module/survey-flow/standard-elements/end-of-survey-element/
- https://www.qualtrics.com/support/survey-platform/survey-module/survey-tools/scoring/
- https://www.qualtrics.com/support/survey-platform/survey-module/survey-options/survey-protection/
- https://www.qualtrics.com/support/survey-platform/data-and-analysis-module/data/add-new-fields/editing-custom-variables/
""", encoding="utf-8")
    print(f"created {len(packages)} QSF files and codebook in {OUTPUT}")


if __name__ == "__main__":
    main()
