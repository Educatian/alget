# backend/agents/critique_agent.py
"""CritiqueAgent — general-purpose second-opinion review of any generative output.

ValidationAgent is specialized for biology↔engineering analogical fidelity inside
the bio-inspired debate loop. CritiqueAgent generalizes the second-opinion
pattern to any course and any artifact (practice item, explanation, simulation
description, illustration prompt). This is what makes the architecture
*systematically* defensible against single-LLM hallucination, not just
debate-loop-defensible.
"""
import json
import logging

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

from .config import get as get_config
from .schema_gate import CRITIQUE_FALLBACK, CritiqueOutput, gate

logger = logging.getLogger(__name__)


class CritiqueAgent:
    """Independent reviewer for generative outputs across courses."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        if GENAI_AVAILABLE and api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None

    def review(
        self,
        agent_name: str,
        output_payload: dict,
        ground_truth_excerpts: list = None,
        rubric: str = "",
    ) -> dict:
        if not self.client:
            return {**CRITIQUE_FALLBACK, "_schema_error": "no_client"}

        ground_truth_excerpts = ground_truth_excerpts or []
        prompt = self._build_prompt(agent_name, output_payload, ground_truth_excerpts, rubric)

        try:
            cfg = get_config("critique")
            response = self.client.models.generate_content(
                model=cfg.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=cfg.temperature,
                    response_mime_type="application/json",
                    response_schema={
                        "type": "OBJECT",
                        "properties": {
                            "passes": {"type": "BOOLEAN"},
                            "score": {"type": "INTEGER"},
                            "issues": {
                                "type": "ARRAY",
                                "items": {"type": "STRING"},
                            },
                            "suggested_revisions": {
                                "type": "ARRAY",
                                "items": {"type": "STRING"},
                            },
                        },
                        "required": ["passes", "score", "issues"],
                    },
                ),
            )

            try:
                result = json.loads(response.text)
            except json.JSONDecodeError:
                return {**CRITIQUE_FALLBACK, "_schema_error": "json_decode", "raw_response": response.text}

            return gate(result, CritiqueOutput, CRITIQUE_FALLBACK, "CritiqueAgent")

        except Exception as exc:
            logger.exception("CritiqueAgent failed")
            return {**CRITIQUE_FALLBACK, "_schema_error": "exception", "error": str(exc)}

    def _build_prompt(self, agent_name, output_payload, ground_truth_excerpts, rubric):
        truth_text = "\n".join(f"- {chunk}" for chunk in ground_truth_excerpts[:5])
        payload_text = json.dumps(output_payload, indent=2, default=str)[:6000]
        rubric_text = rubric or self._default_rubric(agent_name)

        return f"""
You are an independent reviewer for generative learning content. The agent
named '{agent_name}' produced the artifact below. Decide whether it should
reach the learner as-is, or whether it needs revision.

Ground-truth source excerpts (the artifact must be consistent with these;
contradicting them is a hard fail):
---
{truth_text or "(no source excerpts supplied)"}
---

Artifact under review:
---
{payload_text}
---

Rubric:
{rubric_text}

Reviewing rules:
1. Score 0-10. Score >= 7 means `passes: true`.
2. List concrete issues, not vague ones. Each issue should name the field it
   is in (e.g., "options[2].text introduces a unit not present in the source").
3. Suggested revisions should be actionable: 1-2 sentences each, addressed to
   the upstream agent.
4. Hard-fail any artifact that contradicts the source, fabricates a citation,
   or pretends to a level of certainty the source does not support.
5. Pedagogical level matters: a stem labeled 'apply' that only requires recall
   should be flagged.

Output strictly valid JSON.
"""

    def _default_rubric(self, agent_name):
        # Sensible defaults per upstream agent. A caller can override with a
        # custom rubric string when the artifact has unusual constraints.
        if agent_name == "PracticeGenerationAgent":
            return (
                "Factual fidelity to source; correct option is unambiguously correct; "
                "distractors are plausible and misconception-targeted; bloom_level "
                "matches stem cognitive demand; explanation justifies all options."
            )
        if agent_name == "ExplanationAgent":
            return (
                "Plain-language clarity; faithful to source; appropriate target length; "
                "addresses the named misconception when one is provided; does not give "
                "away practice answers; key_terms are real technical terms used."
            )
        if agent_name == "BiologyAgent":
            return "Biological fidelity; named organisms are real; mechanism is correctly described."
        if agent_name == "EngineeringAgent":
            return "Engineering principle is correctly named; proposed solution is feasible; challenges are real."
        return "Factual fidelity, level-appropriateness, alignment to source."
