"""End-to-end happy-path test for the orchestrate pipeline.

Verifies that with all sub-agents stubbed to return well-formed dicts,
the orchestrator produces a payload that survives `normalize_orchestrator_response`
and emerges as a valid OrchestratorResponse Pydantic model. Also exercises
the debate loop by injecting a low-score validation followed by a passing one.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest

from agents.orchestrator import OrchestratorAgent
from server import normalize_orchestrator_response


BIO_DICT = {
    "primary_mechanism": "van der Waals adhesion",
    "explanation": "Microscopic setae create attractive intermolecular forces.",
    "organism_examples": ["gecko"],
    "key_terms": ["setae", "spatulae"],
}

ENG_DICT_V1 = {
    "engineering_principle": "Dry adhesion via microstructured surfaces",
    "application_areas": ["robotics", "medical adhesives"],
    "proposed_solution": "Use lithographed PDMS pillars to mimic setae geometry.",
    "challenges": ["surface contamination", "manufacturing precision"],
}

ENG_DICT_V2 = {
    **ENG_DICT_V1,
    "proposed_solution": "Refine pillar geometry per validator feedback; add cleanability.",
}

VAL_PASS = {
    "is_valid": True,
    "score": 8,
    "critique": "Mechanism plausible; manufacturing path realistic.",
    "suggestions": ["Document durability tests"],
    "biological_fidelity": "high",
    "engineering_feasibility": "near-future",
}

VAL_FAIL = {
    "is_valid": False,
    "score": 5,
    "critique": "Surface contamination risk understated.",
    "suggestions": ["Address contamination explicitly"],
    "biological_fidelity": "moderate",
    "engineering_feasibility": "limited",
}

ACTIVITY_DICT = {
    "activity_title": "Sticky Robotics Sprint",
    "lateral_thinking_prompt": "How could a robot climb glass?",
    "guiding_questions": ["What controls detachment?"],
    "example_idea": "A wall-climbing inspection drone",
}

SUMMARY_DICT = {
    "synthesis": "Gecko setae geometry can inspire reusable dry adhesives.",
    "encouragement": "You are linking mechanism to design well.",
    "next_steps": ["Compare dry vs wet adhesion across surfaces."],
}


def _make_orchestrator():
    """Build an OrchestratorAgent and force-enable client without real API key."""
    orch = OrchestratorAgent(api_key="test-key-not-used")
    # OrchestratorAgent.__init__ will create a genai.Client. We bypass any
    # real network by patching its instance methods downstream.
    return orch


def test_e2e_learn_happy_path():
    orch = _make_orchestrator()

    with patch.object(orch, "_classify_intent", return_value="learn"), \
         patch.object(orch.biology_agent, "analyze_biology", return_value=BIO_DICT), \
         patch.object(orch.engineering_agent, "analyze_engineering", return_value=ENG_DICT_V1), \
         patch.object(orch.validation_agent, "validate_engineering_concept", return_value=VAL_PASS), \
         patch.object(orch.tutor_agent, "synthesize", return_value=SUMMARY_DICT), \
         patch.object(orch.activity_agent, "generate_brainstorming", return_value=ACTIVITY_DICT), \
         patch("agents.orchestrator.rag_service") as rag_mock:
        rag_mock.retrieve_context.return_value = []
        raw = orch.orchestrate(query="How do geckos stick to walls?", course="bio-inspired")

    assert raw["intent"] == "learn"
    assert raw["iterations"] == 0
    assert raw["biology_context"] == BIO_DICT
    assert raw["engineering_application"] == ENG_DICT_V1
    assert raw["validation_critique"] == VAL_PASS

    response = normalize_orchestrator_response(raw)
    assert response.intent == "learn"
    assert response.engineering_application is not None
    assert response.engineering_application.application_idea == "Dry adhesion via microstructured surfaces"
    assert response.activity_brainstorm is not None
    assert response.summary.next_steps == ["Compare dry vs wet adhesion across surfaces."] \
        or response.summary.key_takeaways == ["Compare dry vs wet adhesion across surfaces."]


def test_e2e_learn_debate_loop_revises_then_passes():
    orch = _make_orchestrator()

    eng_responses = iter([ENG_DICT_V1, ENG_DICT_V2])
    val_responses = iter([VAL_FAIL, VAL_PASS])

    def eng_analyze(*_args, **_kwargs):
        return next(eng_responses)

    def eng_revise(*_args, **_kwargs):
        return next(eng_responses)

    def val_validate(*_args, **_kwargs):
        return next(val_responses)

    with patch.object(orch, "_classify_intent", return_value="learn"), \
         patch.object(orch.biology_agent, "analyze_biology", return_value=BIO_DICT), \
         patch.object(orch.engineering_agent, "analyze_engineering", side_effect=eng_analyze), \
         patch.object(orch.engineering_agent, "revise_engineering", side_effect=eng_revise), \
         patch.object(orch.validation_agent, "validate_engineering_concept", side_effect=val_validate), \
         patch.object(orch.tutor_agent, "synthesize", return_value=SUMMARY_DICT), \
         patch.object(orch.activity_agent, "generate_brainstorming", return_value=ACTIVITY_DICT), \
         patch("agents.orchestrator.rag_service") as rag_mock:
        rag_mock.retrieve_context.return_value = []
        raw = orch.orchestrate(query="How do geckos stick to walls?", course="bio-inspired")

    # Debate loop should have run exactly once: 1 revision before passing
    assert raw["iterations"] == 1
    assert raw["validation_critique"] == VAL_PASS
    assert raw["engineering_application"] == ENG_DICT_V2

    response = normalize_orchestrator_response(raw)
    assert response.intent == "learn"
    assert response.engineering_application is not None
    assert "Refine pillar geometry" in (response.engineering_application.feasibility_analysis or "")


SIMULATION_DICT = {
    "description": "Adjustable contact area pad demonstrating van der Waals scaling.",
    "concepts_shown": ["van der Waals", "contact mechanics"],
    "html_code": "<!doctype html><html><body>p5 sketch</body></html>",
}

ILLUSTRATION_DICT = {
    "illustration_title": "Setae adhesion close-up",
    "conceptual_design": "Split panel: SEM gecko foot vs PDMS pillar array.",
    "image_prompt": "technical diagram, split screen",
    "ui_elements": ["Setae label", "Pillar pitch annotation"],
}

EVALUATOR_DICT = {
    "strengths": ["Mechanism aligns with Life's Principles"],
    "areas_for_improvement": ["Address self-cleaning"],
    "janine_feedback": "I love the systems thinking here.",
    "score": 7,
}

SCAFFOLDING_DICT = {
    "misconception_identified": "Conflating macro friction with van der Waals adhesion.",
    "encouraging_remark": "Great that you're noticing the scale shift.",
    "guiding_questions": [
        "What changes when contact area is divided into many small contacts?",
    ],
}


def test_e2e_brainstorm_intent():
    orch = _make_orchestrator()
    with patch.object(orch, "_classify_intent", return_value="brainstorm"), \
         patch.object(orch.biology_agent, "analyze_biology", return_value=BIO_DICT), \
         patch.object(orch.activity_agent, "generate_brainstorming", return_value=ACTIVITY_DICT), \
         patch("agents.orchestrator.rag_service") as rag_mock:
        rag_mock.retrieve_context.return_value = []
        raw = orch.orchestrate(query="Give me ideas for sticky robots", course="bio-inspired")

    assert raw["intent"] == "brainstorm"
    assert raw["activity_brainstorm"] == ACTIVITY_DICT


def test_e2e_evaluate_intent():
    orch = _make_orchestrator()
    with patch.object(orch, "_classify_intent", return_value="evaluate"), \
         patch.object(orch.evaluator_agent, "evaluate_design", return_value=EVALUATOR_DICT), \
         patch("agents.orchestrator.rag_service") as rag_mock:
        rag_mock.retrieve_context.return_value = []
        raw = orch.orchestrate(query="My design proposal: sticky climbing shoes", course="bio-inspired")

    assert raw["intent"] == "evaluate"
    assert raw["evaluation"] == EVALUATOR_DICT


def test_e2e_help_intent():
    orch = _make_orchestrator()
    with patch.object(orch, "_classify_intent", return_value="help"), \
         patch.object(orch.scaffolding_agent, "provide_scaffolding", return_value=SCAFFOLDING_DICT), \
         patch("agents.orchestrator.rag_service") as rag_mock:
        rag_mock.retrieve_context.return_value = []
        raw = orch.orchestrate(query="I'm totally lost", course="bio-inspired")

    assert raw["intent"] == "help"
    assert raw["scaffolding"] == SCAFFOLDING_DICT


def test_e2e_illustrate_intent():
    orch = _make_orchestrator()
    with patch.object(orch, "_classify_intent", return_value="illustrate"), \
         patch.object(orch.biology_agent, "analyze_biology", return_value=BIO_DICT), \
         patch.object(orch.engineering_agent, "analyze_engineering", return_value=ENG_DICT_V1), \
         patch.object(orch.illustration_agent, "design_illustration", return_value=ILLUSTRATION_DICT), \
         patch("agents.orchestrator.rag_service") as rag_mock:
        rag_mock.retrieve_context.return_value = []
        raw = orch.orchestrate(query="Draw the gecko setae", course="bio-inspired")

    assert raw["intent"] == "illustrate"
    assert raw["illustration"] == ILLUSTRATION_DICT


def test_e2e_simulate_intent():
    orch = _make_orchestrator()
    with patch.object(orch, "_classify_intent", return_value="simulate"), \
         patch.object(orch.biology_agent, "analyze_biology", return_value=BIO_DICT), \
         patch.object(orch.engineering_agent, "analyze_engineering", return_value=ENG_DICT_V1), \
         patch.object(orch.validation_agent, "validate_engineering_concept", return_value=VAL_PASS), \
         patch.object(orch.simulation_agent, "generate_interactive_simulation", return_value=SIMULATION_DICT), \
         patch("agents.orchestrator.rag_service") as rag_mock:
        rag_mock.retrieve_context.return_value = []
        raw = orch.orchestrate(query="Show me a van der Waals simulation", course="bio-inspired")

    assert raw["intent"] == "simulate"
    assert raw["simulation"] == SIMULATION_DICT


PRACTICE_DICT = {
    "stem": "Which option best represents the centripetal acceleration on a curved path at constant speed?",
    "options": [
        {"text": "Zero, because speed is constant.", "is_correct": False, "misconception_id": "constant_speed_zero_a"},
        {"text": "v^2/r toward the center of curvature.", "is_correct": True},
        {"text": "v/r along the path.", "is_correct": False, "misconception_id": "wrong_units"},
        {"text": "Equal to gravity.", "is_correct": False, "misconception_id": "g_assumption"},
    ],
    "concept_id": "centripetal_acceleration",
    "bloom_level": "apply",
    "explanation": "On a curve at constant speed, tangential a is zero but normal a = v^2/r is non-zero.",
    "rationale_for_choice": "Distractors target the three most common misconceptions seen in PracticeBlock telemetry.",
}

EXPLANATION_DICT = {
    "explanation": "Centripetal acceleration points toward the center of the curve and equals v squared over r. Constant speed only means tangential a is zero; it does not mean total a is zero.",
    "key_terms": ["centripetal", "tangential", "radius of curvature"],
    "addresses_misconception": "constant_speed_zero_a",
}

CRITIQUE_PASS_DICT = {"passes": True, "score": 8, "issues": [], "suggested_revisions": []}
CRITIQUE_FAIL_DICT = {"passes": False, "score": 4, "issues": ["distractor B contradicts source"], "suggested_revisions": ["replace distractor B"]}


def test_e2e_practice_generation_agent_smoke():
    orch = _make_orchestrator()
    with patch.object(orch.practice_generation_agent, "generate_item", return_value=PRACTICE_DICT):
        result = orch.practice_generation_agent.generate_item(
            section_content="...",
            concept_id="centripetal_acceleration",
            learner_state={"dominant_misconception": "constant_speed_zero_a"},
            bloom_level="apply",
        )
    assert result["concept_id"] == "centripetal_acceleration"
    assert any(opt["is_correct"] for opt in result["options"])
    assert any(not opt["is_correct"] for opt in result["options"])


def test_e2e_explanation_agent_smoke():
    orch = _make_orchestrator()
    with patch.object(orch.explanation_agent, "explain", return_value=EXPLANATION_DICT):
        result = orch.explanation_agent.explain(
            concept_id="centripetal_acceleration",
            section_content="...",
            learner_state={"dominant_misconception": "constant_speed_zero_a"},
            target_length="short",
        )
    assert "centripetal" in result["explanation"].lower()
    assert result["addresses_misconception"] == "constant_speed_zero_a"


def test_e2e_critique_agent_pass_and_fail():
    orch = _make_orchestrator()
    with patch.object(orch.critique_agent, "review", return_value=CRITIQUE_PASS_DICT):
        passed = orch.critique_agent.review("PracticeGenerationAgent", PRACTICE_DICT, ground_truth_excerpts=[])
    assert passed["passes"] is True
    assert passed["score"] >= 7

    with patch.object(orch.critique_agent, "review", return_value=CRITIQUE_FAIL_DICT):
        failed = orch.critique_agent.review("PracticeGenerationAgent", PRACTICE_DICT, ground_truth_excerpts=[])
    assert failed["passes"] is False
    assert len(failed["issues"]) >= 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
