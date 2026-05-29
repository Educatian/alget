"""Import-light unit tests for per-course de-personalization of the support agents.

These tests exercise ONLY the prompt builders, which are pure string functions
independent of any LLM client. No network, no Supabase, no google-genai needed:
ScaffoldingAgent / EvaluatorAgent are constructed with api_key="" so self.client
stays None, and we call the _build_*_prompt helpers directly.

The thesis under test: support must read as a course-appropriate policy, not a
single mascot persona. Biomimicry / Benyus framing is retained ONLY for the
bio-inspired course; other courses get a domain-appropriate Socratic framing.
"""
import os
import sys

# Make backend.agents importable regardless of pytest rootdir, without dragging
# in server / supabase imports.
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from agents.scaffolding_agent import ScaffoldingAgent  # noqa: E402
from agents.evaluator_agent import EvaluatorAgent  # noqa: E402


def _scaffolding_prompt(course, **kwargs):
    agent = ScaffoldingAgent(api_key="")  # client stays None, no network
    return agent._build_scaffolding_prompt("I am stuck on this problem.", course=course, **kwargs)


def _evaluator_prompt(course, **kwargs):
    agent = EvaluatorAgent(api_key="")  # client stays None, no network
    return agent._build_evaluation_prompt("Here is my work.", "", course=course, **kwargs)


# --- Scaffolding: statics must NOT carry biomimicry framing -----------------

def test_scaffolding_statics_is_not_bio_inspired():
    prompt = _scaffolding_prompt("statics").lower()
    assert "bio-inspired" not in prompt
    assert "benyus" not in prompt
    assert "biomimicry" not in prompt
    # References the statics domain and its reasoning.
    assert "statics" in prompt
    assert "equilibrium" in prompt or "free-body" in prompt


def test_scaffolding_bio_inspired_keeps_biomimicry_framing():
    prompt = _scaffolding_prompt("bio-inspired").lower()
    assert "bio-inspired" in prompt
    assert "biological" in prompt


def test_scaffolding_keeps_socratic_constraint_domain_agnostic():
    # The "never give the direct answer" constraint must hold across courses.
    for course in ("statics", "dynamics", "inst-design", "ai-ethics", "bio-inspired"):
        prompt = _scaffolding_prompt(course).lower()
        assert "do not give them the direct answer" in prompt


def test_scaffolding_threads_concepts_and_objective():
    prompt = _scaffolding_prompt(
        "dynamics",
        concept_ids=["kinematics-1"],
        learning_objective="Apply Newton's second law to a sliding block.",
    )
    assert "kinematics-1" in prompt
    assert "Newton's second law" in prompt


def test_scaffolding_unknown_course_does_not_default_to_biomimicry():
    prompt = _scaffolding_prompt("some-new-course").lower()
    assert "biomimicry" not in prompt
    assert "benyus" not in prompt


# --- Evaluator: statics must NOT be scored as biomimicry --------------------

def test_evaluator_statics_is_not_benyus():
    prompt = _evaluator_prompt("statics").lower()
    assert "bio-inspired" not in prompt
    assert "benyus" not in prompt
    assert "biomimicry" not in prompt
    assert "statics" in prompt
    assert "equilibrium" in prompt or "free-body" in prompt


def test_evaluator_bio_inspired_keeps_benyus_rubric():
    prompt = _evaluator_prompt("bio-inspired")
    assert "Benyus" in prompt
    assert "Biomimicry" in prompt
    # The classic biomimicry tenets and closing question survive.
    assert "Nature as Model" in prompt


def test_evaluator_per_course_personas_are_distinct():
    statics = _evaluator_prompt("statics")
    ethics = _evaluator_prompt("ai-ethics")
    inst = _evaluator_prompt("inst-design")
    assert statics != ethics != inst
    assert "ethics" in ethics.lower()
    assert "objective" in inst.lower() or "alignment" in inst.lower()


def test_evaluator_keeps_socratic_no_direct_answer():
    for course in ("statics", "ai-ethics", "inst-design", "bio-inspired"):
        prompt = _evaluator_prompt(course).lower()
        assert "never give the direct answer" in prompt
