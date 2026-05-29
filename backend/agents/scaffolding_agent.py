import json
import logging

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

from .config import get as get_config
from .schema_gate import SCAFFOLDING_FALLBACK, ScaffoldingOutput, gate

logger = logging.getLogger(__name__)


# Per-course Socratic framing. Each entry names the domain the tutor operates
# in and the kind of reasoning its guiding questions should stay anchored to.
# Biomimicry is kept ONLY for the bio-inspired course; every other course gets a
# domain-appropriate framing so support reads as a policy, not a single mascot
# persona. The Socratic "never give the direct answer" constraint is held
# constant across all courses (it is appended outside this map).
SCAFFOLDING_PERSONA_MAP = {
    "bio-inspired": {
        "domain": "bio-inspired design",
        "reasoning_focus": "biological mechanisms or engineering principles",
    },
    "statics": {
        "domain": "engineering statics",
        "reasoning_focus": "free-body diagrams, equilibrium conditions, and force/moment balance",
    },
    "dynamics": {
        "domain": "engineering dynamics",
        "reasoning_focus": "kinematics, Newton's laws, and energy or momentum methods",
    },
    "inst-design": {
        "domain": "instructional design",
        "reasoning_focus": "learning objectives, alignment, and evidence-based design models",
    },
    "ai-ethics": {
        "domain": "AI ethics",
        "reasoning_focus": "stakeholder impact, fairness and accountability tradeoffs, and governance reasoning",
    },
    "ail606-supplement": {
        "domain": "software technology for educators",
        "reasoning_focus": "tool selection, workflow design, and technology integration tradeoffs",
    },
    "cat531-supplement": {
        "domain": "technology and teaching",
        "reasoning_focus": "pedagogical fit, classroom integration, and learner-centered technology choices",
    },
    "cat100-supplement": {
        "domain": "computer concepts and applications",
        "reasoning_focus": "core computing concepts and applied digital-literacy reasoning",
    },
}

# Fallback used when a course has no explicit entry. Stays domain-agnostic so an
# unknown course still gets a coherent Socratic framing instead of biomimicry.
_DEFAULT_SCAFFOLDING_PERSONA = {
    "domain": "this subject",
    "reasoning_focus": "the underlying concepts and the reasoning that connects them",
}


def _resolve_scaffolding_persona(course: str) -> dict:
    if not course:
        return _DEFAULT_SCAFFOLDING_PERSONA
    return SCAFFOLDING_PERSONA_MAP.get(course, _DEFAULT_SCAFFOLDING_PERSONA)


class ScaffoldingAgent:
    """
    Scaffolding Agent acts as a Socratic tutor. When a student is stuck or 
    expresses confusion, it analyzes the history and current roadblock, 
    and provides guiding questions (instead of direct answers) to help 
    the student arrive at the conclusion themselves.
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        if GENAI_AVAILABLE and api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None

    def provide_scaffolding(
        self,
        query: str,
        history: list = None,
        course: str = "bio-inspired",
        concept_ids: list = None,
        learning_objective: str = "",
    ) -> dict:
        """
        Analyzes a student's roadblock and provides Socratic guiding questions.

        course / concept_ids / learning_objective are threaded from the
        recommendation engine so the Socratic framing matches the active course
        and target concepts. All have safe defaults so callers that omit them
        keep working (no regression when these signals are absent).
        """
        if not self.client:
            return {
                "error": "Gemini API key is required.",
                "scaffolding": "API Key is missing. Cannot provide scaffolding."
            }

        print(f"[ScaffoldingAgent] Generating Socratic guidance for roadblock...")

        prompt = self._build_scaffolding_prompt(
            query, history, course=course, concept_ids=concept_ids,
            learning_objective=learning_objective,
        )
        
        try:
            cfg = get_config("scaffolding")
            response = self.client.models.generate_content(
                model=cfg.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=cfg.temperature,
                    response_mime_type="application/json",
                    response_schema={
                        "type": "OBJECT",
                        "properties": {
                            "misconception_identified": {
                                "type": "STRING",
                                "description": "What is the student confused about or missing?"
                            },
                            "encouraging_remark": {
                                "type": "STRING",
                                "description": "A brief, encouraging response acknowledging their struggle as part of the normal learning process."
                            },
                            "guiding_questions": {
                                "type": "ARRAY",
                                "items": {"type": "STRING"},
                                "description": "1 to 3 Socratic questions that guide the student toward the answer without giving it away."
                            }
                        },
                        "required": ["misconception_identified", "encouraging_remark", "guiding_questions"]
                    }
                )
            )
            
            try:
                result_json = json.loads(response.text)
            except json.JSONDecodeError:
                return {**SCAFFOLDING_FALLBACK, "_schema_error": "json_decode", "raw_response": response.text}

            return gate(result_json, ScaffoldingOutput, SCAFFOLDING_FALLBACK, "ScaffoldingAgent")

        except Exception as e:
            logger.exception("Scaffolding Agent failed")
            return {**SCAFFOLDING_FALLBACK, "_schema_error": "exception", "error": str(e)}
            
    def _build_scaffolding_prompt(
        self,
        query: str,
        history: list = None,
        course: str = "bio-inspired",
        concept_ids: list = None,
        learning_objective: str = "",
    ) -> str:
        history_text = ""
        if history:
            for msg in history:
                role = "Student" if msg.get("role") == "user" else "Assistant"
                history_text += f"{role}: {msg.get('content', '')}\n"

        persona = _resolve_scaffolding_persona(course)
        domain = persona["domain"]
        reasoning_focus = persona["reasoning_focus"]

        concept_line = ""
        if concept_ids:
            concept_line = (
                f"\n        The student is working on these target concepts: "
                f"{', '.join(str(c) for c in concept_ids)}."
            )
        objective_line = ""
        if learning_objective:
            objective_line = (
                f"\n        The learning objective for this moment is: "
                f"\"{learning_objective}\"."
            )

        return f"""
        You are an expert Socratic Tutor for a {domain} course.
        The student is stuck, confused, or explicitly asking for help/hints.

        YOUR MISSION: DO NOT give them the direct answer.
        Instead, analyze their struggle, identify what they are misunderstanding
        or missing, and formulate guiding questions to help them think it through themselves.
        Keep your questions focused on {reasoning_focus} depending on their context.{concept_line}{objective_line}

        Conversation History (to understand what they already know):
        {history_text if history_text else "None"}

        Current Student Statement/Question (Roadblock):
        "{query}"
        """
