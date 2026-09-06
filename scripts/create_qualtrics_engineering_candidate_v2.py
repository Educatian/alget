"""Create a non-live Qualtrics candidate package that resolves known item-design holds.

The historical Qualtrics projects and the original QSF package are never
modified. Candidate wording remains review-only until approved-version
reconciliation, expert review, cognitive interviews, pilot evidence, and
release QA are complete.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
import sys
from copy import deepcopy
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

import create_qualtrics_engineering_surveys as base  # noqa: E402
from research.measures.build_engineering_validation_packet import build as build_fieldwork  # noqa: E402


OUTPUT = ROOT / "research/measures/qualtrics_candidate_v2"
ORIGINAL_CODEBOOK = base.OUTPUT / "ALGET_Qualtrics_Codebook.csv"
VERSION = "2026-08-25-candidate-v2.4-manual-email-fulfillment"
EMBEDDED_LINKAGE_FIELDS = ("study_id", "wave", "cohort")

CONSENT_DRAFT_HTML = (
    "<p><b>STUDENT REVIEW COPY — this inactive project is not accepting research consent. Do not activate until an IRB amendment or authoritative expanded-scope approval is archived, this wording is matched to its stamped consent, and release QA is complete.</b></p>"
    "<p>You are invited because you are at least 18 years old and enrolled in an eligible "
    "engineering or bioengineering course. This study examines whether transparent adaptive "
    "AI-supported guidance affects Bio-Inspired Design understanding, transfer, confidence "
    "calibration, and learning processes compared with fixed practice support.</p>"
    "<p>If you participate, you will be assigned by chance through a concealed schedule to one of two support "
    "versions. Both versions use the same textbook and Unity simulations. Participation lasts "
    "6–8 instructional weeks and includes a 30–35 minute pre-study assessment, a 35–45 minute "
    "post-study assessment, and a 20–25 minute retention assessment 3–4 weeks later. An optional "
    "30–40 minute interview may be offered under a separate choice.</p>"
    "<p>Reasonably foreseeable risks include loss of confidentiality, frustration or mental effort, "
    "technical problems, and incorrect or unhelpful AI recommendations. AI support does not "
    "determine grades. You may not benefit personally. Participation is voluntary; declining or "
    "withdrawing will not affect grades, course standing, or ordinary instructional access.</p>"
    "<p>Outcome records use a random Study ID. Demographic responses are collected once and are "
    "sensitive pseudonymous data. Name and contact information are collected only in a separate, "
    "restricted gift-card/contact survey and are excluded from outcome exports, telemetry, rubric "
    "scoring files, and learner-model artifacts. Compensation is [AMOUNT] for [MILESTONE], delivered "
    "within [TIME] by email after manual completion verification, subject to the IRB-approved rule.</p>"
    "<p>Questions about the study: [PI NAME, TITLE, EMAIL, PHONE]. Questions or concerns about your "
    "rights as a research participant: The University of Alabama Human Research Protection Program, "
    "205-348-8461 or rscompliance@ua.edu. If the expanded scope is approved and recruitment opens, "
    "you will be offered a copy of the stamped approved consent information.</p>"
)

CONSENT_REVIEW_QUESTION = (
    "Flow-test item for this inactive review project: based on the working-copy information above, "
    "would you voluntarily agree to participate if the expanded scope were approved and recruitment opened?"
)

OUTCOME_PII_TAGS = {
    "PII_ACK",
    "PII_FULL_NAME",
    "PII_EMAIL",
    "PII_PHONE",
    "PII_CONTACT_PREF",
}

DEMOGRAPHIC_TAGS = {
    "DEMO_AGE_BAND",
    "DEMO_GENDER",
    "DEMO_RACE_ETHNICITY",
    "DEMO_PARENT_BA",
    "YEAR",
    "MAJOR_CATEGORY",
}

FAMILIES = {
    "load_path_structure": ("PRE_CELLULAR", "POST_LOAD_PATH", "RET_LOAD_PATH"),
    "hierarchical_toughening": ("PRE_NACRE", "POST_HIERARCHY", "RET_HIERARCHY"),
    "directional_dry_adhesion": ("PRE_GECKO", "POST_DIRECTIONAL", "RET_DIRECTIONAL"),
    "riblet_scale_flow": ("PRE_RIBLET", "POST_SCALE_FLOW", "RET_SCALE_FLOW"),
    "serration_tradeoff": ("PRE_SERRATION", "POST_SERRATION_TRADEOFF", "RET_SERRATION_TRADEOFF"),
    "structural_color_scale": ("PRE_COLOR", "POST_OPTICAL_SCALE", "RET_OPTICAL_SCALE"),
    "climate_boundary_transfer": ("PRE_THERMAL", "POST_CLIMATE_TRANSFER", "RET_CLIMATE_TRANSFER"),
    "self_healing_limit": ("PRE_HEALING", "POST_HEALING_LIMIT", "RET_HEALING_LIMIT"),
    "stigmergic_coordination": ("PRE_SWARM", "POST_STIGMERGY", "RET_STIGMERGY"),
    "function_first_search": ("PRE_FUNCTION_FIRST", "POST_FUNCTION_FIRST", "RET_FUNCTION_FIRST"),
    "mechanism_preserving_analogy": ("PRE_ANALOGY", "POST_ANALOGY", "RET_ANALOGY"),
    "evidence_calibrated_ai_reliance": ("PRE_AI_RELIANCE", "POST_AI_RELIANCE", "RET_AI_RELIANCE"),
}
TAG_TO_FAMILY = {tag: family for family, tags in FAMILIES.items() for tag in tags}
FAMILY_METADATA = {
    "load_path_structure": {
        "cognitive_operation": "predict_effect_of_orientation_on_load_path_performance",
        "correct_rationale": "Equal mass does not imply equal response; architecture and orientation govern load transfer, stiffness-to-mass, buckling, and off-axis vulnerability.",
    },
    "hierarchical_toughening": {
        "cognitive_operation": "diagnose_change_that_disrupts_interface_toughening",
        "correct_rationale": "Compliant interfaces can deflect cracks, slide, and dissipate energy; removing them can restore brittle monolithic fracture behavior.",
    },
    "directional_dry_adhesion": {
        "cognitive_operation": "explain_and_select_shear_peel_asymmetric_contact",
        "correct_rationale": "Compliant directional fibrils alter real contact area with loading direction, supporting shear attachment and low-force peel release.",
    },
    "riblet_scale_flow": {
        "cognitive_operation": "diagnose_nondimensional_feature_scale_mismatch",
        "correct_rationale": "Riblet performance depends on feature scale relative to the near-wall flow regime; geometric copying without scale matching can reverse the effect.",
    },
    "serration_tradeoff": {
        "cognitive_operation": "evaluate_acoustic_aerodynamic_multiobjective_tradeoff",
        "correct_rationale": "Serration spacing and scale affect coupled noise, efficiency, loading, and operating-condition outcomes, so no single density is universally optimal.",
    },
    "structural_color_scale": {
        "cognitive_operation": "predict_optical_response_from_path_spacing",
        "correct_rationale": "The reflected peak depends on optical path spacing and refractive index; increasing spacing at stable index generally shifts the peak toward longer wavelength.",
    },
    "climate_boundary_transfer": {
        "cognitive_operation": "select_boundary_condition_remapping_for_climate_transfer",
        "correct_rationale": "Passive ventilation performance emerges from coupled airflow, heat load, thermal mass, humidity, and cycling, which must be re-matched in a new climate.",
    },
    "self_healing_limit": {
        "cognitive_operation": "evaluate_repair_capacity_baseline_performance_tradeoff",
        "correct_rationale": "Healing capacity and repeatability can add material, channels, or depleted agents, so repair benefits must be balanced against original structural performance and damage eligibility.",
    },
    "stigmergic_coordination": {
        "cognitive_operation": "diagnose_and_mitigate_stale_environmental_marker_dynamics",
        "correct_rationale": "Stigmergy relies on local responses to environmental traces; decay and completion updates preserve decentralization while limiting stale-marker congestion or duplication.",
    },
    "function_first_search": {
        "cognitive_operation": "repair_search_sequence_using_function_constraints_and_metrics",
        "correct_rationale": "A defensible biomimetic search begins with target function, operating conditions, constraints, and success measures before selecting biological strategies.",
    },
    "mechanism_preserving_analogy": {
        "cognitive_operation": "diagnose_source_target_mechanism_transfer_failure",
        "correct_rationale": "Visual resemblance is insufficient; the source causal mechanism must remain operable in the target material, scale, loading, and environmental conditions.",
    },
    "evidence_calibrated_ai_reliance": {
        "cognitive_operation": "evaluate_ai_claim_against_conflicting_evidence",
        "correct_rationale": "AI confidence is not correctness; appropriate reliance requires inspecting cited evidence and test traces, then revising or rejecting the recommendation.",
    },
}


def selected(text: str, tag: str, choices: list[str], correct: int):
    return base.mc(text, tag, choices, required=True, correct=correct)


def multi_select(
    text: str,
    tag: str,
    choices: list[str],
    *,
    required: bool = False,
    exclusive_choices: list[int] | None = None,
) -> dict:
    """Create a Qualtrics multiple-answer item with optional exclusive choices."""
    return {
        "kind": "question",
        "type": "MC",
        "selector": "MAVR",
        "text": text,
        "tag": tag,
        "choices": choices,
        "required": required,
        "private": False,
        "correct": None,
        "exclusive_choices": exclusive_choices or [],
    }


SELECTED_REPLACEMENTS = {
    "PRE_CELLULAR": selected(
        "Two equal-mass protective inserts use open-cell struts. Design X aligns most struts with the dominant impact direction; Design Y uses random orientation. Which prediction is most defensible?",
        "PRE_CELLULAR",
        [
            "The two inserts must behave identically because their mass is equal",
            "Random orientation is always stiffer under a dominant directional load",
            "Design X may improve directional stiffness and energy management if local buckling and off-axis impact are controlled",
            "An open-cell structure cannot transmit compressive load",
        ],
        3,
    ),
    "PRE_NACRE": selected(
        "A layered casing dissipates impact through crack deflection and sliding at compliant interfaces. Which redesign would most directly weaken that mechanism?",
        "PRE_NACRE",
        [
            "Replacing the interfaces with one strongly bonded brittle monolith",
            "Adding a second camera view during testing",
            "Changing the surface color without changing the layers",
            "Measuring cracks more frequently without changing the design",
        ],
        1,
    ),
    "PRE_GECKO": selected(
        "A reusable gripper pad carries high load in shear but releases when peeled from one edge. Which feature best explains both behaviors?",
        "PRE_GECKO",
        [
            "A permanently tacky liquid layer",
            "Microscopic suction pockets with no pressure source",
            "Compliant directional fibrils that change real contact area with loading direction",
            "A rigid flat surface that is equally sticky in every direction",
        ],
        3,
    ),
    "PRE_RIBLET": selected(
        "A riblet film lowers drag in a small test channel but increases drag after every groove dimension is enlarged tenfold for a vehicle. What should be diagnosed first?",
        "PRE_RIBLET",
        [
            "Riblets can function only in water",
            "The enlarged feature scale no longer matches the near-wall flow regime",
            "All kinds of surface roughness have the same drag effect",
            "Enlargement must have made the entire flow laminar",
        ],
        2,
    ),
    "PRE_SERRATION": selected(
        "A serrated fan edge reduces noise at one operating condition but increases power use. Which next design decision is strongest?",
        "PRE_SERRATION",
        [
            "Evaluate spacing and scale jointly across acoustic, aerodynamic, loading, and operating conditions",
            "Maximize serration density under every condition",
            "Choose the quietest geometry regardless of power use",
            "Evaluate noise and efficiency separately because they cannot interact",
        ],
        1,
    ),
    "PRE_COLOR": selected(
        "A periodic optical film swells while its refractive index remains approximately constant. Which prediction about its reflected peak is most defensible?",
        "PRE_COLOR",
        [
            "The peak should shift toward a longer wavelength as optical path spacing increases",
            "Only pigment concentration can change the reflected peak",
            "Smaller structural spacing must always produce a redder reflection",
            "Geometry and viewing conditions cannot affect structural color",
        ],
        1,
    ),
    "PRE_THERMAL": selected(
        "A passive ventilation concept works in a hot-dry climate but overheats after transfer to a humid climate with weak day-night cycling. What should the designer do first?",
        "PRE_THERMAL",
        [
            "Copy the original vent dimensions exactly",
            "Re-match airflow drivers, thermal mass, heat loads, humidity, and cycling",
            "Add a more mound-like exterior without analysis",
            "Assume that more thermal mass must always cool the building",
        ],
        2,
    ),
    "PRE_HEALING": selected(
        "A healing architecture repairs a first crack, but repeat-delivery features add mass and reduce baseline strength. Which conclusion best guides redesign?",
        "PRE_HEALING",
        [
            "Any self-healing mechanism removes structural trade-offs",
            "Repair capacity, eligible damage modes, repeatability, and original mechanical performance must be optimized together",
            "Successful healing makes inspection unnecessary",
            "Adding healing agent or channels has no mass or strength cost",
        ],
        2,
    ),
    "PRE_SWARM": selected(
        "A delivery swarm uses shared task markers, but old markers keep attracting robots to completed jobs. Which change best preserves decentralized coordination while reducing duplicated work?",
        "PRE_SWARM",
        [
            "Have one central operator assign every job",
            "Increase marker persistence indefinitely",
            "Add task-completion updates and marker decay tied to recent local evidence",
            "Remove local sensing and let every robot move randomly",
        ],
        3,
    ),
    "PRE_FUNCTION_FIRST": selected(
        "A team needs a surface that sheds wet and dry particles without a toxic coating. What should it do before choosing an organism?",
        "PRE_FUNCTION_FIRST",
        [
            "Choose the most visually interesting leaf",
            "Copy a famous natural texture before defining a test",
            "Select the organism with the most complex surface",
            "Define the shedding function, operating conditions, constraints, and success measures, then search biological strategies",
        ],
        4,
    ),
    "PRE_ANALOGY": selected(
        "A façade copies pine-cone scale geometry but uses a material that cannot swell with humidity. Why is the transfer weak?",
        "PRE_ANALOGY",
        [
            "The façade is larger than the pine cone",
            "The façade uses a different color",
            "The biological source is a plant rather than an animal",
            "The visible form was copied without preserving the actuation mechanism under target constraints",
        ],
        4,
    ),
    "POST_OPTICAL_SCALE": selected(
        "An optical film's periodic spacing increases while refractive index remains approximately constant. What shift should the mechanism predict?",
        "POST_OPTICAL_SCALE",
        [
            "The reflected peak should shift toward a longer wavelength",
            "The film must create more chemical pigment",
            "The reflected peak cannot change unless thickness decreases",
            "Structural color is independent of geometry",
        ],
        1,
    ),
    "POST_HEALING_LIMIT": selected(
        "A vascular healing composite can repair repeated cracks, but larger delivery channels reduce baseline strength. Which design conclusion is strongest?",
        "POST_HEALING_LIMIT",
        [
            "Balance repair capacity and eligible damage modes against baseline strength and channel-related failure",
            "Repeated healing eliminates the need to inspect the structure",
            "The largest possible channels always maximize total performance",
            "Baseline strength is unrelated to the healing architecture",
        ],
        1,
    ),
    "POST_STIGMERGY": selected(
        "A warehouse swarm follows virtual task markers, but stale markers cause congestion at completed jobs. Which local-rule change best preserves stigmergic coordination?",
        "POST_STIGMERGY",
        [
            "Replace every local decision with a permanent central schedule",
            "Decay or invalidate markers using recent completion evidence and local congestion",
            "Increase every marker's strength after task completion",
            "Remove task sensing and use an unconstrained random walk",
        ],
        2,
    ),
    "POST_FUNCTION_FIRST": selected(
        "A cooling-design team began by choosing a favorite animal and copying its shape. Which correction best restores a function-first process?",
        "POST_FUNCTION_FIRST",
        [
            "Search for a more visually similar animal",
            "Add biological labels to the copied shape",
            "Define heat-rejection performance, climate, loads, and constraints, then search for mechanisms that satisfy them",
            "Choose the strongest biological material without a use case",
        ],
        3,
    ),
    "RET_OPTICAL_SCALE": selected(
        "A multilayer optical sensor swells, increasing layer spacing while refractive index stays approximately constant. Which response should be predicted?",
        "RET_OPTICAL_SCALE",
        [
            "The reflected peak shifts toward a longer wavelength",
            "New pigment molecules must be created",
            "All wavelengths become equally absorbed",
            "The reflected spectrum remains independent of geometry",
        ],
        1,
    ),
    "RET_STIGMERGY": selected(
        "A wildfire-drone swarm follows shared digital markers, but outdated markers draw agents into already covered areas. Which modification best addresses the failure without centralizing control?",
        "RET_STIGMERGY",
        [
            "Assign all movement from one remote operator",
            "Make every marker permanent",
            "Use local coverage updates plus marker decay and congestion-sensitive suppression",
            "Disable environmental sensing and move randomly",
        ],
        3,
    ),
    "RET_FUNCTION_FIRST": selected(
        "A team needs a nontoxic surface that sheds wet and dry contaminants over repeated use. Which first search step is most function-first?",
        "RET_FUNCTION_FIRST",
        [
            "Translate shedding, durability, wet/dry conditions, and toxicity limits into search functions before seeking biological strategies",
            "Choose the most beautiful leaf",
            "Search only for green animals",
            "Copy the best-known commercial biomimetic product",
        ],
        1,
    ),
}


CONSTRUCTED_REPLACEMENTS = {
    "PRE_TRANSFER_STRUCTURE": "BASELINE TRANSFER 1. A bicycle component must be lightweight, carry a known dominant load, and survive occasional impact. Propose a bio-inspired structural strategy; explain its causal mechanism and map it to the component; specify one comparison or test and the result that would support or challenge the mechanism; and reason through at least two constraints or trade-offs, including an off-axis or failure boundary.",
    "POST_TRANSFER_STRUCTURE": "TRANSFER TASK 1. A drone frame must be light, resist a known dominant load path, and survive occasional off-axis impacts. Propose a bio-inspired architecture; explain and map the mechanism; specify one discriminating comparison or test and its predicted result; and reason through at least two constraints or trade-offs that determine whether you would adopt it.",
    "RET_TRANSFER_STRUCTURE": "RETENTION TRANSFER 1. A lightweight protective enclosure must carry repeated directional loads and survive occasional impacts. Propose and map a bio-inspired architecture; explain the mechanism; specify one comparison or test and its predicted result; and justify the design under at least two material, loading, manufacturing, fatigue, or impact boundaries.",
    "PRE_TRANSFER_ADHESION": "BASELINE TRANSFER 2. A robot must grip a fragile glass vial and release it without residue. Propose and map a bio-inspired attachment mechanism; explain the relevant loading direction; specify one comparison or test and its predicted result; and justify one failure mode, constraint or trade-off, and mitigation.",
    "POST_TRANSFER_ADHESION": "TRANSFER TASK 2. A maintenance robot must grip a smooth panel under shear and release without residue. Propose and map a bio-inspired attachment mechanism; explain loading direction; specify one discriminating comparison or test and its predicted result; and justify one failure mode, constraint or trade-off, and mitigation.",
    "RET_TRANSFER_ADHESION": "RETENTION TRANSFER 2. A service robot needs reversible, residue-free attachment to a smooth panel in a dusty environment. Propose and map the mechanism; explain loading direction; specify a comparison or test sequence and predicted result; and justify a contamination, durability, or release trade-off and mitigation.",
    "PRE_TRANSFER_SWARM": "BASELINE TRANSFER 3. A fleet of delivery robots must reassign tasks when communication is intermittent. Specify the information available to one robot and a biologically inspired local update rule; explain how repeated local decisions should create system-level allocation; propose one simulation or field comparison and predicted outcome that could challenge the rule; and reason through one scaling risk and one safety or efficiency trade-off.",
    "POST_TRANSFER_SWARM": "TRANSFER TASK 3. A warehouse robot team must allocate tasks after communication outages. Specify a biologically inspired local rule and how local information creates system behavior; propose one comparison or test with a predicted outcome; and explain one scaling risk plus one safety, congestion, duplication, or fairness trade-off and mitigation.",
    "RET_TRANSFER_SWARM": "RETENTION TRANSFER 3. A wildfire-monitoring drone swarm must coordinate after communication links fail. Specify the information available to one drone, a local rule, and the expected emergent behavior; propose one simulation or field comparison and predicted outcome; and justify a mitigation for one scaling or safety trade-off.",
}

CONSTRUCTED_FAMILY = {
    tag: family
    for family in ("structure", "adhesion", "swarm")
    for tag in (f"PRE_TRANSFER_{family.upper()}", f"POST_TRANSFER_{family.upper()}", f"RET_TRANSFER_{family.upper()}")
}


def slug(text: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return value[:96]


def replace_specs(blocks: list[dict]) -> list[dict]:
    output = deepcopy(blocks)
    for block in output:
        replaced = []
        for spec in block["items"]:
            tag = spec.get("tag")
            if tag in SELECTED_REPLACEMENTS:
                spec = deepcopy(SELECTED_REPLACEMENTS[tag])
            elif tag in CONSTRUCTED_REPLACEMENTS:
                spec = base.text_entry(CONSTRUCTED_REPLACEMENTS[tag], tag, required=True)
            if tag in TAG_TO_FAMILY:
                spec["item_family"] = TAG_TO_FAMILY[tag]
                spec["cognitive_demand"] = "apply_analyze_or_evaluate"
                spec.update(FAMILY_METADATA[spec["item_family"]])
                correct = spec["correct"]
                spec["distractor_misconceptions"] = {
                    str(index): f"{tag.lower()}::{slug(choice)}"
                    for index, choice in enumerate(spec["choices"], 1)
                    if index != correct
                }
            if tag in CONSTRUCTED_FAMILY:
                spec["task_family"] = CONSTRUCTED_FAMILY[tag]
                spec["elicits_dimensions"] = {
                    "mechanism_accuracy": True,
                    "evidence_alignment": True,
                    "constraint_tradeoff_reasoning": True,
                    "transfer_justification": True,
                }
            replaced.append(spec)
        block["items"] = replaced
    return output


def add_pre_demographics(blocks: list[dict]) -> list[dict]:
    """Add a privacy-minimized demographic profile to the pre-survey only.

    These variables remain pseudonymous research outcomes linked by the random
    Study ID. They are not direct identifiers and are never copied to the
    compensation form, telemetry, or learner-model feature set.
    """
    output = deepcopy(blocks)
    background = next((block for block in output if block["name"] == "Background"), None)
    if background is None:
        raise ValueError("pre: expected Background block was not found")

    existing = {item.get("tag"): item for item in background["items"]}
    required_existing = {
        "YEAR", "MAJOR", "COURSEWORK", "GENAI_FREQ", "SIM3D_FREQ", "DEVICE", "ACCESS_NEED"
    }
    if not required_existing.issubset(existing):
        raise ValueError("pre: Background block is missing expected source items")

    year_item = deepcopy(existing["YEAR"])
    year_item["required"] = True

    background["name"] = "Participant profile and prior experience"
    background["items"] = [
        base.descriptive(
            "The following background questions are linked to your responses by random Study ID, "
            "not by name or contact information. They are used to describe the sample, assess "
            "generalizability, and conduct only prespecified or clearly labeled exploratory equity "
            "checks. Choose 'Prefer not to answer' whenever you do not wish to disclose an item.",
            "DEMO_NOTICE",
        ),
        base.mc(
            "What is your age range?",
            "DEMO_AGE_BAND",
            ["18-20", "21-24", "25-34", "35-44", "45 or older", "Prefer not to answer"],
            required=True,
        ),
        base.mc(
            "How do you describe your gender identity?",
            "DEMO_GENDER",
            ["Woman", "Man", "Nonbinary", "Another gender identity", "Prefer not to answer"],
            required=True,
        ),
        multi_select(
            "What is your race and/or ethnicity? Select all that apply.",
            "DEMO_RACE_ETHNICITY",
            [
                "American Indian or Alaska Native",
                "Asian",
                "Black or African American",
                "Hispanic or Latino",
                "Middle Eastern or North African",
                "Native Hawaiian or Pacific Islander",
                "White",
                "Prefer not to answer",
            ],
            required=True,
            exclusive_choices=[8],
        ),
        base.mc(
            "Before you began college, had either of your parents or guardians completed a four-year bachelor's degree?",
            "DEMO_PARENT_BA",
            ["No", "Yes", "Unsure", "Prefer not to answer"],
            required=True,
        ),
        year_item,
        base.mc(
            "Which category best describes your current major or academic program?",
            "MAJOR_CATEGORY",
            [
                "Mechanical or aerospace engineering",
                "Civil, environmental, architectural, or construction engineering",
                "Electrical or computer engineering",
                "Chemical, biological, biomedical, or materials engineering",
                "Industrial, systems, operations, or manufacturing engineering",
                "Another engineering or engineering-technology program",
                "Non-engineering, interdisciplinary, or undeclared program",
                "Prefer not to answer",
            ],
            required=True,
        ),
        existing["COURSEWORK"],
        existing["GENAI_FREQ"],
        existing["SIM3D_FREQ"],
        existing["DEVICE"],
        existing["ACCESS_NEED"],
    ]
    return output


def strengthen_pre_consent(blocks: list[dict]) -> list[dict]:
    """Replace the generic placeholder with a complete participant-facing IRB draft.

    The text remains explicitly fail-closed because the PI, compensation values,
    retention rule, protocol number, and final IRB wording are external decisions.
    """
    output = deepcopy(blocks)
    consent = next((block for block in output if block["name"] == "Consent"), None)
    if consent is None:
        raise ValueError("pre: expected Consent block was not found")
    notice = next((item for item in consent["items"] if item.get("tag") == "CONSENT_NOTICE"), None)
    if notice is None:
        raise ValueError("pre: expected CONSENT_NOTICE was not found")
    notice["text"] = CONSENT_DRAFT_HTML
    choice = next((item for item in consent["items"] if item.get("tag") == "CONSENT"), None)
    if choice is None:
        raise ValueError("pre: expected CONSENT was not found")
    choice["text"] = CONSENT_REVIEW_QUESTION
    return output


def add_embedded_linkage(qsf: dict) -> None:
    """Declare the ALGET query-string linkage fields before every survey block.

    The visible STUDY_ID confirmation remains as a fail-safe. The analysis
    builder rejects a response when the visible and embedded UUIDs disagree.
    """
    flow_element = next(
        element for element in qsf["SurveyElements"] if element["Element"] == "FL"
    )
    flow = flow_element["Payload"]["Flow"]
    flow.insert(0, {
        "Type": "EmbeddedData",
        "FlowID": "FL_ED_LINKAGE",
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
    })
    flow_element["Payload"]["Properties"] = {"Count": len(flow)}


def separate_outcome_identity(blocks: list[dict], stage: str) -> list[dict]:
    """Keep direct identifiers out of outcome forms and link by Study ID only.

    Name/contact collection remains available through the separate gift-card
    project, which can be reached after either the pre or post milestone. This
    makes the deidentified analysis export a property of the instrument design,
    rather than a promise that depends on manually excluding columns later.
    """
    output: list[dict] = []
    insertion_index: int | None = None
    for block in deepcopy(blocks):
        tags = {item.get("tag") for item in block["items"]}
        if tags & OUTCOME_PII_TAGS:
            if insertion_index is None:
                insertion_index = len(output)
            continue
        output.append(block)

    if insertion_index is None:
        raise ValueError(f"{stage}: expected outcome PII blocks were not found")

    prefix = stage.upper()
    linkage_block = {
        "name": f"{stage.title()} study linkage and separate compensation contact",
        "items": [
            base.descriptive(
                "Enter only the Study ID assigned by the research team. "
                "Do not enter your name, email address, or phone number in this outcome survey. "
                "If compensation or follow-up contact is approved, use the separate Gift-Card "
                "Contact survey and enter the same Study ID there.",
                f"{prefix}_IDENTITY_SEPARATION_NOTICE",
            ),
            base.text_entry("Study ID assigned by the research team", "STUDY_ID", required=True),
        ],
    }
    output.insert(insertion_index, linkage_block)
    return output


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def assessment_rows(path: Path) -> dict[str, dict]:
    assessment_tags = set(TAG_TO_FAMILY) | set(CONSTRUCTED_FAMILY)
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return {
            row["export_tag"]: row
            for row in csv.DictReader(handle)
            if row["export_tag"] in assessment_tags
        }


def write_codebook(records: list[tuple[str, list[dict]]], path: Path) -> None:
    fields = [
        "survey", "question_id", "export_tag", "question_type", "private_pii", "required",
        "sensitive_demographic",
        "correct_choice", "correct_text", "choices_json", "question_text", "item_family",
        "cognitive_demand", "cognitive_operation", "correct_rationale",
        "distractor_misconceptions_json", "task_family",
        "elicits_dimensions_json", "candidate_status", "candidate_version",
    ]
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for survey, specs in records:
            for spec in specs:
                choices = spec.get("choices", [])
                correct = spec.get("correct")
                writer.writerow({
                    "survey": survey,
                    "question_id": spec["question_id"],
                    "export_tag": spec["tag"],
                    "question_type": spec["type"],
                    "private_pii": spec.get("private", False),
                    "required": spec.get("required", False),
                    "sensitive_demographic": spec["tag"] in DEMOGRAPHIC_TAGS,
                    "correct_choice": correct or "",
                    "correct_text": choices[correct - 1] if correct else "",
                    "choices_json": json.dumps(choices, ensure_ascii=False),
                    "question_text": spec["text"].replace("<b>", "").replace("</b>", ""),
                    "item_family": spec.get("item_family", ""),
                    "cognitive_demand": spec.get("cognitive_demand", ""),
                    "cognitive_operation": spec.get("cognitive_operation", ""),
                    "correct_rationale": spec.get("correct_rationale", ""),
                    "distractor_misconceptions_json": json.dumps(
                        spec.get("distractor_misconceptions", {}), ensure_ascii=False, sort_keys=True
                    ),
                    "task_family": spec.get("task_family", ""),
                    "elicits_dimensions_json": json.dumps(
                        spec.get("elicits_dimensions", {}), ensure_ascii=False, sort_keys=True
                    ),
                    "candidate_status": "development_only_not_validated",
                    "candidate_version": VERSION,
                })


def write_diff(candidate_codebook: Path) -> None:
    current = assessment_rows(ORIGINAL_CODEBOOK)
    candidate = assessment_rows(candidate_codebook)
    fields = [
        "export_tag", "change_type", "current_question_text", "candidate_question_text",
        "current_correct_text", "candidate_correct_text", "expert_decision", "expert_comment",
    ]
    with (OUTPUT / "CURRENT_VS_CANDIDATE_DIFF.csv").open(
        "w", newline="", encoding="utf-8-sig"
    ) as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for tag in sorted(candidate):
            old = current[tag]
            new = candidate[tag]
            changed = (
                old["question_text"] != new["question_text"]
                or old["choices_json"] != new["choices_json"]
                or old["correct_choice"] != new["correct_choice"]
            )
            writer.writerow({
                "export_tag": tag,
                "change_type": "revised_candidate" if changed else "retained_candidate",
                "current_question_text": old["question_text"],
                "candidate_question_text": new["question_text"],
                "current_correct_text": old["correct_text"],
                "candidate_correct_text": new["correct_text"],
                "expert_decision": "",
                "expert_comment": "",
            })


def main() -> int:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    packages = [
        (
            "ALGET Engineering Pre-Survey and Baseline Test - Candidate v2",
            "prev2",
            separate_outcome_identity(
                add_pre_demographics(strengthen_pre_consent(replace_specs(base.pre_blocks))),
                "pre",
            ),
            "01_ALGET_Engineering_PreSurvey_CandidateV2.qsf",
        ),
        (
            "ALGET Engineering Post-Survey - Candidate v2",
            "postsurveyv2",
            separate_outcome_identity(replace_specs(base.post_blocks), "post"),
            "02_ALGET_Engineering_PostSurvey_CandidateV2.qsf",
        ),
        (
            "ALGET Bio-Inspired Design Post-Test - Candidate v2",
            "posttestv2", replace_specs(base.posttest_blocks), "03_ALGET_BioInspired_PostTest_CandidateV2.qsf",
        ),
        (
            "ALGET Gift-Card Contact Record - Candidate v2",
            "giftv2", replace_specs(base.incentive_blocks), "04_ALGET_GiftCard_Contact_CandidateV2.qsf",
        ),
        (
            "ALGET Bio-Inspired Design Retention Test - Candidate v2",
            "retentionv2", replace_specs(base.retention_blocks), "05_ALGET_BioInspired_RetentionTest_CandidateV2.qsf",
        ),
    ]
    records = []
    for name, slug_name, blocks, filename in packages:
        qsf, specs = base.build_qsf(name, slug_name, blocks)
        add_embedded_linkage(qsf)
        qsf["SurveyEntry"]["SurveyDescription"] = (
            f"ALGET candidate v2 ({VERSION}). Proposed expanded scope is not evidenced by the current approval record; inactive review copy pending amendment/approval, reconciliation, and release QA."
        )
        (OUTPUT / filename).write_text(
            json.dumps(qsf, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
        records.append((name, specs))

    codebook_path = OUTPUT / "ALGET_Qualtrics_Codebook_CandidateV2.csv"
    write_codebook(records, codebook_path)
    write_diff(codebook_path)
    fieldwork_result = build_fieldwork(codebook_path, OUTPUT / "fieldwork")
    (OUTPUT / "README_CANDIDATE_V2.md").write_text(
        """# ALGET Qualtrics Candidate v2

Status: **Candidate v2.4 manual-email fulfillment package synchronized to five inactive cloud review projects — do not activate, publish, recruit, or collect real student data**

This package instantiates the item-revision candidate for expert review, cognitive interviews, and a measurement pilot. Five uniquely named inactive cloud review projects were created on 2026-08-25; the older inactive HOLD projects were not modified. Protocol 25-12-9258 has an initial 2026-01-13 approval for an earlier approximately 60-person general ALGET study, but the current eProtocol/stamped evidence does not cover the proposed expanded 300-person randomized design, gift-card contact process, delayed test, detailed Unity telemetry, or revised data systems. Enrolled-student administration requires an approved amendment or authoritative expanded-scope approval, exact reconciliation to its stamped consent/instrument version, and completion of all cloud QA gates.

Cloud review project IDs:

- Pre: `SV_5z5mWwX62DyFRCC`
- Post survey: `SV_a33tQxcRlIVJILI`
- Posttest: `SV_8xjjebrtWhJnpKC`
- Gift-card contact: `SV_0oz7vztCdDCiVr8`
- Retention: `SV_6Xt3liTcZ5qhMxM`

The authenticated audit confirms correct inactive state, counts, branch structure, scoring-feedback suppression, zero direct PII in outcome forms, and exact codebook-key scoring for all 12 selected-response items on Pre/Posttest/Retention. The consent banner is synchronized to the local student-review copy. The gift-card project is email-only, collects only name and email as direct PII, applies required email-format validation, and states that compensation staff manually verify completion before delivery; no automated gift-card workflow is configured. Gift-card synthetic generation saved five test responses and the project has no collaborators. Remaining cloud gates are: enable/read back sensitive-field restriction when the UA brand exposes that control; run full synthetic branch, mobile, duplicate, completion, and export QA; then freeze/re-export the inactive QSFs. See `research/evidence/qualtrics_candidate_v24_cloud_readonly_audit_2026-08-25.json`.

Review sequence:

1. Use `CURRENT_VS_CANDIDATE_DIFF.csv` for accept/revise/reject decisions.
2. Use `fieldwork/ENGINEERING_EXPERT_REVIEW_TEMPLATE.csv` for 6–8 content and 3–5 measurement reviewers.
3. Regenerate the package and require `candidate_validation.json` to pass 17/17 after every change.
4. Conduct 8–12 cognitive interviews with rotated forms.
5. Obtain and archive the expanded-scope amendment/approval, reconcile Candidate v2.4 against its stamped Bio-Inspired protocol/consent version, then run the approved 30–50-person measurement pilot and fix the linking/scoring rule.
6. Preserve the completed exact-key scoring audit and finish privacy, branch, mobile, duplicate, synthetic-response, and export QA in the inactive Candidate v2.4 package; after scientific review, create a newly fingerprinted release version rather than silently converting an unvalidated candidate into production.

Use `scripts/provision_qualtrics_engineering_surveys.py` only to create uniquely named inactive review copies. Its flow contract inserts an immediate end branch after `TEST_INTEGRITY = I do not agree` and `RET_INTEGRITY = I do not agree`. Never use it to overwrite the five historical HOLD projects or to activate a survey. Promote a newly fingerprinted release only after expert approval, expanded-scope IRB approval and stamped-consent reconciliation, and all authenticated QA gates.

The pre-survey collects a privacy-minimized participant profile linked by random Study ID: age band, gender identity, combined race/ethnicity with multiple selections, parent bachelor's-degree status, year in program, and broad major category. Every demographic item includes a nonresponse option; date of birth, student number, citizenship/visa status, address, and demographic free text are intentionally excluded. Demographics are pseudonymous research data, not anonymous data. They may be used for sample description and prespecified or clearly labeled exploratory equity checks, with small-cell protection and no automatic adaptation, grading, eligibility, compensation, or learner-model use.

Every form declares `study_id`, `wave`, and `cohort` as Embedded Data at the top of Survey Flow so ALGET query parameters are retained. The visible Study ID confirmation remains a fail-safe; analysis must reject visible/embedded UUID mismatches. The pre-survey, post-survey, posttest, and retention forms contain Study ID only and no direct identifiers. Names and contact fields are collected only in the separate Gift-Card Contact project, which must be owner/compensation-staff restricted. The same Study ID may be submitted there after an approved pre or post milestone. Direct identifiers must never enter outcome exports, assessment scoring, telemetry, or learner-model files.
""",
        encoding="utf-8",
    )
    generated_files = sorted(
        path for path in OUTPUT.rglob("*")
        if path.is_file()
        and path.name not in {"candidate_manifest.json", "candidate_validation.json"}
    )
    manifest = {
        "version": VERSION,
        "status": "inactive_cloud_review_not_activated",
        "live_qualtrics_changed": False,
        "original_package_changed": False,
        "expert_or_pilot_evidence_claimed": False,
        "source_generator": Path(__file__).relative_to(ROOT).as_posix(),
        "base_generator": "scripts/create_qualtrics_engineering_surveys.py",
        "original_qsf_sha256": {
            path.name: sha256(path)
            for path in sorted(base.OUTPUT.glob("*.qsf"))
        },
        "fieldwork": fieldwork_result,
        "files": [
            {
                "path": path.relative_to(OUTPUT).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
            }
            for path in generated_files
        ],
    }
    (OUTPUT / "candidate_manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({
        "status": manifest["status"],
        "qsf_files": 5,
        "expert_items": fieldwork_result["expert_items"],
        "output": str(OUTPUT),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
