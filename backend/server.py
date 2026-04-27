# backend/server.py - FastAPI Backend for UA Intelligent Textbook
"""
FastAPI server providing:
- Module and hooks data
- Gemini content generation (narrative, activity, simulation)
- Book content API (MDX sections)
- Grading API (solver-based)
- Assist API (Rail)
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import Any, List, Literal, Optional
import json
import sys
import os
import math

# Load .env file (do NOT override existing env vars — Render sets them at the OS level)
from dotenv import load_dotenv
load_dotenv()  # only fills in vars that are not already set

from google import genai
from google.genai import types as genai_types

# Load environment variable for API key
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
print(f"[INFO] GEMINI_API_KEY loaded: {'Yes' if GEMINI_API_KEY else 'No'}")

def get_api_key(request=None):
    """Get API key at request time: request body > env var > cached module var."""
    # 1. First, always prioritize the explicit key sent from the frontend request
    if request and hasattr(request, 'api_key') and getattr(request, 'api_key'):
        req_key = request.api_key.strip()
        if len(req_key) > 20:  # Valid keys are much longer than 20 chars
            print("[AUTH] Using API key from request payload")
            return req_key
            
    # 2. Next, try environment variables (but ignore dummy values like "NOT_FOUND")
    env_gemini = os.environ.get("GEMINI_API_KEY", "").strip()
    if env_gemini and len(env_gemini) > 20:
        print("[AUTH] Using API key from GEMINI_API_KEY env var")
        return env_gemini
        
    env_google = os.environ.get("GOOGLE_API_KEY", "").strip()
    if env_google and len(env_google) > 20:
        print("[AUTH] Using API key from GOOGLE_API_KEY env var")
        return env_google
        
    # 3. Fallback to module level variable
    if GEMINI_API_KEY and len(GEMINI_API_KEY) > 20:
        print("[AUTH] Using API key from cached module var")
        return GEMINI_API_KEY
        
    print("[AUTH WARNING] No valid API key found!")
    return None

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agents.orchestrator import OrchestratorAgent
from agents.curriculum_agent import CurriculumAgent
from logic_engine import generate_module_content
from module_hooks import (
    get_module_titles,
    get_hooks_for_module,
    get_module_info,
    BIO_INSPIRED_MODULES
)
from content_service import load_section, load_section_meta, generate_toc, get_fallback_toc
from grading_service import grade_problem
from rag_service import rag_service
from agents.assessment_agent import AssessmentAgent
from knowledge_tracing import BayesianKnowledgeTracing

@asynccontextmanager
async def app_lifespan(_app: FastAPI):
    """Initialize long-lived backend services on application startup."""
    print("[INFO] Application startup: Indexing Bio-Inspired curriculum for RAG...")
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    content_dir = os.path.join(base_dir, "frontend", "content", "bio-inspired")
    if os.path.exists(content_dir):
        rag_service.load_curriculum(content_dir)
    else:
        print(f"[ERROR] Curriculum directory not found: {content_dir}")
    yield


# Initialize FastAPI
app = FastAPI(
    title="UA Intelligent Textbook API",
    description="Backend for AI-powered engineering learning",
    version="2.0.0",
    lifespan=app_lifespan,
)

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "https://alget.vercel.app"
    ],
    allow_origin_regex="https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# DATA MODELS
# ============================================================================

class GenerateRequest(BaseModel):
    module: str
    keywords: List[str]
    grade_level: str = "Sophomore"
    interest: str = "Sports"
    api_key: str = ""

class OrchestrateRequest(BaseModel):
    query: str
    course: str = "bio-inspired"
    current_content: str = ""
    history: list = []
    is_highlight: bool = False
    grade_level: str = "Undergraduate"
    interest: str = "Bio-Inspired Design"
    api_key: str = ""

class ModuleInfo(BaseModel):
    icon: str
    title: str
    description: str
    hooks: List[str]

class GradeRequest(BaseModel):
    answer: str
    unit: str = ""

class ExplainRequest(BaseModel):
    section_id: str
    problem_id: Optional[str] = None
    stuck_reason: Optional[str] = None
    api_key: str = ""

class RepresentRequest(BaseModel):
    section_id: str
    representation_type: str  # mindmap, analogy, visual, formula
    api_key: str = ""

class ScenarioRequest(BaseModel):
    topic: str
    context: str
    course: str
    api_key: str = ""

class StuckEventRequest(BaseModel):
    user_id: str
    problem_id: Optional[str]
    section_id: Optional[str]
    reason: str
    timestamp: str


class AccessValidationRequest(BaseModel):
    scope: Literal["engineering", "education", "researcher"]
    passcode: str

class CurriculumGenerateRequest(BaseModel):
    biology_context: str
    engineering_application: str
    api_key: str = ""

class AssessmentRequest(BaseModel):
    section_title: str
    biology_context: str
    engineering_context: str
    learning_objectives: list[str] = []
    concept_ids: list[str] = []
    api_key: str = ""


class BiologyContextResponse(BaseModel):
    primary_mechanism: str = ""
    explanation: str = ""
    organism_examples: list[str] = []
    key_terms: list[str] = []
    error: Optional[str] = None
    raw_response: Optional[str] = None


class EngineeringApplicationResponse(BaseModel):
    engineering_principle: str = ""
    application_areas: list[str] = []
    proposed_solution: str = ""
    challenges: list[str] = []
    application_idea: str = ""
    feasibility_analysis: str = ""
    error: Optional[str] = None


class ValidationCritiqueResponse(BaseModel):
    is_valid: bool = False
    score: int = 0
    critique: str = ""
    suggestions: list[str] = []
    biological_fidelity: str = ""
    engineering_feasibility: str = ""
    error: Optional[str] = None


class TutorSummaryResponse(BaseModel):
    synthesis: str = ""
    encouragement: str = ""
    next_steps: list[str] = []
    key_takeaways: list[str] = []
    error: Optional[str] = None


class ActivityBrainstormResponse(BaseModel):
    activity_title: str = ""
    lateral_thinking_prompt: str = ""
    guiding_questions: list[str] = []
    example_idea: str = ""
    exercise_name: str = ""
    constraints: list[str] = []
    error: Optional[str] = None


class ScaffoldingResponse(BaseModel):
    misconception_identified: str = ""
    encouraging_remark: str = ""
    guiding_questions: list[str] = []
    error: Optional[str] = None


class EvaluationResponse(BaseModel):
    score: int = 0
    janine_feedback: str = ""
    strengths: list[str] = []
    areas_for_improvement: list[str] = []
    error: Optional[str] = None


class IllustrationResponse(BaseModel):
    illustration_title: str = ""
    conceptual_design: str = ""
    image_prompt: str = ""
    ui_elements: list[str] = []
    error: Optional[str] = None


class SimulationResponse(BaseModel):
    description: str = ""
    concepts_shown: list[str] = []
    html_code: str = ""
    error: Optional[str] = None


class OrchestratorResponse(BaseModel):
    intent: Literal["learn", "evaluate", "brainstorm", "illustrate", "simulate", "help", "error"]
    query: str = ""
    summary: TutorSummaryResponse | str = ""
    error: Optional[str] = None
    biology_context: Optional[BiologyContextResponse] = None
    engineering_application: Optional[EngineeringApplicationResponse] = None
    validation_critique: Optional[ValidationCritiqueResponse] = None
    activity_brainstorm: Optional[ActivityBrainstormResponse] = None
    scaffolding: Optional[ScaffoldingResponse] = None
    evaluation: Optional[EvaluationResponse] = None
    illustration: Optional[IllustrationResponse] = None
    simulation: Optional[SimulationResponse] = None
    iterations: int = 0


class AdaptiveMasteryState(BaseModel):
    concept_id: str
    p_known: float = 0.0
    mastery_score: Optional[float] = None
    attempts_count: int = 0
    correct_count: int = 0
    confidence_level: str = ""
    p_slip: float = 0.1
    p_transit: float = 0.1


class AdaptiveTelemetrySummary(BaseModel):
    hint_requests: int = 0
    stuck_events: int = 0
    consecutive_wrong: int = 0
    idle_events: int = 0
    practice_attempts: int = 0
    correct_attempts: int = 0
    chat_turns: int = 0
    affect_confused: int = 0
    affect_insight: int = 0
    affect_engaged: int = 0
    affect_disengaged: int = 0
    representation_requests: int = 0
    explain_requests: int = 0
    confidence_samples: int = 0
    confidence_total: float = 0.0
    confidence_average: float = 0.0
    misconception_counts: dict[str, int] = Field(default_factory=dict)
    intervention_accepts: int = 0
    intervention_declines: int = 0


class AdaptiveMisconceptionSignal(BaseModel):
    type: str
    count: int = 0


class AdaptiveLearnerProfile(BaseModel):
    average_confidence: float = 0.5
    confidence_samples: int = 0
    calibration_drift: float = 0.0
    forgetting_risk: float = 0.5
    transfer_readiness: float = 0.0
    predicted_next_correct: float = 0.0
    predicted_retention: float = 0.0
    stability_index: float = 0.0
    misconception_pressure: float = 0.0
    misconception_patterns: list[AdaptiveMisconceptionSignal] = Field(default_factory=list)
    recent_interventions: int = 0
    retrieval_gap_days: float = 0.0
    concept_states: list[dict[str, Any]] = Field(default_factory=list)
    mastery_snapshot: list[dict[str, Any]] = Field(default_factory=list)
    telemetry_snapshot: dict[str, Any] = Field(default_factory=dict)


class AdaptiveRecommendationRequest(BaseModel):
    section_id: str
    section_title: str = ""
    concept_ids: list[str] = Field(default_factory=list)
    current_heading: str = ""
    stuck_reason: Optional[str] = None
    mastery: list[AdaptiveMasteryState] = Field(default_factory=list)
    telemetry: AdaptiveTelemetrySummary = Field(default_factory=AdaptiveTelemetrySummary)
    learner_profile: AdaptiveLearnerProfile = Field(default_factory=AdaptiveLearnerProfile)


class LearnerStateSummary(BaseModel):
    average_mastery: float = 0.0
    lowest_mastery_concept: Optional[str] = None
    readiness: Literal["support", "practice", "advance"] = "support"
    frustration_index: int = 0
    confidence_signal: str = ""
    forgetting_risk: float = 0.0
    calibration_drift: float = 0.0
    transfer_readiness: float = 0.0
    dominant_misconception: Optional[str] = None


class AdaptiveRecommendationCard(BaseModel):
    action: Literal["explain", "represent", "practice", "advance", "ask"]
    title: str
    rationale: str
    evidence: list[str] = Field(default_factory=list)
    focus_concepts: list[str] = Field(default_factory=list)
    coach_prompt: str = ""


class AdaptiveRecommendationReasoning(BaseModel):
    confidence: float = 0.0
    policy_strategy: str = "heuristic_bandit_v2"
    reason_codes: list[str] = Field(default_factory=list)
    recommended_because: list[str] = Field(default_factory=list)
    not_recommended_because: list[str] = Field(default_factory=list)
    evidence_snapshot: dict[str, Any] = Field(default_factory=dict)
    action_scores: dict[str, float] = Field(default_factory=dict)
    predicted_outcomes: dict[str, dict[str, float]] = Field(default_factory=dict)


class PrerequisiteHint(BaseModel):
    concept_id: str
    suggested_section_slug: str
    reason: str


class AdaptiveRecommendationResponse(BaseModel):
    section_id: str
    learner_state: LearnerStateSummary
    primary_recommendation: AdaptiveRecommendationCard
    secondary_recommendations: list[AdaptiveRecommendationCard] = Field(default_factory=list)
    reasoning: AdaptiveRecommendationReasoning
    needs_prerequisite: Optional[PrerequisiteHint] = None


def _ensure_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _ensure_str_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [_ensure_str(item) for item in value if _ensure_str(item)]
    coerced = _ensure_str(value)
    return [coerced] if coerced else []


def _coerce_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        candidate = value.strip()
        if candidate.startswith("{") and candidate.endswith("}"):
            try:
                parsed = json.loads(candidate)
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                pass
    return {}


def _normalize_biology_context(value: Any) -> BiologyContextResponse:
    source = _coerce_dict(value)
    if source:
        return BiologyContextResponse(
            primary_mechanism=_ensure_str(source.get("primary_mechanism")),
            explanation=_ensure_str(source.get("explanation")),
            organism_examples=_ensure_str_list(source.get("organism_examples")),
            key_terms=_ensure_str_list(source.get("key_terms")),
            error=_ensure_str(source.get("error")) or None,
            raw_response=_ensure_str(source.get("raw_response")) or None,
        )

    fallback = _ensure_str(value)
    return BiologyContextResponse(explanation=fallback) if fallback else BiologyContextResponse()


def _normalize_engineering_application(value: Any) -> EngineeringApplicationResponse:
    source = _coerce_dict(value)
    principle = _ensure_str(source.get("engineering_principle") or source.get("application_idea"))
    proposed_solution = _ensure_str(source.get("proposed_solution") or source.get("feasibility_analysis"))
    application_idea = _ensure_str(source.get("application_idea")) or principle or proposed_solution
    feasibility_analysis = _ensure_str(source.get("feasibility_analysis")) or proposed_solution

    return EngineeringApplicationResponse(
        engineering_principle=principle,
        application_areas=_ensure_str_list(source.get("application_areas")),
        proposed_solution=proposed_solution,
        challenges=_ensure_str_list(source.get("challenges")),
        application_idea=application_idea,
        feasibility_analysis=feasibility_analysis,
        error=_ensure_str(source.get("error")) or None,
    )


def _normalize_validation_critique(value: Any) -> ValidationCritiqueResponse:
    source = _coerce_dict(value)
    return ValidationCritiqueResponse(
        is_valid=bool(source.get("is_valid", False)),
        score=int(source.get("score", 0) or 0),
        critique=_ensure_str(source.get("critique")),
        suggestions=_ensure_str_list(source.get("suggestions")),
        biological_fidelity=_ensure_str(source.get("biological_fidelity")),
        engineering_feasibility=_ensure_str(source.get("engineering_feasibility")),
        error=_ensure_str(source.get("error")) or None,
    )


def _normalize_tutor_summary(value: Any) -> TutorSummaryResponse | str:
    if isinstance(value, str):
        return _ensure_str(value)

    source = _coerce_dict(value)
    next_steps = _ensure_str_list(source.get("next_steps"))
    key_takeaways = _ensure_str_list(source.get("key_takeaways")) or next_steps
    return TutorSummaryResponse(
        synthesis=_ensure_str(source.get("synthesis")),
        encouragement=_ensure_str(source.get("encouragement")),
        next_steps=next_steps,
        key_takeaways=key_takeaways,
        error=_ensure_str(source.get("error")) or None,
    )


def _normalize_activity_brainstorm(value: Any) -> ActivityBrainstormResponse:
    source = _coerce_dict(value)
    guiding_questions = _ensure_str_list(source.get("guiding_questions") or source.get("constraints"))
    title = _ensure_str(source.get("activity_title") or source.get("exercise_name"))
    return ActivityBrainstormResponse(
        activity_title=title,
        lateral_thinking_prompt=_ensure_str(source.get("lateral_thinking_prompt")),
        guiding_questions=guiding_questions,
        example_idea=_ensure_str(source.get("example_idea")),
        exercise_name=title,
        constraints=guiding_questions,
        error=_ensure_str(source.get("error")) or None,
    )


def _normalize_scaffolding(value: Any) -> ScaffoldingResponse:
    source = _coerce_dict(value)
    if source:
        return ScaffoldingResponse(
            misconception_identified=_ensure_str(source.get("misconception_identified")),
            encouraging_remark=_ensure_str(source.get("encouraging_remark") or source.get("scaffolding")),
            guiding_questions=_ensure_str_list(source.get("guiding_questions")),
            error=_ensure_str(source.get("error")) or None,
        )

    fallback = _ensure_str(value)
    return ScaffoldingResponse(encouraging_remark=fallback) if fallback else ScaffoldingResponse()


def _normalize_evaluation(value: Any) -> EvaluationResponse:
    source = _coerce_dict(value)
    return EvaluationResponse(
        score=int(source.get("score", 0) or 0),
        janine_feedback=_ensure_str(source.get("janine_feedback")),
        strengths=_ensure_str_list(source.get("strengths")),
        areas_for_improvement=_ensure_str_list(source.get("areas_for_improvement")),
        error=_ensure_str(source.get("error")) or None,
    )


def _normalize_illustration(value: Any) -> IllustrationResponse:
    source = _coerce_dict(value)
    return IllustrationResponse(
        illustration_title=_ensure_str(source.get("illustration_title")),
        conceptual_design=_ensure_str(source.get("conceptual_design")),
        image_prompt=_ensure_str(source.get("image_prompt")),
        ui_elements=_ensure_str_list(source.get("ui_elements")),
        error=_ensure_str(source.get("error")) or None,
    )


def _normalize_simulation(value: Any) -> SimulationResponse:
    source = _coerce_dict(value)
    return SimulationResponse(
        description=_ensure_str(source.get("description")),
        concepts_shown=_ensure_str_list(source.get("concepts_shown")),
        html_code=_ensure_str(source.get("html_code")),
        error=_ensure_str(source.get("error")) or None,
    )


def normalize_orchestrator_response(value: dict[str, Any]) -> OrchestratorResponse:
    intent = _ensure_str(value.get("intent")).lower() or "error"
    if intent not in {"learn", "evaluate", "brainstorm", "illustrate", "simulate", "help", "error"}:
        intent = "error"

    response = OrchestratorResponse(
        intent=intent,
        query=_ensure_str(value.get("query")),
        summary=_normalize_tutor_summary(value.get("summary")),
        error=_ensure_str(value.get("error")) or None,
        iterations=int(value.get("iterations", 0) or 0),
    )

    if intent in {"learn", "brainstorm"}:
        response.biology_context = _normalize_biology_context(value.get("biology_context"))
    if intent == "learn":
        response.engineering_application = _normalize_engineering_application(value.get("engineering_application"))
        response.validation_critique = _normalize_validation_critique(value.get("validation_critique"))
        response.activity_brainstorm = _normalize_activity_brainstorm(value.get("activity_brainstorm"))
    elif intent == "brainstorm":
        response.activity_brainstorm = _normalize_activity_brainstorm(value.get("activity_brainstorm"))
    elif intent == "help":
        response.scaffolding = _normalize_scaffolding(value.get("scaffolding"))
    elif intent == "evaluate":
        response.evaluation = _normalize_evaluation(value.get("evaluation"))
    elif intent == "illustrate":
        response.illustration = _normalize_illustration(value.get("illustration"))
    elif intent == "simulate":
        response.simulation = _normalize_simulation(value.get("simulation"))

    if intent == "error" and not response.error:
        response.error = _ensure_str(value.get("summary")) or "Unknown orchestration error."

    return response


def _normalize_ratio(value: Any, fallback: float = 0.0) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return fallback
    return max(0.0, min(1.0, numeric))


def clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def _humanize_concept(concept_id: Optional[str]) -> str:
    if not concept_id:
        return "this concept"
    return concept_id.replace("_", " ")


def _build_recommendation_card(
    action: Literal["explain", "represent", "practice", "advance", "ask"],
    title: str,
    rationale: str,
    evidence: list[str],
    focus_concepts: list[str],
    coach_prompt: str = "",
) -> AdaptiveRecommendationCard:
    return AdaptiveRecommendationCard(
        action=action,
        title=title,
        rationale=rationale,
        evidence=[item for item in evidence if item][:4],
        focus_concepts=[item for item in focus_concepts if item][:3],
        coach_prompt=coach_prompt,
    )


def _normalize_signal(value: float, ceiling: float) -> float:
    if ceiling <= 0:
        return 0.0
    return clamp(value / ceiling, 0.0, 1.0)


def _top_misconception_pressure(patterns: list[AdaptiveMisconceptionSignal]) -> float:
    if not patterns:
        return 0.0
    top_count = max(pattern.count for pattern in patterns)
    return clamp(top_count / 4.0, 0.0, 1.0)


def _estimate_action_outcomes(
    action_scores: dict[str, float],
    average_mastery: float,
    correct_ratio: float,
    friction_signal: float,
    forgetting_risk: float,
    transfer_readiness: float,
) -> dict[str, dict[str, float]]:
    outcomes: dict[str, dict[str, float]] = {}
    for action, score in action_scores.items():
        success_rate = clamp(
            0.18
            + average_mastery * 0.24
            + correct_ratio * 0.12
            + score * 0.34
            - friction_signal * 0.11
            - forgetting_risk * 0.06,
            0.05,
            0.97,
        )
        retention_lift = clamp(
            0.1
            + score * 0.28
            + (1 - forgetting_risk) * 0.26
            + transfer_readiness * 0.18
            + (0.06 if action in {"practice", "represent"} else 0.0)
            + (0.04 if action == "explain" else 0.0),
            0.03,
            0.96,
        )
        outcomes[action] = {
            "success_rate": round(success_rate, 3),
            "retention_lift": round(retention_lift, 3),
        }
    return outcomes


_CONCEPT_ORIGIN_CACHE: Optional[dict[str, str]] = None


def _find_concept_origin(concept_id: str) -> Optional[str]:
    """Return the first section slug 'course/chapter/section' that lists the
    given concept_id in its meta.json concept_ids array. Cached after first scan.
    """
    global _CONCEPT_ORIGIN_CACHE
    if _CONCEPT_ORIGIN_CACHE is None:
        _CONCEPT_ORIGIN_CACHE = {}
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        content_root = os.path.join(base, "frontend", "content")
        if os.path.isdir(content_root):
            for course_name in sorted(os.listdir(content_root)):
                course_dir = os.path.join(content_root, course_name)
                if not os.path.isdir(course_dir):
                    continue
                for chapter_name in sorted(os.listdir(course_dir)):
                    chapter_dir = os.path.join(course_dir, chapter_name)
                    if not os.path.isdir(chapter_dir):
                        continue
                    for filename in sorted(os.listdir(chapter_dir)):
                        if not filename.endswith(".meta.json"):
                            continue
                        section_id = filename.replace(".meta.json", "")
                        meta_path = os.path.join(chapter_dir, filename)
                        try:
                            with open(meta_path, "r", encoding="utf-8") as fh:
                                meta = json.load(fh)
                        except Exception:
                            continue
                        slug = f"{course_name}/{chapter_name}/{section_id}"
                        for cid in meta.get("concept_ids") or []:
                            cid_str = _ensure_str(cid)
                            if cid_str and cid_str not in _CONCEPT_ORIGIN_CACHE:
                                _CONCEPT_ORIGIN_CACHE[cid_str] = slug
    return _CONCEPT_ORIGIN_CACHE.get(_ensure_str(concept_id))


@app.get("/api/concept/{concept_id}/origin")
async def concept_origin(concept_id: str):
    """Return the section slug where the concept first appears.

    Used by StudentDashboard / IntelRail to route to a remediation section.
    """
    slug = _find_concept_origin(concept_id)
    if not slug:
        return {"concept_id": concept_id, "section_slug": None}
    return {"concept_id": concept_id, "section_slug": slug}


def build_adaptive_recommendation(request: AdaptiveRecommendationRequest) -> AdaptiveRecommendationResponse:
    telemetry = request.telemetry
    mastery_states = request.mastery
    learner_profile = request.learner_profile

    concept_scores: list[tuple[str, float]] = []
    for state in mastery_states:
        concept_scores.append(
            (
                state.concept_id,
                _normalize_ratio(
                    state.mastery_score if state.mastery_score is not None else state.p_known,
                    fallback=0.45,
                ),
            )
        )

    if concept_scores:
        average_mastery = sum(score for _, score in concept_scores) / len(concept_scores)
        lowest_concept, lowest_score = min(concept_scores, key=lambda item: item[1])
    else:
        average_mastery = 0.45 if request.concept_ids else 0.5
        lowest_concept = request.concept_ids[0] if request.concept_ids else None
        lowest_score = average_mastery

    practice_attempts = max(0, telemetry.practice_attempts)
    correct_attempts = max(0, min(telemetry.correct_attempts, practice_attempts))
    correct_ratio = (correct_attempts / practice_attempts) if practice_attempts else 0.0

    frustration_index = (
        telemetry.stuck_events * 3
        + telemetry.consecutive_wrong * 2
        + telemetry.hint_requests
        + telemetry.affect_confused * 2
        + telemetry.affect_disengaged * 2
        + telemetry.idle_events
    )
    frustration_index += int(round(_normalize_ratio(learner_profile.forgetting_risk, 0.5) * 2))
    frustration_index += int(round(_normalize_ratio(learner_profile.calibration_drift, 0.0) * 2))
    positive_momentum = (
        correct_attempts * 2
        + telemetry.affect_insight * 2
        + telemetry.affect_engaged
    )
    if learner_profile.transfer_readiness >= 0.7:
        positive_momentum += 1

    uncertainty_signal = clamp(
        sum(1 / math.sqrt(max(1, state.attempts_count + 1)) for state in mastery_states) / max(1, len(mastery_states)),
        0.0,
        1.0,
    )
    friction_signal = _normalize_signal(frustration_index, 10)
    mastery_gap = clamp(1 - average_mastery, 0.0, 1.0)
    accuracy_gap = clamp(1 - correct_ratio, 0.0, 1.0) if practice_attempts else mastery_gap
    forgetting_risk = _normalize_ratio(learner_profile.forgetting_risk, 0.5)
    calibration_drift = _normalize_ratio(learner_profile.calibration_drift, 0.0)
    transfer_readiness = _normalize_ratio(learner_profile.transfer_readiness, 0.0)
    stability_index = _normalize_ratio(learner_profile.stability_index, 0.0)
    predicted_next_correct = _normalize_ratio(learner_profile.predicted_next_correct, average_mastery)
    predicted_retention = _normalize_ratio(learner_profile.predicted_retention, average_mastery)
    misconception_pressure = clamp(
        max(_top_misconception_pressure(learner_profile.misconception_patterns), _normalize_ratio(learner_profile.misconception_pressure, 0.0)),
        0.0,
        1.0,
    )
    engagement_signal = clamp((positive_momentum + telemetry.chat_turns * 0.5) / 6, 0.0, 1.0)
    support_fatigue = _normalize_signal(learner_profile.recent_interventions, 6)
    chat_signal = _normalize_signal(telemetry.chat_turns + telemetry.explain_requests + telemetry.representation_requests, 5)
    unit_signal = 1.0 if "unit" in _ensure_str(request.stuck_reason).lower() else 0.0
    idle_signal = 1.0 if "idle" in _ensure_str(request.stuck_reason).lower() else 0.0

    readiness: Literal["support", "practice", "advance"] = "support"
    if average_mastery >= 0.8 and frustration_index <= 1 and (correct_ratio >= 0.75 or positive_momentum >= 3):
        readiness = "advance"
    elif average_mastery >= 0.45 and frustration_index <= 4:
        readiness = "practice"

    confidence_signal = "Needs support"
    if readiness == "advance":
        confidence_signal = "Ready to advance"
    elif readiness == "practice":
        confidence_signal = "Ready for guided practice"
    elif learner_profile.calibration_drift >= 0.35:
        confidence_signal = "Confidence is unstable"

    focus_concepts = [concept for concept in request.concept_ids if concept][:3]
    if lowest_concept and lowest_concept not in focus_concepts:
        focus_concepts.insert(0, lowest_concept)
    focus_concepts = focus_concepts[:3]

    evidence: list[str] = []
    if lowest_concept:
        evidence.append(
            f"Lowest mastery is {_humanize_concept(lowest_concept)} at {lowest_score:.0%}."
        )
    evidence.append(f"Average mastery across this section is {average_mastery:.0%}.")
    if practice_attempts:
        evidence.append(
            f"Recent practice accuracy is {correct_attempts}/{practice_attempts} ({correct_ratio:.0%})."
        )
    if telemetry.hint_requests:
        evidence.append(f"Hint requests in this section: {telemetry.hint_requests}.")
    if telemetry.affect_confused:
        evidence.append("Learner reported confusion in this section.")
    if telemetry.affect_insight:
        evidence.append("Learner reported an insight moment recently.")
    if request.stuck_reason:
        evidence.append(f"Current stuck signal: {request.stuck_reason}.")
    if learner_profile.forgetting_risk >= 0.55:
        evidence.append(f"Forgetting risk is elevated at {learner_profile.forgetting_risk:.0%}.")
    if learner_profile.calibration_drift >= 0.3:
        evidence.append(f"Confidence calibration drift is {learner_profile.calibration_drift:.0%}.")
    if learner_profile.misconception_patterns:
        top_pattern = learner_profile.misconception_patterns[0]
        evidence.append(
            f"Most common misconception tag is {_humanize_concept(top_pattern.type)} ({top_pattern.count}x)."
        )
    if predicted_next_correct:
        evidence.append(f"Predicted next-attempt success is {predicted_next_correct:.0%}.")
    if predicted_retention:
        evidence.append(f"Predicted retention after support is {predicted_retention:.0%}.")
    if stability_index:
        evidence.append(f"Stability index is {stability_index:.0%}.")

    stuck_reason = _ensure_str(request.stuck_reason).lower()
    action_scores = {
        "explain": (
            0.52 * mastery_gap
            + 0.28 * friction_signal
            + 0.2 * unit_signal
            + 0.16 * calibration_drift
            + 0.18 * misconception_pressure
            + 0.1 * forgetting_risk
            - 0.16 * transfer_readiness
            - 0.08 * engagement_signal
        ),
        "represent": (
            0.24 * friction_signal
            + 0.2 * accuracy_gap
            + 0.18 * misconception_pressure
            + 0.18 * uncertainty_signal
            + 0.16 * idle_signal
            + 0.08 * support_fatigue
            + 0.06 * engagement_signal
            - 0.08 * unit_signal
        ),
        "practice": (
            0.32 * average_mastery
            + 0.2 * predicted_next_correct
            + 0.16 * correct_ratio
            + 0.12 * (1 - friction_signal)
            + 0.12 * stability_index
            + 0.08 * (1 - forgetting_risk)
            - 0.18 * accuracy_gap
            - 0.1 * misconception_pressure
        ),
        "advance": (
            0.42 * average_mastery
            + 0.18 * correct_ratio
            + 0.16 * transfer_readiness
            + 0.14 * engagement_signal
            + 0.08 * predicted_retention
            - 0.24 * friction_signal
            - 0.2 * forgetting_risk
            - 0.16 * calibration_drift
            - 0.1 * misconception_pressure
        ),
        "ask": (
            0.18 * friction_signal
            + 0.18 * calibration_drift
            + 0.16 * misconception_pressure
            + 0.14 * uncertainty_signal
            + 0.14 * chat_signal
            + 0.1 * support_fatigue
            + 0.06 * (0 if request.stuck_reason else 1)
        ),
    }

    exploration_bonus = {
        "explain": 0.02 * unit_signal,
        "represent": 0.06 * uncertainty_signal + 0.04 * idle_signal,
        "practice": 0.03 * (1 - uncertainty_signal),
        "advance": 0.02 * transfer_readiness,
        "ask": 0.08 * uncertainty_signal + 0.03 * support_fatigue,
    }
    action_scores = {
        action: round(clamp(score + exploration_bonus.get(action, 0.0), 0.02, 0.99), 3)
        for action, score in action_scores.items()
    }
    ranked_actions = sorted(action_scores.items(), key=lambda item: item[1], reverse=True)
    if readiness == "advance" and action_scores["advance"] >= ranked_actions[0][1] - 0.06:
        primary_action = "advance"
        ranked_actions = sorted(action_scores.items(), key=lambda item: (item[0] != "advance", -item[1]))
    else:
        primary_action = ranked_actions[0][0]
    second_best_score = ranked_actions[1][1] if len(ranked_actions) > 1 else ranked_actions[0][1]
    predicted_outcomes = _estimate_action_outcomes(
        action_scores,
        average_mastery=average_mastery,
        correct_ratio=correct_ratio,
        friction_signal=friction_signal,
        forgetting_risk=forgetting_risk,
        transfer_readiness=transfer_readiness,
    )

    if primary_action == "explain":
        title = "Repair the conceptual footing before the next attempt"
        rationale = "The learner profile shows that direct clarification is the safest path before more application."
    elif primary_action == "represent":
        title = "Shift the representation before repeating the step"
        rationale = "A new frame is more likely to unlock progress than repeating the same explanation or retry."
    elif primary_action == "practice":
        title = "Reinforce the idea with one targeted attempt"
        rationale = "Signals suggest the concept is close to stable and should now be consolidated through practice."
    elif primary_action == "advance":
        title = "Preserve momentum and move the learner forward"
        rationale = "Mastery and transfer signals are stable enough that extra support would create drag."
    else:
        title = "Use a diagnostic coaching turn"
        rationale = "The learner state is mixed enough that one targeted question is the best way to disambiguate the next move."

    reason_codes: list[str] = []
    recommended_because: list[str] = []
    not_recommended_because: list[str] = []

    if unit_signal:
        reason_codes.append("unit_mismatch")
        recommended_because.append("A unit mismatch is present, which strongly favors direct conceptual repair.")
    if idle_signal:
        reason_codes.append("idle_reengagement")
        recommended_because.append("The learner paused long enough that a lighter re-entry move is justified.")
    if mastery_gap >= 0.45:
        reason_codes.append("low_mastery")
        recommended_because.append("Average mastery is still below the stability band for fluent application.")
    if friction_signal >= 0.55:
        reason_codes.append("high_friction")
        recommended_because.append("Recent stuck and wrong-answer signals indicate substantial friction in this section.")
    if forgetting_risk >= 0.6:
        reason_codes.append("retrieval_risk")
        recommended_because.append("Forgetting risk is elevated, so the engine favors retrieval-supportive actions.")
    if calibration_drift >= 0.3:
        reason_codes.append("calibration_gap")
        recommended_because.append("Confidence and correctness are diverging, which makes unsupported advancement risky.")
    if misconception_pressure >= 0.35:
        reason_codes.append("misconception_pattern")
        recommended_because.append("Misconception tags are clustering around the same idea, so the engine is correcting the frame instead of repeating the task.")
    if transfer_readiness >= 0.7 and primary_action in {"practice", "advance"}:
        reason_codes.append("transfer_ready")
        recommended_because.append("Transfer readiness is strong enough that application-oriented moves are likely to pay off.")
    if not reason_codes:
        reason_codes.append("balanced_profile")
        recommended_because.append("No single risk dominated, so the action was chosen by the best overall score across mastery, friction, and transfer.")

    for alt_action, alt_score in ranked_actions[1:3]:
        if alt_action == "advance" and (friction_signal >= 0.35 or calibration_drift >= 0.25):
            not_recommended_because.append("Advance was not first because friction or calibration instability makes a forward jump too risky right now.")
        elif alt_action == "practice" and (accuracy_gap >= 0.35 or telemetry.consecutive_wrong >= 2):
            not_recommended_because.append("Practice was not first because recent error patterns suggest the learner needs support before another attempt.")
        elif alt_action == "represent" and unit_signal:
            not_recommended_because.append("A representation shift was not first because a unit error is better repaired through direct explanation.")
        elif alt_action == "ask" and primary_action != "ask":
            not_recommended_because.append("Free-form chat was held back because a more structured intervention has stronger evidence than open-ended coaching.")
        else:
            not_recommended_because.append(
                f"{alt_action.title()} scored lower ({alt_score:.0%}) than {primary_action} ({action_scores[primary_action]:.0%}) for this learner state."
            )

    coach_prompt = (
        f"I'm working on {_humanize_concept(lowest_concept)} in {request.section_title or request.section_id}. "
        "Can you coach me with one diagnostic question first?"
    )

    primary = _build_recommendation_card(
        action=primary_action,
        title=title,
        rationale=rationale,
        evidence=evidence,
        focus_concepts=focus_concepts,
        coach_prompt=coach_prompt,
    )

    secondary_candidates: list[AdaptiveRecommendationCard] = []
    fallback_actions = {
        "explain": [
            ("represent", "Try a visual or analogy", "A second representation can reduce abstraction if the text explanation still feels heavy."),
            ("practice", "Return to one focused attempt", "After the explanation lands, a single targeted problem helps transfer the idea."),
            ("ask", "Ask BigAL for a diagnostic hint", "A short coaching exchange can pinpoint exactly where the reasoning is breaking."),
        ],
        "represent": [
            ("explain", "Pair the new view with a simpler explanation", "Combining a representation with plain-language coaching often closes the gap quickly."),
            ("practice", "Test the new model right away", "A quick attempt checks whether the new representation is usable, not just interesting."),
            ("ask", "Ask BigAL to compare two models", "Dialog can help the learner connect the new representation back to the formal concept."),
        ],
        "practice": [
            ("explain", "Review the fragile step first", "A brief explanation can prevent avoidable repetition if the learner is still uncertain."),
            ("ask", "Ask BigAL for a single scaffold", "A targeted prompt keeps practice productive without giving away the answer."),
        ],
        "advance": [
            ("practice", "Do one stretch problem before advancing", "A harder application can confirm the concept is robust enough to transfer forward."),
            ("ask", "Ask for a deeper extension", "BigAL can connect the concept to a richer engineering use case before the learner moves on."),
        ],
        "ask": [
            ("explain", "Start with a direct explanation", "If the learner cannot name the issue yet, a clean explanation is the safest starting point."),
            ("represent", "Switch to a new view", "A diagram or analogy may surface the misconception faster than free-form chat."),
        ],
    }

    for action, secondary_title, secondary_rationale in fallback_actions.get(primary_action, []):
        secondary_candidates.append(
            _build_recommendation_card(
                action=action,
                title=secondary_title,
                rationale=secondary_rationale,
                evidence=evidence,
                focus_concepts=focus_concepts,
                coach_prompt=coach_prompt,
            )
        )

    signal_coverage = clamp(
        (
            len(mastery_states)
            + (1 if practice_attempts else 0)
            + (1 if telemetry.stuck_events else 0)
            + (1 if learner_profile.confidence_samples else 0)
        ) / 6,
        0.0,
        1.0,
    )
    confidence = round(
        clamp(
            0.38
            + (ranked_actions[0][1] - second_best_score) * 0.95
            + signal_coverage * 0.18
            - uncertainty_signal * 0.08,
            0.2,
            0.96,
        ),
        3,
    )

    # Prerequisite remediation hint: when the lowest-mastery concept is well
    # below threshold (<0.4), suggest revisiting an earlier section that
    # introduced it. The frontend can act on this by routing the learner
    # back to the prerequisite section before showing more new content.
    needs_prereq: Optional[PrerequisiteHint] = None
    if lowest_concept and lowest_score is not None and lowest_score < 0.4:
        origin = _find_concept_origin(lowest_concept)
        if origin:
            needs_prereq = PrerequisiteHint(
                concept_id=lowest_concept,
                suggested_section_slug=origin,
                reason=(
                    f"Mastery on '{lowest_concept}' is {round(lowest_score * 100)}%. "
                    f"Reviewing the section where this concept was introduced "
                    f"is likely more efficient than continuing forward."
                ),
            )

    return AdaptiveRecommendationResponse(
        section_id=request.section_id,
        learner_state=LearnerStateSummary(
            average_mastery=round(average_mastery, 3),
            lowest_mastery_concept=lowest_concept,
            readiness=readiness,
            frustration_index=frustration_index,
            confidence_signal=confidence_signal,
            forgetting_risk=round(forgetting_risk, 3),
            calibration_drift=round(calibration_drift, 3),
            transfer_readiness=round(transfer_readiness, 3),
            dominant_misconception=learner_profile.misconception_patterns[0].type if learner_profile.misconception_patterns else None,
        ),
        primary_recommendation=primary,
        secondary_recommendations=secondary_candidates[:3],
        needs_prerequisite=needs_prereq,
        reasoning=AdaptiveRecommendationReasoning(
            confidence=confidence,
            reason_codes=reason_codes[:5],
            recommended_because=recommended_because[:4],
            not_recommended_because=not_recommended_because[:4],
            evidence_snapshot={
                "average_mastery": round(average_mastery, 3),
                "lowest_concept": lowest_concept,
                "lowest_score": round(lowest_score, 3) if lowest_concept else None,
                "practice_accuracy": round(correct_ratio, 3),
                "frustration_index": frustration_index,
                "forgetting_risk": round(forgetting_risk, 3),
                "calibration_drift": round(calibration_drift, 3),
                "transfer_readiness": round(transfer_readiness, 3),
                "confidence_average": round(_normalize_ratio(learner_profile.average_confidence, 0.5), 3),
                "dominant_misconception": learner_profile.misconception_patterns[0].type if learner_profile.misconception_patterns else None,
                "predicted_next_correct": round(predicted_next_correct, 3),
                "predicted_retention": round(predicted_retention, 3),
                "stability_index": round(stability_index, 3),
                "misconception_pressure": round(misconception_pressure, 3),
                "uncertainty_signal": round(uncertainty_signal, 3),
            },
            action_scores=action_scores,
            predicted_outcomes=predicted_outcomes,
        ),
    )


def validate_access_passcode(scope: Literal["engineering", "education", "researcher"], passcode: str) -> bool:
    env_key_by_scope = {
        "engineering": "ENGINEERING_ACCESS_CODE",
        "education": "EDUCATION_ACCESS_CODE",
        "researcher": "RESEARCHER_ACCESS_CODE",
    }
    fallback_by_scope = {
        "engineering": "eng123",
        "education": "edu123",
        "researcher": "immersivebama",
    }

    expected_value = os.environ.get(env_key_by_scope[scope], fallback_by_scope[scope]).strip()
    candidate = passcode.strip()
    return bool(expected_value) and candidate == expected_value

# ============================================================================
# LEGACY ENDPOINTS (Module-based generation)
# ============================================================================

@app.get("/")
async def root():
    return {"status": "ok", "message": "UA Intelligent Textbook API v2.0"}


@app.get("/api/modules/{grade_level}")
async def get_modules(grade_level: str):
    """Get module titles for a grade level."""
    try:
        titles = get_module_titles(grade_level)
        return {"grade_level": grade_level, "modules": titles}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/hooks/{grade_level}/{module}")
async def get_hooks(grade_level: str, module: str):
    """Get hooks/keywords for a specific module."""
    try:
        hooks = get_hooks_for_module(module, grade_level)
        return {"module": module, "hooks": hooks}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/module-info/{grade_level}/{module}")
async def get_module_details(grade_level: str, module: str):
    """Get full module information."""
    try:
        info = get_module_info(module, grade_level)
        if info:
            return {
                "icon": info["icon"],
                "title": info["title"],
                "description": info["description"],
                "hooks": [h["name"] for h in info["hooks"]]
            }
        raise HTTPException(status_code=404, detail="Module not found")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/diagnostic/questions/{course_id}")
async def get_diagnostic_questions(course_id: str):
    """
    Get diagnostic questions for a specific course.
    Eventually, this will query the Supabase 'questions' table.
    """
    try:
        # Fallback question banks mapping
        question_banks = {
            "statics": [
                {"id": 1, "concept": "vectors", "stem": "What is the x-component of a 100 N force acting at 60° from the horizontal?", "options": ["50 N", "86.6 N", "100 N", "70.7 N"], "correct": 0, "prereqFor": ["01/01", "01/02"]},
                {"id": 2, "concept": "equilibrium", "stem": "For a particle in equilibrium, what is the sum of all forces?", "options": ["Maximum force", "Minimum force", "Zero", "Cannot be determined"], "correct": 2, "prereqFor": ["01/01"]},
                {"id": 3, "concept": "trigonometry", "stem": "In a right triangle with angle θ = 30°, if the hypotenuse is 10, what is the opposite side?", "options": ["5", "8.66", "10", "7.07"], "correct": 0, "prereqFor": ["01/01", "02/01"]},
                {"id": 4, "concept": "moments", "stem": "A moment is the product of:", "options": ["Force and mass", "Force and perpendicular distance", "Mass and acceleration", "Force and velocity"], "correct": 1, "prereqFor": ["02/01", "02/02"]},
                {"id": 5, "concept": "fbd", "stem": "A free body diagram should include:", "options": ["Only external forces", "Only internal forces", "Both internal and external forces", "No forces"], "correct": 0, "prereqFor": ["01/02", "01/03"]},
                {"id": 6, "concept": "friction", "stem": "Static friction force is always:", "options": ["Equal to μN", "Greater than μN", "Less than or equal to μN", "Zero"], "correct": 2, "prereqFor": ["01/04"]},
                {"id": 7, "concept": "units", "stem": "What are the SI units for moment (torque)?", "options": ["N", "N·m", "kg·m/s²", "J/s"], "correct": 1, "prereqFor": ["02/01", "02/02"]},
                {"id": 8, "concept": "trusses", "stem": "In a simple truss, members are assumed to be:", "options": ["Rigid beams", "Two-force members", "Flexible cables", "Compression only"], "correct": 1, "prereqFor": ["03/01", "03/02"]}
            ],
            "dynamics": [
                {"id": 1, "concept": "kinematics", "stem": "If velocity is constant, what is the acceleration?", "options": ["Equal to velocity", "Maximum", "Zero", "Cannot be determined"], "correct": 2, "prereqFor": ["01/01"]},
                {"id": 2, "concept": "kinematics", "stem": "A particle moves along a straight line with position s(t) = 3t² − 2t + 1 (meters). What is the velocity at t = 2 s?", "options": ["8 m/s", "10 m/s", "12 m/s", "6 m/s"], "correct": 1, "prereqFor": ["01/01"]},
                {"id": 3, "concept": "kinematics", "stem": "In projectile motion (neglecting air resistance), the horizontal component of acceleration is:", "options": ["9.81 m/s²", "Variable", "Zero", "Equal to vertical component"], "correct": 2, "prereqFor": ["01/02"]},
                {"id": 4, "concept": "curvilinear_motion", "stem": "For circular motion at constant speed, the acceleration vector points:", "options": ["Tangent to the path", "Toward the center of the circle", "Away from the center", "In the direction of velocity"], "correct": 1, "prereqFor": ["01/02"]},
                {"id": 5, "concept": "curvilinear_motion", "stem": "The normal component of acceleration for a particle on a curved path depends on:", "options": ["Mass and force", "Speed and radius of curvature", "Angular velocity only", "Tangential acceleration only"], "correct": 1, "prereqFor": ["01/02"]},
                {"id": 6, "concept": "relative_motion", "stem": "If car A moves east at 60 km/h and car B moves west at 40 km/h, the velocity of A relative to B is:", "options": ["20 km/h east", "100 km/h east", "100 km/h west", "20 km/h west"], "correct": 1, "prereqFor": ["01/03"]},
                {"id": 7, "concept": "newtons_laws", "stem": "Newton's Second Law for a particle states that the net force equals:", "options": ["Mass times velocity", "Mass times acceleration", "Weight times distance", "Momentum times time"], "correct": 1, "prereqFor": ["02/01"]},
                {"id": 8, "concept": "newtons_laws", "stem": "A 10 kg block is pulled along a frictionless surface by a 50 N horizontal force. The acceleration is:", "options": ["0.5 m/s²", "5 m/s²", "50 m/s²", "500 m/s²"], "correct": 1, "prereqFor": ["02/01"]},
                {"id": 9, "concept": "friction_dynamics", "stem": "Kinetic friction force is typically:", "options": ["Greater than static friction", "Equal to the normal force", "Less than maximum static friction", "Independent of surface contact"], "correct": 2, "prereqFor": ["02/02"]},
                {"id": 10, "concept": "work_energy", "stem": "The work done by a constant force F over displacement d at angle θ is:", "options": ["F × d", "F × d × sin(θ)", "F × d × cos(θ)", "F / d"], "correct": 2, "prereqFor": ["02/01"]},
                {"id": 11, "concept": "work_energy", "stem": "The kinetic energy of a 4 kg object moving at 3 m/s is:", "options": ["6 J", "12 J", "18 J", "36 J"], "correct": 2, "prereqFor": ["02/01"]},
                {"id": 12, "concept": "conservation_energy", "stem": "In a conservative system with no friction, the total mechanical energy:", "options": ["Always increases", "Always decreases", "Remains constant", "Equals zero"], "correct": 2, "prereqFor": ["02/02"]},
                {"id": 13, "concept": "impulse_momentum", "stem": "The impulse of a force is equal to the change in:", "options": ["Kinetic energy", "Potential energy", "Linear momentum", "Angular velocity"], "correct": 2, "prereqFor": ["03/01"]},
                {"id": 14, "concept": "impulse_momentum", "stem": "In a perfectly inelastic collision, which quantity is conserved?", "options": ["Kinetic energy", "Velocity", "Linear momentum", "Acceleration"], "correct": 2, "prereqFor": ["03/01"]},
                {"id": 15, "concept": "rigid_body_kinematics", "stem": "For a rigid body in pure rotation, the velocity of any point on the body is given by:", "options": ["v = rω (perpendicular to radius)", "v = rα", "v = Iω", "v = mr²"], "correct": 0, "prereqFor": ["03/02"]}
            ],
            "inst-design": [
                {"id": 1, "concept": "ct_1_2", "stem": "Which learning theory focuses primarily on observable behaviors rather than internal mental states?", "options": ["Cognitivism", "Constructivism", "Behaviorism", "Connectivism"], "correct": 2, "prereqFor": ["01/03"]},
                {"id": 2, "concept": "ct_2_1", "stem": "What does the acronym ADDIE stand for?", "options": ["Analyze, Design, Develop, Implement, Evaluate", "Assess, Draft, Deploy, Interact, Examine", "Acquire, Discuss, Discover, Internalize, Expand", "Align, Deliver, Design, Innovate, Educate"], "correct": 0, "prereqFor": ["02/01"]},
                {"id": 3, "concept": "ct_1_3", "stem": "Extraneous cognitive load is caused by:", "options": ["The inherent difficulty of the material", "Poor instructional design and presentation", "The learner's prior knowledge", "Schema construction"], "correct": 1, "prereqFor": ["01/02"]},
                {"id": 4, "concept": "ct_1_2", "stem": "A key goal of instruction according to cognitivism is to help learners build and refine:", "options": ["Stimulus-response associations", "Behavioral conditioning", "Mental schemas", "Rote memorization pathways"], "correct": 2, "prereqFor": ["01/02"]},
                {"id": 5, "concept": "ct_1_2", "stem": "In a constructivist classroom, the teacher acts primarily as a:", "options": ["Transmitter of knowledge", "Strict disciplinarian", "Passive observer", "Facilitator or guide"], "correct": 3, "prereqFor": ["01/01"]},
                {"id": 6, "concept": "ct_2_2", "stem": "Which evaluation occurs DURING the learning process to improve instruction?", "options": ["Summative", "Formative", "Diagnostic", "Confirmative"], "correct": 1, "prereqFor": ["02/01"]},
                {"id": 7, "concept": "ct_2_2", "stem": "A well-designed rubric primarily helps to:", "options": ["Confuse students with complex grading scales", "Provide objective, transparent assessment criteria", "Reduce the amount of grading work", "Automatically generate test questions"], "correct": 1, "prereqFor": ["02/02"]},
                {"id": 8, "concept": "ct_2_3", "stem": "Kirkpatrick's Four Levels of Evaluation are Reaction, Learning, Behavior, and:", "options": ["Results", "Return on Investment", "Retention", "Recall"], "correct": 0, "prereqFor": ["02/03"]},
                {"id": 9, "concept": "ct_1_1", "stem": "Which scenario best represents an application of situated learning?", "options": ["Memorizing state capitals", "Taking a multiple-choice test", "Learning math by running a mock store", "Reading a textbook chapter linearly"], "correct": 2, "prereqFor": ["01/01"]},
                {"id": 10, "concept": "ct_1_3", "stem": "According to Cognitive Load Theory, intrinsic load refers to:", "options": ["The way information is presented", "The natural complexity of the information", "The learner's motivation level", "The background noise in the classroom"], "correct": 1, "prereqFor": ["01/02"]},
                {"id": 11, "concept": "ct_2_1", "stem": "A Needs Analysis in the ADDIE model aims to answer which question?", "options": ["What color scheme should the modules be?", "Who are the learners and what do they need to know?", "How much will the development cost?", "Where will the course be hosted?"], "correct": 1, "prereqFor": ["02/01"]},
                {"id": 12, "concept": "ct_2_2", "stem": "Backward Design (Understanding by Design) starts with identifying:", "options": ["Learning activities", "Assessment methods", "Desired results (learning goals)", "Textbook chapters"], "correct": 2, "prereqFor": ["02/02"]},
                {"id": 13, "concept": "ct_1_2", "stem": "Vygotsky's Zone of Proximal Development (ZPD) relies heavily on the concept of:", "options": ["Punishment", "Scaffolding", "Classical conditioning", "Rote learning"], "correct": 1, "prereqFor": ["06/01"]},
                {"id": 14, "concept": "ct_1_1", "stem": "Bloom's Taxonomy is primarily used for:", "options": ["Organizing classrooms logically", "Classifying educational learning objectives", "Developing grading rubrics automatically", "Scheduling instructional time"], "correct": 1, "prereqFor": ["02/01"]},
                {"id": 15, "concept": "ct_2_3", "stem": "A summative assessment is typically given:", "options": ["Before instruction begins", "During instruction to adjust pacing", "At the end of an instructional unit", "Only when a student fails a formative test"], "correct": 2, "prereqFor": ["02/01"]},
                {"id": 16, "concept": "media_principles", "stem": "Which of Mayer’s principles states that people learn better when corresponding words and pictures are presented near rather than far from each other on the page or screen?", "options": ["Coherence Principle", "Spatial Contiguity Principle", "Redundancy Principle", "Modality Principle"], "correct": 1, "prereqFor": ["03/01"]},
                {"id": 17, "concept": "arcs_model", "stem": "In Keller’s ARCS model of motivational design, what does the 'R' stand for?", "options": ["Rigidity", "Response", "Relevance", "Reward"], "correct": 2, "prereqFor": ["04/01"]},
                {"id": 18, "concept": "andragogy", "stem": "Malcolm Knowles’ theory of Andragogy assumes that adult learners are primarily:", "options": ["Dependent on the teacher for direction", "Internally motivated and self-directed", "Blank slates waiting for information", "Motivated exclusively by external rewards"], "correct": 1, "prereqFor": ["05/01"]},
                {"id": 19, "concept": "udl", "stem": "Universal Design for Learning (UDL) is best described as a framework to:", "options": ["Lower academic standards to ensure all students pass", "Provide multiple, flexible methods of representation, expression, and engagement", "Design physical classroom furniture", "Standardize testing across different states"], "correct": 1, "prereqFor": ["07/01"]}
            ],
            "bio-inspired": [
                {"id": 1, "concept": "cellular_solids", "stem": "Which of the following biological structures is an example of an open-cell porous solid used to maximize structural efficiency?", "options": ["Shark continuous dermal skin", "Turtle rigid shell", "Cancellous (spongy) bone", "Gecko foot spatulae"], "correct": 2, "prereqFor": ["01/01"]},
                {"id": 2, "concept": "hierarchical_structures", "stem": "What is the primary mechanical advantage of combining stiff mineral platelets within a soft protein matrix (like in nacre)?", "options": ["It decreases the overall weight to zero.", "It provides extreme stiffness and high fracture toughness.", "It creates completely transparent layers.", "It prevents heat transfer completely."], "correct": 1, "prereqFor": ["01/01"]},
                {"id": 3, "concept": "directional_adhesion", "stem": "Geckos cling to sheer surfaces primarily through:", "options": ["Sticky liquid mucous secretion", "Microscopic suction cups", "Van der Waals forces between billions of setae and the surface", "Electromagnetic charging of the glass"], "correct": 2, "prereqFor": ["04/01"]},
                {"id": 4, "concept": "fluid_dynamics", "stem": "Riblets on shark skin reduce drag by:", "options": ["Coating the skin in a frictionless layer of oil", "Physically confining and lifting turbulent vortices away from valleys", "Preventing any water from touching the shark", "Increasing laminar flow perfectly across all curves"], "correct": 1, "prereqFor": ["02/01"]},
                {"id": 5, "concept": "aeroacoustics", "stem": "Trailing edge serrations on an owl wing suppress flight noise by:", "options": ["Slowing down the bird dramatically", "Absorbing sound waves like a sponge", "Breaking large coherent vortices into smaller, high-frequency micro-turbulences", "Reflecting sound waves back upwards"], "correct": 2, "prereqFor": ["03/01"]},
                {"id": 6, "concept": "structural_color", "stem": "The vibrant iridescent blue of the Morpho butterfly is created by:", "options": ["High concentrations of blue chemical pigments", "Microscopic scale structures causing light interference and diffraction", "Bioluminescent bacteria in the wings", "Reflecting the color of the sky"], "correct": 1, "prereqFor": ["05/01"]},
                {"id": 7, "concept": "thermodynamics", "stem": "Termite mounds maintain near-constant internal temperatures despite extreme outside heat primarily by utilizing:", "options": ["Geothermal heating from magma", "Active mechanical pumping by specialized worker termites", "Passive ventilation driven by solar-induced convection currents (Stack Effect)", "Evaporative cooling from massive internal water reservoirs"], "correct": 2, "prereqFor": ["06/01"]},
                {"id": 8, "concept": "self_healing", "stem": "Man-made self-healing polymers often mimic human skin by incorporating:", "options": ["Tiny internal band-aids", "Microcapsules filled with liquid healing agents that rupture upon damage", "A layer of live bacteria that secrete plastic", "Magnets that pull torn pieces back together"], "correct": 1, "prereqFor": ["07/01"]},
                {"id": 9, "concept": "swarm_logic", "stem": "In swarm intelligence, 'stigmergy' refers to:", "options": ["Direct telepathic communication between individual robots", "Indirect coordination through modifications of the physical environment (e.g. pheromone trails)", "A centralized control unit directing all agents", "The biological instinct to attack foreign entities"], "correct": 1, "prereqFor": ["08/01"]}
            ]
        }
        
        # Default to statics if course not found
        questions = question_banks.get(course_id, question_banks["statics"])
        return {"questions": questions}
        
    except Exception as e:
        logger.error(f"Error fetching diagnostic questions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate")
async def generate_content(request: GenerateRequest):
    """Generate learning content (narrative, activity, simulation, illustration)."""
    try:
        # Use env var if available, otherwise use request payload
        api_key = get_api_key(request)
        
        content = generate_module_content(
            module=request.module,
            keywords=request.keywords,
            grade_level=request.grade_level,
            interest=request.interest,
            api_key=api_key
        )
        return content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation error: {str(e)}")

@app.post("/api/orchestrate", response_model=OrchestratorResponse)
async def orchestrate_query(request: OrchestrateRequest):
    """Analyze student query and delegate to specialist agents based on intent."""
    try:
        api_key = get_api_key(request)
        print(f"[ORCHESTRATE] API key present: {bool(api_key)}, query: {request.query[:50]}")
        agent = OrchestratorAgent(api_key=api_key)
        result = agent.orchestrate(
            query=request.query,
            course=request.course,
            current_content=request.current_content,
            history=request.history,
            is_highlight=request.is_highlight,
            grade_level=request.grade_level,
            interest=request.interest,
        )
        normalized = normalize_orchestrator_response(result)
        return normalized.model_dump(exclude_none=True)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Orchestration error: {str(e)}")

@app.post("/api/generate_assessment")
async def generate_assessment(request: AssessmentRequest):
    """Generate a formative assessment (MCQ) for the given context."""
    try:
        api_key = get_api_key(request)
        agent = AssessmentAgent(api_key=api_key)
        
        # We need to make sure we parse the response which might be wrapped in JSON markdown blocks
        # or it might just be the dict already
        
        result_json = agent.generate_assessment(
            bio_context=request.biology_context,
            eng_context=request.engineering_context,
            section_title=request.section_title,
            learning_objectives=request.learning_objectives,
            concept_ids=request.concept_ids
        )
        return {"assessment": result_json, "summary": "Assessment generated successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Assessment generation error: {str(e)}")

class GradeSummaryRequest(BaseModel):
    question: str
    student_answer: str
    rubric: str
    api_key: str = ""

@app.post("/api/grade_summary")
async def grade_summary(request: GradeSummaryRequest):
    """Grade a short-answer or summary response using LLM."""
    try:
        api_key = get_api_key(request)
        agent = AssessmentAgent(api_key=api_key)
        
        result_json = agent.grade_summary(
            question=request.question,
            student_answer=request.student_answer,
            rubric=request.rubric
        )
        return result_json
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Grading error: {str(e)}")

class GradeBKTRequest(BaseModel):
    current_states: dict  # e.g., {"concept_A": 0.5, "concept_B": 0.2}
    q_matrix: dict        # e.g., {"concept_A": 1.0, "concept_B": 0.5}
    is_correct: bool

@app.post("/api/grade")
async def update_bkt_mastery(request: GradeBKTRequest):
    """Update concept masteries using Bayesian Knowledge Tracing."""
    try:
        bkt_engine = BayesianKnowledgeTracing()
        
        # Calculate new states based on the Q-Matrix
        new_states = bkt_engine.process_q_matrix_update(
            current_states=request.current_states,
            q_matrix_weights=request.q_matrix,
            is_correct=request.is_correct
        )
        
        return {"new_states": new_states}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"BKT updating error: {str(e)}")

class TelemetryFusionRequest(BaseModel):
    current_p_slip: float
    current_p_transit: float
    interaction_type: str
    intensity: float = 1.0

@app.post("/api/telemetry_fusion")
async def fuse_telemetry(request: TelemetryFusionRequest):
    """Adjust BKT priors based on interaction telemetry (Soft Evidence)."""
    try:
        bkt_engine = BayesianKnowledgeTracing()
        
        new_slip, new_transit = bkt_engine.apply_telemetry_fusion(
            current_p_slip=request.current_p_slip,
            current_p_transit=request.current_p_transit,
            interaction_type=request.interaction_type,
            intensity=request.intensity
        )
        
        return {
            "new_p_slip": new_slip,
            "new_p_transit": new_transit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Telemetry fusion error: {str(e)}")


@app.post("/api/access/validate")
async def validate_access(request: AccessValidationRequest):
    """Validate track or dashboard access without exposing passcodes in the client bundle."""
    is_valid = validate_access_passcode(request.scope, request.passcode)
    return {"valid": is_valid, "scope": request.scope}


@app.post("/api/adaptive_recommendation", response_model=AdaptiveRecommendationResponse)
async def adaptive_recommendation(request: AdaptiveRecommendationRequest):
    """Recommend the next best learning action from mastery and recent telemetry."""
    try:
        return build_adaptive_recommendation(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Adaptive recommendation error: {str(e)}")

class MasteryGraphRequest(BaseModel):
    mastery_data: dict
    course: str = "inst-design"
    current_section_id: Optional[str] = None
    current_concepts: list[str] = Field(default_factory=list)


def _humanize_graph_label(value: Optional[str]) -> str:
    text = _ensure_str(value)
    if not text:
        return "Untitled concept"
    text = text.replace("-", " ").replace("_", " ").strip()
    return " ".join(part.capitalize() for part in text.split())


def _build_graph_status(p_known: float) -> str:
    if p_known >= 0.8:
        return "mastered"
    if p_known >= 0.5:
        return "emerging"
    return "novice"


def build_mastery_graph_payload(
    course: str,
    mastery_data: dict[str, Any],
    current_section_id: Optional[str] = None,
    current_concepts: Optional[list[str]] = None,
) -> dict[str, list[dict[str, Any]]]:
    toc = generate_toc(course)
    if not toc.get("chapters"):
        toc = get_fallback_toc(course)

    current_concepts = current_concepts or []
    nodes: list[dict[str, Any]] = []
    links: list[dict[str, str]] = []
    previous_section_last_node_id: Optional[str] = None

    for chapter_index, chapter in enumerate(toc.get("chapters", []), start=1):
        chapter_id = _ensure_str(chapter.get("id"))
        chapter_title = _ensure_str(chapter.get("title")) or f"Chapter {chapter_id}"

        for section_index, section in enumerate(chapter.get("sections", []), start=1):
            section_id = _ensure_str(section.get("id"))
            section_title = _ensure_str(section.get("title")) or f"Section {section_id}"
            section_slug = f"{course}/{chapter_id}/{section_id}"
            meta = load_section_meta(course, chapter_id, section_id) or {}
            concept_ids = meta.get("concept_ids") or [f"section_{chapter_id}_{section_id}"]
            section_node_ids: list[str] = []

            for concept_index, concept_id in enumerate(concept_ids, start=1):
                raw_mastery = mastery_data.get(concept_id, 0.1) if isinstance(mastery_data, dict) else 0.1
                p_known = _normalize_ratio(raw_mastery, 0.1)
                node_id = _ensure_str(concept_id) or f"section_{chapter_id}_{section_id}_{concept_index}"
                section_node_ids.append(node_id)

                nodes.append(
                    {
                        "id": node_id,
                        "label": _humanize_graph_label(concept_id),
                        "group": chapter_id,
                        "course": course,
                        "chapter": chapter_id,
                        "chapter_title": chapter_title,
                        "chapter_order": chapter_index,
                        "section_id": section_slug,
                        "section_title": section_title,
                        "section_order": section_index,
                        "concept_order": concept_index,
                        "p_known": round(p_known, 2),
                        "status": _build_graph_status(p_known),
                        "is_current": section_slug == current_section_id or node_id in current_concepts,
                    }
                )

            for source, target in zip(section_node_ids, section_node_ids[1:]):
                links.append({"source": source, "target": target})

            if previous_section_last_node_id and section_node_ids:
                links.append({"source": previous_section_last_node_id, "target": section_node_ids[0]})

            if section_node_ids:
                previous_section_last_node_id = section_node_ids[-1]

    nodes.sort(
        key=lambda node: (
            node.get("chapter_order", 0),
            node.get("section_order", 0),
            node.get("concept_order", 0),
        )
    )

    return {"nodes": nodes, "links": links}


@app.post("/api/mastery_graph")
async def generate_mastery_graph(request: MasteryGraphRequest):
    """Generates a node-link structured JSON representing current curriculum mastery."""
    try:
        return build_mastery_graph_payload(
            course=request.course,
            mastery_data=request.mastery_data,
            current_section_id=request.current_section_id,
            current_concepts=request.current_concepts,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mastery graph generation error: {str(e)}")

@app.post("/api/generate_scenario")
async def generate_scenario(request: ScenarioRequest):
    """Generate a dynamic scenario with a strictly enforced context to prevent hallucination."""
    try:
        api_key = get_api_key(request)
        if not api_key:
            raise HTTPException(status_code=400, detail="GEMINI_API_KEY is not set on the server or provided in the request.")
        
        import json
        client = genai.Client(api_key=api_key)

        prompt = f"""
        You are an expert instructional designer. Generate a tailored case study for the following theory/topic and context.
        Topic: {request.topic}
        Context/Constraint: {request.context}
        
        CRITICAL RULES:
        1. Base your explanation strictly on the widely accepted definition of {request.topic}.
        2. Do not hallucinate or invent new theories.
        3. Formulate a relatable, practical scenario applying this theory in the requested context.
        """
        
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                temperature=0.4,
                response_mime_type="application/json",
                response_schema={
                    "type": "OBJECT",
                    "properties": {
                        "scenario_text": {
                            "type": "STRING",
                            "description": "A vivid, practical case study scenario applying the theory."
                        },
                        "theoretical_mapping": {
                            "type": "STRING",
                            "description": "How the scenario maps to the key tenets of the theory."
                        }
                    },
                    "required": ["scenario_text", "theoretical_mapping"]
                }
            )
        )
        
        data = json.loads(response.text)
        
        return {
            "scenario_text": data.get("scenario_text", ""),
            "theoretical_mapping": data.get("theoretical_mapping", "")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scenario generation error: {str(e)}")

@app.get("/api/all-modules")
async def get_all_modules():
    """Get all bio-inspired modules."""
    return {
        "Bio-Inspired Design": [
            {"icon": m["icon"], "title": m["title"], "description": m["description"]}
            for m in BIO_INSPIRED_MODULES.values()
        ]
    }


# ============================================================================
# BOOK API (OpenStax-style content)
# ============================================================================

@app.get("/api/book/{course}/toc")
async def get_book_toc(course: str):
    """Get table of contents for a course."""
    try:
        toc = generate_toc(course)
        # If no content exists yet, return fallback
        if not toc.get("chapters"):
            toc = get_fallback_toc(course)
        return toc
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/book/{course}/{chapter}/{section}")
async def get_book_section(course: str, chapter: str, section: str):
    """Get content for a specific section."""
    try:
        section_data = load_section(course, chapter, section)
        if section_data.get("error"):
            raise HTTPException(status_code=404, detail="Section not found.")
        return section_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/book/generate_custom_module")
async def generate_custom_module(request: CurriculumGenerateRequest):
    """Dynamically generate and write a full textbook module from Lab context."""
    try:
        api_key = get_api_key(request)
        agent = CurriculumAgent(api_key=api_key)
        
        result = agent.generate_module(
            bio_context=request.biology_context,
            eng_context=request.engineering_application
        )
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
            
        slug = result.get("slug", "custom_module")
        slug = "".join(x for x in slug if x.isalnum() or x in "-_").lower()
        if not slug:
            slug = "custom_module"
            
        import json
        
        # Define directory
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        chapter_dir = os.path.join(base_dir, "frontend", "content", "bio-inspired", slug, "01")
        
        os.makedirs(chapter_dir, exist_ok=True)
        
        # Write files
        mdx_path = os.path.join(chapter_dir, "01.mdx")
        meta_path = os.path.join(chapter_dir, "01.meta.json")
        practice_path = os.path.join(chapter_dir, "01.practice.json")
        
        with open(mdx_path, "w", encoding="utf-8") as f:
            f.write(result.get("mdx_content", "Content generation failed."))
            
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(result.get("meta", {}), f, indent=4)
            
        with open(practice_path, "w", encoding="utf-8") as f:
            json.dump(result.get("practice", {"problems": []}), f, indent=4)
            
        return {
            "success": True,
            "course": "bio-inspired",
            "chapter": slug,
            "section": "01",
            "message": "Module successfully synthesized."
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# GRADING API
# ============================================================================

@app.get("/api/practice/{practice_id}")
async def get_practice(practice_id: str):
    """Get a practice problem by ID."""
    # For now, return a sample problem
    return {
        "id": practice_id,
        "type": "numeric",
        "statement": "Calculate the resultant force.",
        "expected_value": 100.0,
        "expected_unit": "N"
    }


@app.post("/api/grade/{problem_id}")
async def grade_submission(problem_id: str, request: GradeRequest):
    """Grade a problem submission."""
    try:
        # For development, use a sample problem definition
        # In production, this would load from database
        sample_problem = {
            "id": problem_id,
            "type": "numeric",
            "expected_value": 693.67,  # Sample: 50kg at 45° tension
            "expected_unit": "N",
            "tolerance": 0.02,
            "require_unit": True
        }
        
        result = grade_problem(sample_problem, request.answer, request.unit)
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Grading error: {str(e)}")


# ============================================================================
# ASSIST API (Rail)
# ============================================================================

@app.post("/api/assist/explain")
async def explain_easier(request: ExplainRequest):
    """Generate an easier explanation for the current concept."""
    try:
        # Use Gemini to generate explanation
        _key = get_api_key()
        if _key:
            from google import genai
            from google.genai import types
            
            client = genai.Client(api_key=_key)
            
            prompt = f"""
            A student is stuck on section: {request.section_id}
            Problem: {request.problem_id or 'General concept'}
            Stuck reason: {request.stuck_reason or 'Unknown'}
            
            Please provide a simpler, step-by-step explanation suitable for a struggling student.
            Use analogies and real-world examples. Be encouraging.
            Keep it concise (under 200 words).
            """
            
            response = client.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.7,
                    max_output_tokens=500
                )
            )
            
            return {"explanation": response.text}
        else:
            return {
                "explanation": "Let's break this down step by step:\n\n1. First, identify all forces acting on the object.\n2. Draw a free body diagram.\n3. Apply the equilibrium conditions (ΣF = 0).\n4. Solve for the unknown.\n\nRemember: when an object is in equilibrium, all forces must balance!"
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/assist/represent")
async def represent_differently(request: RepresentRequest):
    """Generate a different representation of the concept."""
    try:
        representations = {
            "mindmap": """
**Equilibrium Concept Map:**

                    EQUILIBRIUM
                        |
            +-----------+-----------+
            |           |           |
        ΣFx = 0     ΣFy = 0     ΣM = 0
            |           |           |
        Horizontal  Vertical    Moments
        Balance     Balance     Balance
            """,
            "analogy": """
**Real-World Analogy:**

Think of equilibrium like a game of tug-of-war where nobody moves.

🧍⟵ ← → ⟶🧍

When both teams pull with equal force, the rope stays still.
That's equilibrium! The net force is zero.

In engineering, we use this principle to design safe structures.
            """,
            "visual": """
**Visual Summary:**

    ↑ T (Tension)
    |
    |  θ
    +------ → 
    |
    ↓ W (Weight)

• Vertical: T·sin(θ) = W
• Horizontal: T·cos(θ) = Reaction
            """,
            "formula": """
**Key Formulas:**

1. **Equilibrium Conditions:**
   ΣFx = 0 (horizontal forces balance)
   ΣFy = 0 (vertical forces balance)
   ΣM = 0 (moments balance)

2. **For inclined cables:**
   Fx = T·cos(θ)
   Fy = T·sin(θ)

3. **Weight:**
   W = m·g = mass × 9.81 m/s²
            """
        }
        
        content = representations.get(
            request.representation_type,
            "Representation type not supported."
        )
        
        return {"content": content, "type": request.representation_type}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/stuck-events")
async def log_stuck_event(request: StuckEventRequest):
    """Log a stuck event for analytics."""
    print(f"[STUCK EVENT] User: {request.user_id}, Problem: {request.problem_id}, Reason: {request.reason}")
    return {"status": "logged"}


class PeerNoteRequest(BaseModel):
    text: str
    user_note: str
    section_id: str
    supabase_url: str
    supabase_anon_key: str
    api_key: str = ""

async def generate_and_insert_peer_note_task(req: PeerNoteRequest):
    """Background task to wait 3-4 mins, generate an AI peer response, and write to Supabase"""
    import asyncio
    import random
    import httpx
    
    # 1. Random delay between 3 to 4 minutes (180 to 240 seconds)
    # Using 10-20 seconds temporarily for testing if needed, but per request: 3-4 min
    delay = random.randint(180, 240)
    print(f"[AI PEER] Scheduled to generate response in {delay} seconds for section {req.section_id}...")
    await asyncio.sleep(delay)
    
    try:
        # 2. Check API Key
        _key = get_api_key(req)
        if not _key:
            print(f"[AI PEER ERR] No Gemini API Key configured. Skipping peer note.")
            return

        # 3. Generate content via GenAI SDK
        from google import genai
        client = genai.Client(api_key=_key)
        
        prompt = f"""You are acting as a fellow student 'Alex' taking this course at the University of Alabama.
        A student just highlighted the following text in the textbook:
        "{req.text}"
        
        And they wrote this note on it:
        "{req.user_note}"
        
        Provide a concise, constructive peer comment that expands on their thought or politely adds a new perspective.
        Keep it natural, conversational, and under 2 sentences. DO NOT sound like a robot."""
        
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt
        )
        ai_note = response.text.strip()
        
        # 4. Insert into Supabase via REST API using provided frontend credentials
        headers = {
            "apikey": req.supabase_anon_key,
            "Authorization": f"Bearer {req.supabase_anon_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }
        
        payload = {
            "user_id": "ai_peer_system_001",  # Fixed ID or string designating the AI peer
            "section_id": req.section_id,
            "text_content": req.text,
            "color": "green",  # Distinct color for peer notes
            "note": ai_note,
            "start_offset": 0,
            "end_offset": len(req.text)
        }
        
        async with httpx.AsyncClient() as client:
            res = await client.post(f"{req.supabase_url}/rest/v1/highlights", headers=headers, json=payload)
            if res.status_code >= 400:
                print(f"[AI PEER ERR] Failed to insert into Supabase: {res.text}")
            else:
                print(f"[AI PEER] Successfully injected peer note: {ai_note}")
                
    except Exception as e:
        print(f"[AI PEER ERR] Exception during background peer note generation: {e}")

from fastapi import BackgroundTasks

@app.post("/api/assist/peer_note")
async def schedule_peer_note(request: PeerNoteRequest, background_tasks: BackgroundTasks):
    """DISABLED: Stealth AI-as-peer injection.

    The original implementation generated an AI comment after a 3-4 minute
    delay and inserted it into the highlights table under a fixed user_id
    'ai_peer_system_001', visually indistinguishable from a real peer's note.
    This is deceptive social presence and violates ethical-AI disclosure
    norms (no fake humans without explicit labeling). Disabled 2026-04-26
    pending a redesign that (a) labels AI contributions in-UI and (b) is
    opt-in per learner.

    The background task body is preserved below for audit but no longer
    scheduled.
    """
    return {
        "status": "disabled",
        "reason": "stealth_peer_disabled_pending_disclosure_redesign",
    }


class ChatRequest(BaseModel):
    message: str
    section_id: str = "general"
    page_content: str = ""  # Current page MDX for RAG
    section_title: str = ""  # Current section title
    history: List[dict] = []
    api_key: str = ""  # optional client-provided override; ignored unless > 20 chars


def _course_persona_for_chat(section_id: str) -> tuple[str, str]:
    """Return (persona_name, domain_phrase) inferred from section_id slug.

    section_id is shaped like "course/chapter/section". Bio-inspired keeps the
    BigAL elephant persona because that course is UA-specific. Other courses
    get a generic, course-aware tutor persona to avoid the brand bleed flagged
    in the LXD audit.
    """
    course = (section_id or "").split("/", 1)[0].strip().lower()
    if course == "bio-inspired":
        return ("BigAL", "Bio-Inspired Design at the University of Alabama")
    if course == "inst-design":
        return ("Tutor", "Instructional Design and Educational Technology")
    if course == "ai-ethics":
        return ("Tutor", "AI Ethics, Governance, and Responsible Deployment")
    if course == "statics":
        return ("Tutor", "Engineering Statics")
    if course == "dynamics":
        return ("Tutor", "Engineering Dynamics")
    return ("Tutor", "the current learning section")


@app.post("/api/assist/chat")
async def chat_with_assistant(request: ChatRequest):
    """Chat with the AI learning assistant - RAG-enhanced with page content.

    DEPRECATED 2026-04-26: Both UI surfaces (ChatWidget floating bubble and
    IntelRail Ask launcher) now route through /api/orchestrate, which gives
    a single conversation thread, single history, and single persona path.
    This endpoint is kept for backward compatibility with any external
    integrations and for the no-API-key fallback message. Prefer /api/orchestrate
    for new clients.
    """
    print(f"[CHAT] Received chat request: {request.message[:50]}...")
    print(f"[CHAT] Section: {request.section_id}, Page content length: {len(request.page_content)} chars")

    persona_name, domain_phrase = _course_persona_for_chat(request.section_id)

    # Build conversation history for context
    history_text = ""
    for msg in request.history[-6:]:  # Last 6 messages
        role = "Student" if msg.get("role") == "user" else "Assistant"
        history_text += f"{role}: {msg.get('content', '')}\n"

    # Truncate page content to fit context window
    page_context = (request.page_content or "")[:4000]
    is_first_message = len(request.history) == 0

    prompt = f"""You are {persona_name}, a supportive tutor for {domain_phrase}.

REFERENCE MATERIAL (from current page):
---
{page_context if page_context else "No specific page content available."}
---

Conversation so far:
{history_text if history_text else "(This is the start of our chat)"}

Student: {request.message}

RESPONSE GUIDELINES:
{"- Since this is your FIRST message, briefly greet them (one short sentence)." if is_first_message else "- DO NOT introduce yourself again or repeat greetings - just continue the conversation naturally."}
- Keep responses SHORT: 1-3 sentences max.
- Be helpful and conversational, not formal.
- Ask ONE follow-up question to keep the dialogue going.
- Reference the page material naturally when relevant.
- NO long explanations — be punchy.

{persona_name}:"""

    # Configure Gemini API — accept request-provided key, fall back to env vars
    _key = get_api_key(request)
    if not _key:
        print("[CHAT ERROR] No API key configured!")
        return {
            "response": (
                "The tutor is not configured yet on this server. "
                "Set GEMINI_API_KEY on the backend or provide a key in the client."
            ),
            "error": "no_api_key",
        }

    try:
        print("[CHAT] Calling Gemini API with RAG context...")
        client = genai.Client(api_key=_key)
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt,
            config=genai_types.GenerateContentConfig(temperature=0.7)
        )
        print(f"[CHAT] Response received: {response.text[:100]}...")
        return {"response": response.text}
    except Exception as exc:
        # Surface the failure class so the UI can distinguish auth vs network vs
        # model errors instead of always blaming the network.
        msg = str(exc)
        if "API_KEY_INVALID" in msg or "API key not valid" in msg or "API Key not found" in msg:
            print(f"[CHAT ERROR] Auth failure: {msg[:200]}")
            return {
                "response": "The tutor's credentials are not valid. The administrator needs to update the API key.",
                "error": "auth_failed",
            }
        if "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower() or "rate" in msg.lower():
            print(f"[CHAT ERROR] Quota/rate limit: {msg[:200]}")
            return {
                "response": "The tutor is briefly over its usage quota. Please try again in a minute.",
                "error": "rate_limited",
            }
        print(f"[CHAT ERROR] Unexpected exception: {msg[:300]}")
        return {
            "response": "I'm having trouble connecting right now. Please try again in a moment.",
            "error": "upstream_failure",
        }

@app.get("/api/debug_env")
async def debug_env():
    """Temporary endpoint to check which env vars exist."""
    gemini = os.environ.get("GEMINI_API_KEY", "")
    google = os.environ.get("GOOGLE_API_KEY", "")
    return {
        "gemini_len": len(gemini),
        "gemini_startswith": gemini[:4] if len(gemini) > 4 else gemini,
        "google_len": len(google)
    }


# debug_env endpoint removed

# ============================================================================
# IMAGE GENERATION API (Gemini)
# ============================================================================

class ImageGenerateRequest(BaseModel):
    prompt: str
    context: Optional[str] = None  # Section context
    style: str = "technical"  # technical, diagram, fbd, concept
    api_key: str = ""

@app.post("/api/generate-image")
async def generate_image(request: ImageGenerateRequest):
    """Generate a diagram or illustration using Gemini API."""
    try:
        _key = get_api_key()
        if not _key:
            return {
                "success": False,
                "error": "Gemini API key not configured",
                "placeholder": True,
                "message": "Image generation unavailable - please configure GEMINI_API_KEY"
            }
        
        from google import genai
        from google.genai import types
        import base64
        
        client = genai.Client(api_key=_key)
        
        # Build the image generation prompt
        style_guides = {
            "technical": "Create a clean, professional engineering diagram. Use simple lines, clear labels, and minimal colors (black, blue, red for forces). White background.",
            "diagram": "Create a clear educational diagram suitable for a textbook. Include labels and arrows.",
            "fbd": "Create a free body diagram showing all forces as arrows with labels. Use a simple dot or box for the object. Include coordinate axes.",
            "concept": "Create a concept illustration that visually explains the physics concept. Use intuitive visuals and metaphors."
        }
        
        style_instruction = style_guides.get(request.style, style_guides["technical"])
        
        full_prompt = f"""
{style_instruction}

Subject: {request.prompt}

Context: {request.context or 'Engineering statics textbook'}

Requirements:
- Clean, professional appearance suitable for an engineering textbook
- Clear labels for all components
- Use standard engineering notation
- High readability and clarity
"""
        
        # Use Gemini's image generation (Imagen 3)
        try:
            response = client.models.generate_images(
                model='imagen-3.0-generate-002',
                prompt=full_prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio="16:9",
                    safety_filter_level="BLOCK_ONLY_HIGH"
                )
            )
            
            # Get the generated image
            if response.generated_images:
                image = response.generated_images[0]
                # Convert to base64 for frontend
                image_base64 = base64.b64encode(image.image.image_bytes).decode('utf-8')
                
                return {
                    "success": True,
                    "image_data": f"data:image/png;base64,{image_base64}",
                    "prompt": request.prompt
                }
            else:
                return {
                    "success": False,
                    "error": "No image generated",
                    "message": "Try a different prompt"
                }
                
        except Exception as img_error:
            # Fallback to text description if image generation fails
            print(f"[IMAGE GEN] Image generation failed: {img_error}")
            
            # Generate a text-based diagram description instead
            response = client.models.generate_content(
                model='gemini-2.0-flash',
                contents=f"Describe in detail what a {request.style} diagram for '{request.prompt}' would look like. Include ASCII art if helpful.",
                config=types.GenerateContentConfig(
                    temperature=0.5,
                    max_output_tokens=500
                )
            )
            
            return {
                "success": False,
                "fallback": True,
                "description": response.text,
                "message": "Image generation unavailable, providing text description"
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image generation error: {str(e)}")


# ============================================================================
# EVENT LOG SINK (sendBeacon receiver for page-unload telemetry flush)
# ============================================================================


class LogEventsRequest(BaseModel):
    events: List[dict]
    supabase_url: str
    supabase_anon_key: str
    access_token: Optional[str] = None


@app.post("/api/log-events")
async def log_events_proxy(request: LogEventsRequest):
    if not request.events:
        return {"status": "noop", "inserted": 0}

    import httpx

    auth_token = request.access_token or request.supabase_anon_key
    headers = {
        "apikey": request.supabase_anon_key,
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                f"{request.supabase_url}/rest/v1/event_logs",
                headers=headers,
                json=request.events,
            )
        if res.status_code >= 400:
            print(f"[LOG_EVENTS] Supabase REST {res.status_code}: {res.text[:200]}")
            raise HTTPException(status_code=res.status_code, detail="event_logs insert failed")
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[LOG_EVENTS] proxy error: {exc}")
        raise HTTPException(status_code=502, detail=str(exc))

    return {"status": "ok", "inserted": len(request.events)}


# ============================================================================
# GENERATIVE-TIER ENDPOINTS (Practice / Explanation with optional Critique gate)
# ============================================================================


class PracticeGenerateRequest(BaseModel):
    section_id: str
    concept_id: str
    section_content: str = ""
    learner_state: dict = Field(default_factory=dict)
    bloom_level: str = "apply"
    history: list = Field(default_factory=list)
    api_key: str = ""
    run_critique: bool = True


@app.post("/api/practice/generate")
async def practice_generate(request: PracticeGenerateRequest):
    """Generate one targeted practice item, optionally vetted by CritiqueAgent.

    Pipeline: PracticeGenerationAgent → (optional CritiqueAgent gate). If the
    critique fails, regenerate once with the critique notes folded into the
    learner_state and pick the higher-scoring of the two. The whole flow is
    schema-gated so a generative failure produces a structured no-op.
    """
    try:
        api_key = get_api_key(request)
        # Direct instantiation (was previously building the entire 15-agent
        # OrchestratorAgent per request, ~15x wasted constructor cost).
        from agents.practice_generation_agent import PracticeGenerationAgent
        from agents.critique_agent import CritiqueAgent
        practice_agent = PracticeGenerationAgent(api_key=api_key)
        critic = CritiqueAgent(api_key=api_key) if request.run_critique else None

        item = practice_agent.generate_item(
            section_content=request.section_content,
            concept_id=request.concept_id,
            learner_state=request.learner_state,
            bloom_level=request.bloom_level,
            history=request.history,
        )

        critique = None
        if critic and not item.get("_schema_error"):
            ground_truth = []
            try:
                rag_contexts = rag_service.retrieve_context(
                    f"{request.concept_id} {request.bloom_level}", top_k=2
                )
                ground_truth = [str(ctx.get("content", ""))[:1000] for ctx in (rag_contexts or [])]
            except Exception:
                ground_truth = [request.section_content[:2000]] if request.section_content else []

            critique = critic.review(
                agent_name="PracticeGenerationAgent",
                output_payload=item,
                ground_truth_excerpts=ground_truth,
            )

            if not critique.get("passes") and not critique.get("_schema_error"):
                hint_state = dict(request.learner_state or {})
                hint_state["critique_notes"] = critique.get("issues", [])
                second_item = practice_agent.generate_item(
                    section_content=request.section_content,
                    concept_id=request.concept_id,
                    learner_state=hint_state,
                    bloom_level=request.bloom_level,
                    history=request.history,
                )
                second_critique = critic.review(
                    agent_name="PracticeGenerationAgent",
                    output_payload=second_item,
                    ground_truth_excerpts=ground_truth,
                )
                if second_critique.get("score", 0) > critique.get("score", 0):
                    item = second_item
                    critique = second_critique

        return {"item": item, "critique": critique, "section_id": request.section_id}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Practice generation error: {exc}")


class ExplanationRequest(BaseModel):
    section_id: str
    concept_id: str
    section_content: str = ""
    learner_state: dict = Field(default_factory=dict)
    target_length: str = "short"
    history: list = Field(default_factory=list)
    api_key: str = ""
    run_critique: bool = False


@app.post("/api/explain")
async def explain(request: ExplanationRequest):
    """Generate a short, course-aware explanation; optional Critique gate."""
    try:
        api_key = get_api_key(request)
        from agents.explanation_agent import ExplanationAgent
        from agents.critique_agent import CritiqueAgent
        explanation_agent = ExplanationAgent(api_key=api_key)
        critic = CritiqueAgent(api_key=api_key) if request.run_critique else None

        result = explanation_agent.explain(
            concept_id=request.concept_id,
            section_content=request.section_content,
            learner_state=request.learner_state,
            target_length=request.target_length,
            history=request.history,
        )

        critique = None
        if critic and not result.get("_schema_error"):
            critique = critic.review(
                agent_name="ExplanationAgent",
                output_payload=result,
                ground_truth_excerpts=[request.section_content[:2000]] if request.section_content else [],
            )

        return {"explanation": result, "critique": critique, "section_id": request.section_id}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Explanation error: {exc}")


# ============================================================================
# RUN SERVER
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)

