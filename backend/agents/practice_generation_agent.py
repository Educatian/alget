# backend/agents/practice_generation_agent.py
"""PracticeGenerationAgent — generates a single targeted practice item per learner gap.

Reads the section's content, the learner's mastery snapshot, and the dominant
misconception, then composes a multiple-choice item whose distractors map to
specific misconceptions. Distinct from AssessmentAgent (which generates whole
practice forms) — this agent serves the rail's *Practice* tab in real time.
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
from .schema_gate import PRACTICE_FALLBACK, PracticeOutput, gate

logger = logging.getLogger(__name__)


class PracticeGenerationAgent:
    """Generate a single misconception-targeted practice item on demand."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        if GENAI_AVAILABLE and api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None

    def generate_item(
        self,
        section_content: str,
        concept_id: str,
        learner_state: dict = None,
        bloom_level: str = "apply",
        history: list = None,
    ) -> dict:
        if not self.client:
            return {**PRACTICE_FALLBACK, "_schema_error": "no_client", "concept_id": concept_id}

        learner_state = learner_state or {}
        prompt = self._build_prompt(section_content, concept_id, learner_state, bloom_level, history)

        try:
            cfg = get_config("practice_generation")
            response = self.client.models.generate_content(
                model=cfg.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=cfg.temperature,
                    response_mime_type="application/json",
                    response_schema={
                        "type": "OBJECT",
                        "properties": {
                            "stem": {"type": "STRING"},
                            "options": {
                                "type": "ARRAY",
                                "items": {
                                    "type": "OBJECT",
                                    "properties": {
                                        "text": {"type": "STRING"},
                                        "is_correct": {"type": "BOOLEAN"},
                                        "misconception_id": {"type": "STRING"},
                                    },
                                    "required": ["text", "is_correct"],
                                },
                            },
                            "concept_id": {"type": "STRING"},
                            "bloom_level": {"type": "STRING"},
                            "explanation": {"type": "STRING"},
                            "rationale_for_choice": {"type": "STRING"},
                        },
                        "required": ["stem", "options", "concept_id", "bloom_level", "explanation"],
                    },
                ),
            )

            try:
                result = json.loads(response.text)
            except json.JSONDecodeError:
                return {**PRACTICE_FALLBACK, "_schema_error": "json_decode", "raw_response": response.text}

            return gate(result, PracticeOutput, PRACTICE_FALLBACK, "PracticeGenerationAgent")

        except Exception as exc:
            logger.exception("PracticeGenerationAgent failed")
            return {**PRACTICE_FALLBACK, "_schema_error": "exception", "error": str(exc)}

    def _build_prompt(self, section_content, concept_id, learner_state, bloom_level, history):
        history_text = ""
        if history:
            for msg in history[-4:]:
                role = "Student" if msg.get("role") == "user" else "Tutor"
                history_text += f"{role}: {msg.get('content', '')}\n"

        dominant_misconception = learner_state.get("dominant_misconception") or "none"
        forgetting_risk = learner_state.get("forgetting_risk") or 0.5
        calibration_drift = learner_state.get("calibration_drift") or 0
        critique_notes = learner_state.get("critique_notes") or []

        critique_block = ""
        if critique_notes:
            joined = "\n".join(f"  - {note}" for note in critique_notes if note)
            critique_block = (
                "\nA prior attempt was reviewed and rejected. Address these "
                "specific issues in the new item:\n" + joined + "\n"
            )

        return f"""
You are a precise instructional item-writer. Generate ONE multiple-choice
practice problem targeting concept '{concept_id}' at Bloom level '{bloom_level}'.

Source material excerpt (RAG-grounded; do not contradict it):
---
{(section_content or '')[:4000]}
---

Learner state:
- dominant misconception currently observed: {dominant_misconception}
- forgetting risk: {forgetting_risk}
- calibration drift: {calibration_drift}
{critique_block}
Recent dialogue:
{history_text or "None"}

Rules:
1. Write ONE stem that operates at the named Bloom level. If the level is
   'apply' or above, the stem must require doing something with the concept,
   not recalling its definition.
2. Provide exactly 4 options. Exactly one is correct.
3. Each incorrect option must map to a plausible misconception. Set the
   `misconception_id` field on each incorrect option to a short snake_case
   token (for example: 'confused_with_velocity', 'ignored_units',
   'reversed_sign'). The correct option's misconception_id may be omitted.
4. If the dominant misconception above is non-empty and relevant, make sure
   AT LEAST ONE distractor exercises exactly that misconception.
5. The `explanation` field appears to the learner after they answer; explain
   why the correct option is correct and briefly why each distractor is wrong.
6. The `rationale_for_choice` field is for the system; explain in 1 sentence
   why these distractors target this learner's state.

Output strictly valid JSON matching the response schema.
"""
