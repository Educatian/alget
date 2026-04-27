"""Pydantic-backed schema gate for agent responses.

Each agent calls Gemini with a `response_schema` that is enforced at the model
level, but bad clients, retried calls, or proxy edge-cases can still produce
malformed payloads. This module re-validates the parsed JSON against an
authoritative Pydantic model and returns a deterministic fallback when the
shape is wrong, so the orchestrator and downstream normalizers never see
unexpected types.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Type

from pydantic import BaseModel, Field, ValidationError, conint

logger = logging.getLogger(__name__)


class BiologyOutput(BaseModel):
    primary_mechanism: str
    explanation: str
    organism_examples: List[str] = Field(default_factory=list)
    key_terms: List[str] = Field(default_factory=list)


class EngineeringOutput(BaseModel):
    engineering_principle: str
    application_areas: List[str] = Field(default_factory=list)
    proposed_solution: str
    challenges: List[str] = Field(default_factory=list)


class ValidationOutput(BaseModel):
    is_valid: bool
    score: conint(ge=0, le=10)
    critique: str
    suggestions: List[str] = Field(default_factory=list)
    biological_fidelity: str = ""
    engineering_feasibility: str = ""


class TutorOutput(BaseModel):
    synthesis: str
    encouragement: str = ""
    next_steps: List[str] = Field(default_factory=list)


class EvaluatorOutput(BaseModel):
    strengths: List[str] = Field(default_factory=list)
    areas_for_improvement: List[str] = Field(default_factory=list)
    janine_feedback: str
    score: conint(ge=0, le=10)


class ActivityOutput(BaseModel):
    activity_title: str
    lateral_thinking_prompt: str = ""
    guiding_questions: List[str] = Field(default_factory=list)
    example_idea: str = ""


class SimulationOutput(BaseModel):
    description: str
    concepts_shown: List[str] = Field(default_factory=list)
    html_code: str


class IllustrationOutput(BaseModel):
    illustration_title: str
    conceptual_design: str
    image_prompt: str = ""
    ui_elements: List[str] = Field(default_factory=list)


class ScaffoldingOutput(BaseModel):
    misconception_identified: str = ""
    encouraging_remark: str = ""
    guiding_questions: List[str] = Field(default_factory=list)


class PracticeOption(BaseModel):
    text: str
    is_correct: bool = False
    misconception_id: Optional[str] = None


class PracticeOutput(BaseModel):
    stem: str
    options: List[PracticeOption] = Field(default_factory=list)
    concept_id: str
    bloom_level: str = "apply"
    explanation: str = ""
    rationale_for_choice: str = ""


class ExplanationOutput(BaseModel):
    explanation: str
    key_terms: List[str] = Field(default_factory=list)
    addresses_misconception: Optional[str] = None


class CritiqueOutput(BaseModel):
    passes: bool
    score: conint(ge=0, le=10)
    issues: List[str] = Field(default_factory=list)
    suggested_revisions: List[str] = Field(default_factory=list)


BIOLOGY_FALLBACK: Dict[str, Any] = {
    "primary_mechanism": "Unavailable",
    "explanation": "The biology agent did not return a valid response.",
    "organism_examples": [],
    "key_terms": [],
}

ENGINEERING_FALLBACK: Dict[str, Any] = {
    "engineering_principle": "Unavailable",
    "application_areas": [],
    "proposed_solution": "The engineering agent did not return a valid response.",
    "challenges": [],
}

VALIDATION_FALLBACK: Dict[str, Any] = {
    "is_valid": False,
    "score": 0,
    "critique": "Validation agent output failed schema validation; treat as unverified.",
    "suggestions": [],
    "biological_fidelity": "",
    "engineering_feasibility": "",
}

TUTOR_FALLBACK: Dict[str, Any] = {
    "synthesis": "The tutor agent did not return a valid response.",
    "encouragement": "",
    "next_steps": [],
}

EVALUATOR_FALLBACK: Dict[str, Any] = {
    "strengths": [],
    "areas_for_improvement": [],
    "janine_feedback": "Evaluator output failed schema validation.",
    "score": 0,
}

ACTIVITY_FALLBACK: Dict[str, Any] = {
    "activity_title": "Unavailable",
    "lateral_thinking_prompt": "",
    "guiding_questions": [],
    "example_idea": "",
}

SIMULATION_FALLBACK: Dict[str, Any] = {
    "description": "Simulation agent did not return a valid response.",
    "concepts_shown": [],
    "html_code": "",
}

ILLUSTRATION_FALLBACK: Dict[str, Any] = {
    "illustration_title": "Unavailable",
    "conceptual_design": "Illustration agent did not return a valid response.",
    "image_prompt": "",
    "ui_elements": [],
}

SCAFFOLDING_FALLBACK: Dict[str, Any] = {
    "misconception_identified": "",
    "encouraging_remark": "",
    "guiding_questions": [],
}

PRACTICE_FALLBACK: Dict[str, Any] = {
    "stem": "Practice generation unavailable; try again in a moment.",
    "options": [],
    "concept_id": "",
    "bloom_level": "apply",
    "explanation": "",
    "rationale_for_choice": "",
}

EXPLANATION_FALLBACK: Dict[str, Any] = {
    "explanation": "Explanation unavailable; the source material is in the section narrative above.",
    "key_terms": [],
    "addresses_misconception": None,
}

CRITIQUE_FALLBACK: Dict[str, Any] = {
    "passes": False,
    "score": 0,
    "issues": ["Critique agent unavailable; treat the upstream output as unreviewed."],
    "suggested_revisions": [],
}


def gate(parsed: Any, model_cls: Type[BaseModel], fallback: Dict[str, Any], agent_name: str) -> Dict[str, Any]:
    """Validate `parsed` against `model_cls`. On failure return a fallback dict
    annotated with `_schema_error` so callers can detect degraded responses."""
    if not isinstance(parsed, dict):
        logger.warning("[%s] schema gate received non-dict payload: %r", agent_name, type(parsed).__name__)
        return {**fallback, "_schema_error": "non_dict_payload"}

    try:
        validated = model_cls.model_validate(parsed)
        return validated.model_dump()
    except ValidationError as exc:
        logger.warning("[%s] schema gate validation failed: %s", agent_name, exc.errors())
        return {
            **fallback,
            "_schema_error": "validation_error",
            "_schema_error_detail": exc.errors(),
            "_raw": parsed,
        }
