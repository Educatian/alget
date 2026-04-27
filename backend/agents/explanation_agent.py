# backend/agents/explanation_agent.py
"""ExplanationAgent — short, plain-language re-expression of a concept.

Used by the rail's *Explain* tab. Distinct from TutorAgent.synthesize, which
produces a cohesive narrative wrap; this agent's job is just-in-time clarity
in 2-4 sentences. Cooler temperature than the Tutor (precision over voice).
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
from .schema_gate import EXPLANATION_FALLBACK, ExplanationOutput, gate

logger = logging.getLogger(__name__)


class ExplanationAgent:
    """Generate a short, misconception-aware explanation."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        if GENAI_AVAILABLE and api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None

    def explain(
        self,
        concept_id: str,
        section_content: str,
        learner_state: dict = None,
        target_length: str = "short",
        history: list = None,
    ) -> dict:
        if not self.client:
            return {**EXPLANATION_FALLBACK, "_schema_error": "no_client"}

        learner_state = learner_state or {}
        prompt = self._build_prompt(concept_id, section_content, learner_state, target_length, history)

        try:
            cfg = get_config("explanation")
            response = self.client.models.generate_content(
                model=cfg.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=cfg.temperature,
                    response_mime_type="application/json",
                    response_schema={
                        "type": "OBJECT",
                        "properties": {
                            "explanation": {"type": "STRING"},
                            "key_terms": {
                                "type": "ARRAY",
                                "items": {"type": "STRING"},
                            },
                            "addresses_misconception": {"type": "STRING"},
                        },
                        "required": ["explanation"],
                    },
                ),
            )

            try:
                result = json.loads(response.text)
            except json.JSONDecodeError:
                return {**EXPLANATION_FALLBACK, "_schema_error": "json_decode", "raw_response": response.text}

            return gate(result, ExplanationOutput, EXPLANATION_FALLBACK, "ExplanationAgent")

        except Exception as exc:
            logger.exception("ExplanationAgent failed")
            return {**EXPLANATION_FALLBACK, "_schema_error": "exception", "error": str(exc)}

    def _build_prompt(self, concept_id, section_content, learner_state, target_length, history):
        history_text = ""
        if history:
            for msg in history[-4:]:
                role = "Student" if msg.get("role") == "user" else "Tutor"
                history_text += f"{role}: {msg.get('content', '')}\n"

        target_words = {"short": 60, "medium": 120, "long": 200}.get(target_length, 60)
        dominant_misconception = learner_state.get("dominant_misconception") or ""

        return f"""
You are an instructional explainer. Produce ONE short, plain-language
explanation of concept '{concept_id}' for a learner who is currently stuck.

Source material excerpt (must not be contradicted):
---
{(section_content or '')[:3500]}
---

Recent dialogue:
{history_text or "None"}

Constraints:
- Target length: about {target_words} words. Cut, don't extend.
- Plain language. Define any technical term you use in the same sentence.
- If the learner has a dominant misconception ('{dominant_misconception or "none"}'),
  open with the corrective and set `addresses_misconception` to that misconception
  id. Otherwise leave `addresses_misconception` empty.
- Do not repeat the textbook narrative verbatim. Re-express; that is the value.
- Do not give away an answer to a practice problem; this is concept explanation,
  not problem solution.
- Populate `key_terms` with 1-4 technical terms used in your explanation;
  the UI will render them as glossary-linkable tokens.

Output strictly valid JSON.
"""
