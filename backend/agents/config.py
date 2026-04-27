"""Single source of truth for per-agent generation parameters.

Centralizing temperature, model id, and max_output_tokens here removes the
17-locations-of-magic-numbers problem and makes ablation experiments
(e.g. "what if validation runs at 0.1?") a one-line edit. Each agent
module should `from .config import AGENT_CONFIG` and read its own slot.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class GenerationConfig:
    model: str
    temperature: float
    max_output_tokens: int | None = None


# Default model for all agents. Override per-agent below if needed.
DEFAULT_MODEL = "gemini-2.0-flash"


AGENT_CONFIG: dict[str, GenerationConfig] = {
    # Domain experts: balanced creativity, factual accuracy.
    "biology": GenerationConfig(model=DEFAULT_MODEL, temperature=0.7),
    "engineering": GenerationConfig(model=DEFAULT_MODEL, temperature=0.7),
    "engineering_revise": GenerationConfig(model=DEFAULT_MODEL, temperature=0.7),

    # Validation runs cool: stricter, more analytical.
    "validation": GenerationConfig(model=DEFAULT_MODEL, temperature=0.3),

    # Synthesis: warm to keep voice human.
    "tutor_synthesize": GenerationConfig(model=DEFAULT_MODEL, temperature=0.7),
    "tutor_general": GenerationConfig(model=DEFAULT_MODEL, temperature=0.7),

    # Persona evaluator (Janine Benyus): supportive but rigorous.
    "evaluator": GenerationConfig(model=DEFAULT_MODEL, temperature=0.7),

    # Brainstorm/ideation: hottest.
    "activity": GenerationConfig(model=DEFAULT_MODEL, temperature=0.8),

    # Code generation: warm enough to vary visuals, cool enough to compile.
    "simulation": GenerationConfig(model=DEFAULT_MODEL, temperature=0.7, max_output_tokens=4096),
    "illustration": GenerationConfig(model=DEFAULT_MODEL, temperature=0.7),

    # Scaffolding (Socratic hints): warm for natural questions.
    "scaffolding": GenerationConfig(model=DEFAULT_MODEL, temperature=0.7),

    # Curriculum generation: structured, balanced.
    "curriculum": GenerationConfig(model=DEFAULT_MODEL, temperature=0.4),

    # Assessment generation: balanced.
    "assessment_generate": GenerationConfig(model=DEFAULT_MODEL, temperature=0.7),
    "assessment_grade": GenerationConfig(model=DEFAULT_MODEL, temperature=0.3),

    # Intent classification: deterministic.
    "intent_classifier": GenerationConfig(model=DEFAULT_MODEL, temperature=0.0),

    # Generative tier (next-iteration agents):
    # Practice generation needs creativity in distractors but precision in
    # the concept-target mapping. Mid temperature.
    "practice_generation": GenerationConfig(model=DEFAULT_MODEL, temperature=0.6),
    # Explanation runs cool: clarity over voice.
    "explanation": GenerationConfig(model=DEFAULT_MODEL, temperature=0.5),
    # Critique runs cool: analytical, low variance across reviews.
    "critique": GenerationConfig(model=DEFAULT_MODEL, temperature=0.3),
}


def get(slot: str) -> GenerationConfig:
    """Return the GenerationConfig for `slot`, raising KeyError if undefined.

    Using KeyError on miss is intentional: agents should fail loudly during
    development if they reference a slot the config does not know about.
    """
    return AGENT_CONFIG[slot]
