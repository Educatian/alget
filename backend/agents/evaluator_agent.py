# backend/agents/evaluator_agent.py
import json

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


import logging

from .config import get as get_config
from .schema_gate import EVALUATOR_FALLBACK, EvaluatorOutput, gate

logger = logging.getLogger(__name__)


# Per-course evaluation rubric/persona. Biomimicry (the Janine Benyus framing)
# is kept ONLY for the bio-inspired course; every other course is scored against
# a domain-appropriate rubric so the evaluator reads as a discipline policy
# rather than a single mascot persona. "persona" names the disciplinary voice
# the overall feedback is written in; "tenets" are the named criteria the work
# product is judged against; "score_bands" describes what each band means;
# "closing_question" models the kind of forward-pushing question to end on.
EVALUATOR_RUBRIC_MAP = {
    "bio-inspired": {
        "persona": "Janine Benyus, the pioneer of Biomimicry",
        "work_product": "bio-inspired design proposal",
        "tenets": (
            "1. Nature as Model: Does the design deeply emulate nature's forms, processes, or ecosystems, or is it just superficially copying a shape?\n"
            "2. Nature as Measure: Does the design use an ecological standard to judge sustainability? Will it create toxic waste, or does it follow \"Life's Principles\" (e.g., life creates conditions conducive to life, uses life-friendly chemistry)?\n"
            "3. Nature as Mentor: Is the design based on a respectful, accurate understanding of biological insights?"
        ),
        "score_bands": (
            "- 1-3: Superficial mimicry, fundamentally unsustainable, or biologically inaccurate.\n"
            "- 4-6: Good concept but lacks depth in either mechanism translation or sustainability.\n"
            "- 7-8: Strong functional mimicry and sustainable approach.\n"
            "- 9-10: Masterful translation of biological mechanism into a regenerative, deeply sustainable engineering design."
        ),
        "warning": "Do not accept superficial \"greenwashing\".",
        "closing_question": "How would nature handle the end-of-life for this product?",
    },
    "statics": {
        "persona": "a rigorous engineering statics instructor",
        "work_product": "statics analysis or design",
        "tenets": (
            "1. Free-body diagram: Are all forces, reactions, and moments correctly identified and isolated?\n"
            "2. Equilibrium: Does the solution correctly apply the equilibrium equations (sum of forces and moments equals zero)?\n"
            "3. Assumptions and units: Are supports, connections, and units modeled consistently and justified?"
        ),
        "score_bands": (
            "- 1-3: Misidentified forces or violated equilibrium; the analysis would not hold.\n"
            "- 4-6: Reasonable setup but with gaps in the free-body diagram or unjustified assumptions.\n"
            "- 7-8: Sound equilibrium reasoning with minor modeling refinements needed.\n"
            "- 9-10: Rigorous, fully justified equilibrium analysis with clean assumptions and units."
        ),
        "warning": "Do not accept hand-waving over a missing free-body diagram or an unbalanced system.",
        "closing_question": "What would happen to your equilibrium equations if one support were removed?",
    },
    "dynamics": {
        "persona": "a rigorous engineering dynamics instructor",
        "work_product": "dynamics analysis or design",
        "tenets": (
            "1. Kinematics: Are position, velocity, and acceleration relationships modeled correctly?\n"
            "2. Kinetics: Does the work correctly apply Newton's laws or energy/momentum methods to the motion?\n"
            "3. Assumptions and units: Are frames of reference, constraints, and units consistent and justified?"
        ),
        "score_bands": (
            "- 1-3: Incorrect kinematic relationships or misapplied laws of motion.\n"
            "- 4-6: Reasonable approach but with gaps in the kinetics or unjustified assumptions.\n"
            "- 7-8: Sound dynamic reasoning with minor refinements needed.\n"
            "- 9-10: Rigorous, fully justified dynamic analysis with the right method for the problem."
        ),
        "warning": "Do not accept a result that ignores the chosen frame of reference or constraints.",
        "closing_question": "Would an energy method or a momentum method give you the same answer more directly?",
    },
    "inst-design": {
        "persona": "an expert instructional designer",
        "work_product": "instructional design proposal",
        "tenets": (
            "1. Alignment: Are the learning objectives, assessments, and activities mutually aligned?\n"
            "2. Evidence base: Is the design grounded in established learning theory and instructional models?\n"
            "3. Learner fit: Does the design account for the learners, context, and constraints it serves?"
        ),
        "score_bands": (
            "- 1-3: Objectives, assessments, and activities are misaligned or ungrounded.\n"
            "- 4-6: Plausible design but with gaps in alignment or weak theoretical grounding.\n"
            "- 7-8: Well-aligned, evidence-informed design with minor refinements needed.\n"
            "- 9-10: Tightly aligned, theoretically grounded, learner-centered design."
        ),
        "warning": "Do not accept activities that are not traceable to a stated objective and assessment.",
        "closing_question": "How would you know, from the assessment evidence, that this objective was actually met?",
    },
    "ai-ethics": {
        "persona": "an expert in AI ethics and responsible deployment",
        "work_product": "AI ethics analysis or proposal",
        "tenets": (
            "1. Stakeholders and impact: Are affected parties and potential harms identified across the lifecycle?\n"
            "2. Tradeoffs: Are fairness, accountability, transparency, and privacy tradeoffs reasoned through rather than asserted?\n"
            "3. Governance: Is there a concrete, accountable mechanism for oversight, recourse, and mitigation?"
        ),
        "score_bands": (
            "- 1-3: Ignores key stakeholders or treats serious harms as solved by good intentions.\n"
            "- 4-6: Identifies concerns but reasons about tradeoffs only superficially.\n"
            "- 7-8: Thoughtful stakeholder and tradeoff analysis with minor gaps in governance.\n"
            "- 9-10: Rigorous, accountable analysis with concrete mitigation and oversight mechanisms."
        ),
        "warning": "Do not accept ethics-washing that names principles without mechanisms.",
        "closing_question": "Who is accountable, and what is the recourse, when this system causes harm?",
    },
    "ail606-supplement": {
        "persona": "an expert in educational software technology",
        "work_product": "technology integration plan",
        "tenets": (
            "1. Tool fit: Is the chosen technology justified for the task and the educators who use it?\n"
            "2. Workflow: Does the plan integrate cleanly into a realistic teaching or production workflow?\n"
            "3. Tradeoffs: Are cost, accessibility, and maintenance tradeoffs reasoned through?"
        ),
        "score_bands": (
            "- 1-3: Tool choice is unjustified or ignores the actual workflow.\n"
            "- 4-6: Plausible choice but with gaps in workflow fit or tradeoff reasoning.\n"
            "- 7-8: Well-justified integration with minor refinements needed.\n"
            "- 9-10: Strongly justified, workflow-aware integration with clear tradeoff reasoning."
        ),
        "warning": "Do not accept a tool choice made for novelty rather than fit.",
        "closing_question": "What is the simplest tool that would still meet this need, and why not use it?",
    },
    "cat531-supplement": {
        "persona": "an expert in technology integration for teaching",
        "work_product": "technology-and-teaching plan",
        "tenets": (
            "1. Pedagogical fit: Does the technology serve a clear learning purpose rather than decorate the lesson?\n"
            "2. Classroom integration: Is the plan realistic for the classroom and learners it targets?\n"
            "3. Equity and access: Are accessibility and equitable access addressed?"
        ),
        "score_bands": (
            "- 1-3: Technology is decorative or disconnected from learning.\n"
            "- 4-6: Plausible use but with gaps in pedagogical fit or feasibility.\n"
            "- 7-8: Well-integrated, learner-centered use with minor refinements needed.\n"
            "- 9-10: Strongly justified, equitable, learner-centered integration."
        ),
        "warning": "Do not accept technology used for its own sake rather than for learning.",
        "closing_question": "What learning would be lost, and what gained, if you taught this without the technology?",
    },
    "cat100-supplement": {
        "persona": "an expert in computer concepts and digital literacy",
        "work_product": "applied computing work product",
        "tenets": (
            "1. Concept accuracy: Are the underlying computing concepts represented correctly?\n"
            "2. Application: Is the concept applied correctly to the practical task?\n"
            "3. Clarity: Is the reasoning communicated clearly enough for a peer to follow?"
        ),
        "score_bands": (
            "- 1-3: Core concepts are misunderstood or misapplied.\n"
            "- 4-6: Generally correct but with conceptual gaps or unclear application.\n"
            "- 7-8: Accurate and well-applied with minor clarity refinements needed.\n"
            "- 9-10: Accurate, well-applied, and clearly communicated."
        ),
        "warning": "Do not accept correct-looking output that rests on a misunderstood concept.",
        "closing_question": "Could you explain why this works to someone who has never seen it before?",
    },
}

# Domain-agnostic fallback for an unmapped course. Keeps the Socratic, rigorous
# stance without importing biomimicry framing.
_DEFAULT_EVALUATOR_RUBRIC = {
    "persona": "a rigorous, supportive domain expert",
    "work_product": "submission",
    "tenets": (
        "1. Accuracy: Are the core ideas represented correctly?\n"
        "2. Reasoning: Is the conclusion supported by sound, explicit reasoning?\n"
        "3. Justification: Are assumptions and choices justified rather than asserted?"
    ),
    "score_bands": (
        "- 1-3: Fundamentally inaccurate or unsupported.\n"
        "- 4-6: Reasonable but with notable gaps in reasoning or justification.\n"
        "- 7-8: Sound work with minor refinements needed.\n"
        "- 9-10: Rigorous, well-justified, and clearly reasoned."
    ),
    "warning": "Do not accept assertions that are not backed by reasoning.",
    "closing_question": "What is the weakest assumption in your reasoning, and how would you test it?",
}


def _resolve_evaluator_rubric(course: str) -> dict:
    if not course:
        return _DEFAULT_EVALUATOR_RUBRIC
    return EVALUATOR_RUBRIC_MAP.get(course, _DEFAULT_EVALUATOR_RUBRIC)


class EvaluatorAgent:
    """
    Evaluator Agent scores a student's work product against a per-course rubric
    and provides encouraging, intellectually rigorous feedback in the voice of
    that course's evaluating expert. The biomimicry (Janine Benyus) framing is
    used only for the bio-inspired course; other courses are evaluated against
    domain-appropriate criteria so the evaluator reads as a discipline policy
    rather than a single persona.
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        if GENAI_AVAILABLE and api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None

    def evaluate_design(
        self,
        student_design: str,
        biological_context: str = "",
        history: list = None,
        course: str = "bio-inspired",
        concept_ids: list = None,
        learning_objective: str = "",
    ) -> dict:
        """
        Evaluates a student's work product, handling context from history if provided.

        course / concept_ids / learning_objective are threaded from the
        recommendation engine so the evaluation rubric and persona match the
        active course rather than always applying the biomimicry framing. All
        have safe defaults so existing callers keep working unchanged.
        """
        if not self.client:
            return {
                "error": "Gemini API key is required.",
                "feedback": "API Key is missing. Cannot evaluate design."
            }

        logger.info(f"Evaluating student design...")

        prompt = self._build_evaluation_prompt(
            student_design, biological_context, history,
            course=course, concept_ids=concept_ids,
            learning_objective=learning_objective,
        )
        
        try:
            cfg = get_config("evaluator")
            response = self.client.models.generate_content(
                model=cfg.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=cfg.temperature,
                    response_mime_type="application/json",
                    response_schema={
                        "type": "OBJECT",
                        "properties": {
                            "strengths": {
                                "type": "ARRAY",
                                "items": {"type": "STRING"},
                                "description": "Key strengths of the student's design."
                            },
                            "areas_for_improvement": {
                                "type": "ARRAY",
                                "items": {"type": "STRING"},
                                "description": "Areas where the work could better satisfy the rubric for this course."
                            },
                            "janine_feedback": {
                                "type": "STRING",
                                "description": "Overall encouraging feedback written in the voice of the course's evaluating expert."
                            },
                            "score": {
                                "type": "INTEGER",
                                "description": "A score from 1 to 10 evaluating the work against this course's rubric."
                            }
                        },
                        "required": ["strengths", "areas_for_improvement", "janine_feedback", "score"]
                    }
                )
            )
            
            try:
                result_json = json.loads(response.text)
            except json.JSONDecodeError:
                return {**EVALUATOR_FALLBACK, "_schema_error": "json_decode", "raw_response": response.text}

            return gate(result_json, EvaluatorOutput, EVALUATOR_FALLBACK, "EvaluatorAgent")

        except Exception as e:
            logger.exception("Evaluator Agent failed")
            return {**EVALUATOR_FALLBACK, "_schema_error": "exception", "error": str(e)}
            
    def _build_evaluation_prompt(
        self,
        student_design: str,
        biological_context: str,
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

        rubric = _resolve_evaluator_rubric(course)

        concept_line = ""
        if concept_ids:
            concept_line = (
                f"\n        Target concepts for this evaluation: "
                f"{', '.join(str(c) for c in concept_ids)}."
            )
        objective_line = ""
        if learning_objective:
            objective_line = (
                f"\n        Learning objective being assessed: "
                f"\"{learning_objective}\"."
            )

        base_prompt = f"""
        You are {rubric['persona']}.
        You are evaluating a student's {rubric['work_product']}.
        Your goal is to be encouraging but intellectually rigorous. {rubric['warning']}{concept_line}{objective_line}

        Evaluate the work against these core criteria:
        {rubric['tenets']}

        Provide a strict Score (1-10):
        {rubric['score_bands']}

        Write your feedback directly speaking to the student in the voice of {rubric['persona']}. Highlight strengths, but heavily focus on areas for improvement to push their thinking further. Always ask a concluding question like "{rubric['closing_question']}". Never give the direct answer or solution; push the student to reach it through their own reasoning.

        Conversation History:
        {history_text if history_text else "None"}

        Student Submission:
        "{student_design}"
        """

        if biological_context:
            base_prompt += f"\n\nRelevant Context:\n\"{biological_context}\""

        return base_prompt
