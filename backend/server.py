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

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import Any, List, Literal, Optional
import json
import sys
import os
import math
import re
import logging
import uuid
import secrets
import httpx

logger = logging.getLogger(__name__)

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
from content_service import (
    load_section,
    load_section_meta,
    generate_toc,
    get_fallback_toc,
    load_practice_for_section,
    find_misconception,
    content_version_for_section_id,
    fetch_item_stats,
)
from grading_service import grade_problem
from rag_service import rag_service
from agents.assessment_agent import AssessmentAgent
from admin_control import AGENT_MANIFEST, MAX_PDF_BYTES, build_governed_course_plan, convert_pdf_bytes
from knowledge_tracing import (
    BayesianKnowledgeTracing,
    select_support_move,
    reason_codes_are_faithful,
    REASON_CODE_FEATURES,
    ANNOTATION_REASON_CODES,
)

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

    # Guard: every solver_id referenced by content must resolve in the
    # solver registry, otherwise a practice problem would silently fall
    # through to a wrong grader.
    try:
        from content_service import assert_content_solver_ids_resolve
        assert_content_solver_ids_resolve()
        print("[INFO] Solver registry check passed: all content solver_ids resolve.")
    except AssertionError as exc:
        print(f"[ERROR] Solver registry check FAILED: {exc}")
        raise
    except Exception as exc:  # pragma: no cover - non-fatal if solvers unimportable
        print(f"[WARN] Solver registry check skipped: {exc}")

    yield


# Initialize FastAPI
app = FastAPI(
    title="UA Intelligent Textbook API",
    description="Backend for AI-powered engineering learning",
    version="2.0.0",
    lifespan=app_lifespan,
)

# CORS for React frontend. Keep local dev convenient, but avoid credentialed
# wildcard CORS in deployed environments. Add comma-separated extra origins via
# ALGET_ALLOWED_ORIGINS when staging domains are introduced.
_allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "https://alget.vercel.app",
    "https://alget.pages.dev",
]
_allowed_origins.extend(
    origin.strip()
    for origin in os.environ.get("ALGET_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
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
    section_id: Optional[str] = None  # "course/chapter/section"
    selected_option: Optional[int] = None

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


class AdminCoursePlanRequest(BaseModel):
    course_id: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9][a-z0-9-]*$")
    source_id: str = Field(min_length=2, max_length=128)


class AdminInstructorInviteRequest(BaseModel):
    email: str = Field(min_length=5, max_length=320)
    display_name: str = Field(min_length=2, max_length=120)
    redirect_url: Optional[str] = Field(default=None, max_length=500)

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
    annotation_questions: int = 0
    annotation_confusions: int = 0
    annotation_insights: int = 0
    annotation_connections: int = 0
    annotation_helpful_reactions: int = 0
    artifact_trace_count: int = 0
    artifact_quality_average: float = 0.0
    artifact_trace_completeness: float = 0.0


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


class AdaptiveAnnotationSignal(BaseModel):
    """A single social-annotation signal fed into the live policy.

    type: annotation TYPE (question, confusion, insight, connection, ...).
    quote_section_id: the section the annotated quote belongs to. When this
    matches the current section, the annotation carries section-overlap weight
    (it is about THIS reading, not the book at large).
    """

    type: str = ""
    quote_section_id: Optional[str] = None
    count: int = 1


class AdaptiveArtifactRevisionScore(BaseModel):
    """Scored before/after artifact-revision features fed into the live policy.

    quality is the after-revision rubric quality [0,1]; delta is the
    after-minus-before change in quality (negative = regression).
    """

    artifact_quality: float = 0.0
    artifact_gap: float = 0.0
    revision_delta: float = 0.0
    section_id: Optional[str] = None


class AdaptiveRecommendationRequest(BaseModel):
    section_id: str
    section_title: str = ""
    concept_ids: list[str] = Field(default_factory=list)
    current_heading: str = ""
    stuck_reason: Optional[str] = None
    mastery: list[AdaptiveMasteryState] = Field(default_factory=list)
    telemetry: AdaptiveTelemetrySummary = Field(default_factory=AdaptiveTelemetrySummary)
    learner_profile: AdaptiveLearnerProfile = Field(default_factory=AdaptiveLearnerProfile)
    # Social-annotation family (TYPE + quote-section overlap) fed INTO the policy.
    annotation_signals: list[AdaptiveAnnotationSignal] = Field(default_factory=list)
    # Scored before/after artifact-revision features fed INTO the policy.
    artifact_revision_scores: list[AdaptiveArtifactRevisionScore] = Field(default_factory=list)
    # RQ4 ablation flag: run the policy with annotation signals ON vs OFF.
    annotation_adaptive: bool = True
    # Identity for persisting the decision as reusable RCT data (optional).
    learner_id: Optional[str] = None
    session_id: Optional[str] = None
    # Optional Supabase credentials so the server can persist the decision at
    # generation time. When absent the decision is still persisted in-process so
    # the provenance read endpoint works offline / in tests.
    supabase_url: Optional[str] = None
    supabase_anon_key: Optional[str] = None


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
    policy_mode: str = "annotation_adaptive"
    reason_codes: list[str] = Field(default_factory=list)
    recommended_because: list[str] = Field(default_factory=list)
    not_recommended_because: list[str] = Field(default_factory=list)
    evidence_snapshot: dict[str, Any] = Field(default_factory=dict)
    action_scores: dict[str, float] = Field(default_factory=dict)
    predicted_outcomes: dict[str, dict[str, float]] = Field(default_factory=dict)
    candidate_actions: list[str] = Field(default_factory=list)
    rejected_actions: list[str] = Field(default_factory=list)


class PrerequisiteHint(BaseModel):
    concept_id: str
    suggested_section_slug: str
    reason: str


class AdaptiveRecommendationResponse(BaseModel):
    section_id: str
    decision_id: str = ""
    policy_mode: str = "annotation_adaptive"
    learner_state: LearnerStateSummary
    primary_recommendation: AdaptiveRecommendationCard
    secondary_recommendations: list[AdaptiveRecommendationCard] = Field(default_factory=list)
    reasoning: AdaptiveRecommendationReasoning
    needs_prerequisite: Optional[PrerequisiteHint] = None


class ResearchEvaluationItem(BaseModel):
    item_id: str
    concept_id: Optional[str] = None
    is_correct: bool = False
    selected_option: Optional[int] = None
    correct_index: Optional[int] = None
    confidence: Optional[float] = None
    latency_ms: Optional[int] = None
    response_payload: dict[str, Any] = Field(default_factory=dict)


class ResearchEvaluationValidationRequest(BaseModel):
    course: str
    phase: Literal["pre", "post", "retention"]
    score: int
    percentage: float
    total_questions: int
    item_responses: list[ResearchEvaluationItem] = Field(default_factory=list)


class ArtifactTraceValidationRequest(BaseModel):
    course: str = ""
    section: str = ""
    artifact: str = ""
    support_move: str = "explain"
    recommended_support_move: Optional[str] = None
    initial_draft_length: int = 0
    claim_length: int = 0
    evidence_length: int = 0
    accepted_length: int = 0
    rejected_length: int = 0
    judgment_rationale_length: int = 0
    revised_draft_length: int = 0
    transfer_length: int = 0
    trace_score: int = 0
    trace_denominator: int = 8
    artifact_quality_score: float = 0.0
    rubric: dict[str, Any] = Field(default_factory=dict)
    confidence: int = 1


class ArtifactRevisionScoreRequest(BaseModel):
    course: str = ""
    section: str = ""
    artifact: str = ""
    studio_mode: str = ""
    initial_draft: str = ""
    revised_draft: str = ""
    claim: str = ""
    evidence: str = ""
    judgment: Literal["accept", "modify", "reject", "defer"] = "modify"
    judgment_rationale: str = ""
    transfer: str = ""


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


# ---------------------------------------------------------------------------
# Server-persisted adaptive-decision provenance.
#
# Every adaptive recommendation is persisted SERVER-SIDE at generation time
# (not via a client upsert) so the evidence -> decision mapping is reusable as
# RCT data and a client can later attach an outcome/accepted label. The
# in-process store guarantees the 'why this support now' read endpoint works
# offline and in tests; when Supabase credentials are supplied the same record
# is best-effort written to the canonical recommendation_decisions table.
# ---------------------------------------------------------------------------
_ADAPTIVE_DECISION_STORE: "dict[str, dict[str, Any]]" = {}
_ADAPTIVE_DECISION_ORDER: list[str] = []
_ADAPTIVE_DECISION_CAP = 500


def _store_adaptive_decision(record: dict[str, Any]) -> None:
    """Persist a decision record in-process, capped to avoid unbounded growth."""
    decision_id = record.get("decision_id")
    if not decision_id:
        return
    _ADAPTIVE_DECISION_STORE[decision_id] = record
    _ADAPTIVE_DECISION_ORDER.append(decision_id)
    while len(_ADAPTIVE_DECISION_ORDER) > _ADAPTIVE_DECISION_CAP:
        oldest = _ADAPTIVE_DECISION_ORDER.pop(0)
        _ADAPTIVE_DECISION_STORE.pop(oldest, None)


def get_adaptive_decision(decision_id: str) -> Optional[dict[str, Any]]:
    return _ADAPTIVE_DECISION_STORE.get(decision_id)


async def _persist_decision_to_supabase(
    record: dict[str, Any],
    supabase_url: Optional[str],
    supabase_anon_key: Optional[str],
) -> bool:
    """Best-effort write of the decision record to Supabase. Never raises:
    a persistence backend failure must not break the live recommendation.
    """
    if not supabase_url or not supabase_anon_key:
        return False
    import httpx

    def maybe_uuid(value: Any) -> Optional[str]:
        try:
            return str(uuid.UUID(str(value)))
        except (TypeError, ValueError):
            return None

    decision_id = str(record.get("decision_id") or uuid.uuid4())
    canonical_record = {
        "id": decision_id,
        "trace_id": decision_id,
        "user_id": maybe_uuid(record.get("learner_id")),
        "course_id": record.get("course"),
        "section_id": record.get("section_id") or "unknown",
        "concept_ids": [],
        "chosen_action": record.get("selected_action"),
        "learner_state_snapshot": {
            "learner_id": record.get("learner_id"),
            "session_id": record.get("session_id"),
            "policy_mode": record.get("policy_mode"),
            "policy_strategy": record.get("policy_strategy"),
            "annotation_adaptive": record.get("annotation_adaptive"),
            "content_version": record.get("content_version"),
            "content_version_algorithm": record.get("content_version_algorithm"),
            "source": record.get("source") or "fastapi",
        },
        "candidate_actions": record.get("candidate_actions") or [],
        "evidence_snapshot": record.get("evidence_snapshot") or {},
        "explanation_snapshot": {
            "reason_codes": record.get("reason_codes") or [],
            "selected_action": record.get("selected_action"),
            "rejected_actions": record.get("rejected_actions") or [],
            "outcome": record.get("outcome"),
            "accepted": record.get("accepted"),
        },
        "policy_score": record.get("action_scores") or {},
    }

    headers = {
        "apikey": supabase_anon_key,
        "Authorization": f"Bearer {supabase_anon_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                f"{supabase_url.rstrip('/')}/rest/v1/recommendation_decisions",
                headers=headers,
                json=canonical_record,
            )
        return 200 <= res.status_code < 300
    except Exception as exc:  # pragma: no cover - network failure path
        logger.warning("recommendation_decisions persist failed: %s", exc)
        return False


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
    # ---- Social-annotation family (TYPE + quote-section overlap) ----------
    # Start from the aggregate telemetry counts, then fold in the per-annotation
    # signals carrying TYPE and the section the annotated quote belongs to. An
    # annotation whose quote_section_id matches the current section is weighted
    # more heavily: it is about THIS reading, not the book at large.
    annotation_question_count = telemetry.annotation_questions
    annotation_confusion_count = telemetry.annotation_confusions
    annotation_insight_count = telemetry.annotation_insights
    annotation_connection_count = telemetry.annotation_connections
    friction_overlap_hits = 0
    friction_total_hits = 0
    for signal in request.annotation_signals:
        sig_type = _ensure_str(signal.type).lower()
        count = max(0, signal.count)
        if not count:
            continue
        in_section = bool(
            signal.quote_section_id
            and _ensure_str(signal.quote_section_id) == _ensure_str(request.section_id)
        )
        if sig_type in {"question", "confusion", "stuck"}:
            annotation_question_count += count if sig_type == "question" else 0
            annotation_confusion_count += count if sig_type in {"confusion", "stuck"} else 0
            friction_total_hits += count
            if in_section:
                friction_overlap_hits += count
        elif sig_type in {"insight", "connection", "aha", "summary"}:
            annotation_insight_count += count if sig_type in {"insight", "aha"} else 0
            annotation_connection_count += count if sig_type in {"connection", "summary"} else 0

    # quote-section overlap: fraction of friction annotations anchored to the
    # current section (0 when there are no per-annotation friction signals).
    annotation_section_overlap = (
        clamp(friction_overlap_hits / friction_total_hits, 0.0, 1.0)
        if friction_total_hits
        else 0.0
    )

    annotation_friction = clamp(
        _normalize_signal(annotation_question_count + annotation_confusion_count * 2, 6)
        + min(0.2, telemetry.annotation_helpful_reactions * 0.03),
        0.0,
        1.0,
    )
    annotation_momentum = clamp(
        _normalize_signal(annotation_insight_count + annotation_connection_count, 5),
        0.0,
        1.0,
    )

    # ---- Scored artifact-revision family ----------------------------------
    # Telemetry carries running averages; the explicit per-revision scores (when
    # present) carry the most recent before/after rubric quality and the
    # after-minus-before delta. We prefer in-section scores, falling back to the
    # latest available, and fuse with the telemetry aggregate.
    artifact_quality = _normalize_ratio(telemetry.artifact_quality_average, 0.0)
    artifact_completeness = _normalize_ratio(telemetry.artifact_trace_completeness, 0.0)
    artifact_revision_delta = 0.0
    has_artifact_signal = bool(telemetry.artifact_trace_count) or bool(request.artifact_revision_scores)
    if request.artifact_revision_scores:
        in_section_scores = [
            s for s in request.artifact_revision_scores
            if s.section_id and _ensure_str(s.section_id) == _ensure_str(request.section_id)
        ]
        chosen = in_section_scores or request.artifact_revision_scores
        latest = chosen[-1]
        # Fuse latest scored revision quality with the telemetry aggregate.
        scored_quality = _normalize_ratio(latest.artifact_quality, 0.0)
        artifact_quality = max(artifact_quality, scored_quality)
        # gap can be supplied directly; otherwise derive from quality.
        if latest.artifact_gap:
            artifact_completeness = max(artifact_completeness, 1.0 - _normalize_ratio(latest.artifact_gap, 0.0))
        artifact_revision_delta = clamp(latest.revision_delta, -1.0, 1.0)
    artifact_gap = (
        clamp(1 - max(artifact_quality, artifact_completeness * 0.6), 0.0, 1.0)
        if has_artifact_signal
        else 0.0
    )
    unit_signal = 1.0 if "unit" in _ensure_str(request.stuck_reason).lower() else 0.0
    idle_signal = 1.0 if "idle" in _ensure_str(request.stuck_reason).lower() else 0.0

    readiness: Literal["support", "practice", "advance"] = "support"
    if average_mastery >= 0.8 and frustration_index <= 1 and artifact_gap <= 0.25 and (correct_ratio >= 0.75 or positive_momentum >= 3):
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
    if telemetry.annotation_questions or telemetry.annotation_confusions:
        evidence.append(
            f"Annotation friction is visible: {telemetry.annotation_questions} questions and {telemetry.annotation_confusions} confusion notes."
        )
    if telemetry.annotation_insights or telemetry.annotation_connections:
        evidence.append(
            f"Annotation momentum is visible: {telemetry.annotation_insights} insights and {telemetry.annotation_connections} connections."
        )
    if telemetry.artifact_trace_count:
        evidence.append(
            f"Artifact trace quality is {artifact_quality:.0%} with trace completeness {artifact_completeness:.0%}."
        )
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

    # ---- Fuse the three signal families into ONE policy decision -----------
    # The feature vector below is the single, auditable basis for selection. It
    # bundles (1) KT/telemetry, (2) scored artifact-revision, and (3) social-
    # annotation features. select_support_move() applies the support-move
    # weights, honors the annotation ablation flag, and returns the candidate
    # actions, the selected action, the rejected actions, and reason_codes
    # derived FROM these same features.
    feature_vector: dict[str, Any] = {
        "mastery_gap": round(mastery_gap, 4),
        "average_mastery": round(average_mastery, 4),
        "friction_signal": round(friction_signal, 4),
        "frustration_index": frustration_index,
        "accuracy_gap": round(accuracy_gap, 4),
        "uncertainty_signal": round(uncertainty_signal, 4),
        "correct_ratio": round(correct_ratio, 4),
        "forgetting_risk": round(forgetting_risk, 4),
        "calibration_drift": round(calibration_drift, 4),
        "transfer_readiness": round(transfer_readiness, 4),
        "stability_index": round(stability_index, 4),
        "predicted_next_correct": round(predicted_next_correct, 4),
        "predicted_retention": round(predicted_retention, 4),
        "misconception_pressure": round(misconception_pressure, 4),
        "engagement_signal": round(engagement_signal, 4),
        "support_fatigue": round(support_fatigue, 4),
        "chat_signal": round(chat_signal, 4),
        "unit_signal": unit_signal,
        "idle_signal": idle_signal,
        "no_stuck_reason": 0.0 if request.stuck_reason else 1.0,
        # Family (2): scored artifact-revision features.
        "artifact_quality": round(artifact_quality, 4),
        "artifact_gap": round(artifact_gap, 4),
        "artifact_revision_delta": round(artifact_revision_delta, 4),
        # Family (3): social-annotation features.
        "annotation_friction": round(annotation_friction, 4),
        "annotation_momentum": round(annotation_momentum, 4),
        "annotation_section_overlap": round(annotation_section_overlap, 4),
    }

    decision = select_support_move(
        feature_vector,
        annotation_adaptive=request.annotation_adaptive,
        prefer_advance=(readiness == "advance"),
    )
    policy_mode = decision["policy_mode"]
    action_scores = decision["action_scores"]
    primary_action = decision["selected_action"]
    rejected_actions = decision["rejected_actions"]
    policy_reason_codes = decision["reason_codes"]
    ranked_actions = sorted(action_scores.items(), key=lambda item: item[1], reverse=True)
    if primary_action != ranked_actions[0][0]:
        ranked_actions = sorted(
            action_scores.items(),
            key=lambda item: (item[0] != primary_action, -item[1]),
        )
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

    # reason_codes come from the policy core so they FAITHFULLY reflect the
    # features that drove the selection (and so the annotation ablation flag
    # actually removes annotation-derived codes). recommended_because renders
    # each code as user-facing prose.
    reason_codes: list[str] = list(policy_reason_codes)
    _reason_prose = {
        "unit_mismatch": "A unit mismatch is present, which strongly favors direct conceptual repair.",
        "idle_reengagement": "The learner paused long enough that a lighter re-entry move is justified.",
        "low_mastery": "Average mastery is still below the stability band for fluent application.",
        "high_friction": "Recent stuck and wrong-answer signals indicate substantial friction in this section.",
        "retrieval_risk": "Forgetting risk is elevated, so the engine favors retrieval-supportive actions.",
        "calibration_gap": "Confidence and correctness are diverging, which makes unsupported advancement risky.",
        "misconception_pattern": "Misconception tags are clustering around the same idea, so the engine is correcting the frame instead of repeating the task.",
        "annotation_friction": "Peer/self annotations contain question or confusion signals, so support is being selected from reading evidence, not only quiz data.",
        "annotation_section_focus": "Annotations anchored to this exact section show the friction is about this reading, so the engine targets it directly.",
        "artifact_quality_gap": "Artifact trace quality or completeness is still weak, so the engine is holding back unsupported advancement.",
        "artifact_revision_regression": "The latest artifact revision scored lower than the prior draft, so the engine repairs before advancing.",
        "artifact_annotation_momentum": "Annotation and artifact traces show enough momentum to favor practice or advancement.",
        "transfer_ready": "Transfer readiness is strong enough that application-oriented moves are likely to pay off.",
        "balanced_profile": "No single risk dominated, so the action was chosen by the best overall score across mastery, friction, and transfer.",
    }
    recommended_because: list[str] = [
        _reason_prose[code] for code in reason_codes if code in _reason_prose
    ]
    not_recommended_because: list[str] = []

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

    # The evidence_snapshot is the AUDITABLE basis for the decision. It starts
    # from the policy core's effective feature vector (so every reason_code maps
    # to a feature present here) and adds human-facing context fields.
    evidence_snapshot: dict[str, Any] = dict(decision["evidence_snapshot"])
    evidence_snapshot.update(
        {
            "lowest_concept": lowest_concept,
            "lowest_score": round(lowest_score, 3) if lowest_concept else None,
            "practice_accuracy": round(correct_ratio, 3),
            "confidence_average": round(_normalize_ratio(learner_profile.average_confidence, 0.5), 3),
            "dominant_misconception": learner_profile.misconception_patterns[0].type if learner_profile.misconception_patterns else None,
            "artifact_trace_completeness": round(artifact_completeness, 3),
            "annotation_signal_count": len(request.annotation_signals),
            "artifact_revision_score_count": len(request.artifact_revision_scores),
        }
    )

    final_reason_codes = reason_codes[:5]
    # FAITHFULNESS SELF-CHECK: every reason_code must correspond to at least one
    # feature present in the evidence_snapshot. This guarantees the persisted
    # evidence -> decision mapping is honest (no code without backing evidence).
    assert reason_codes_are_faithful(final_reason_codes, evidence_snapshot), (
        f"Unfaithful reason_codes {final_reason_codes} for snapshot keys "
        f"{sorted(evidence_snapshot.keys())}"
    )

    import uuid
    import time

    # Content-version provenance (additive): stamp the stable hash of the exact
    # content this decision was made against, so every decision references the
    # precise content version. Computed best-effort; a missing/malformed section
    # slug degrades to None and never blocks the decision.
    content_version_descriptor = content_version_for_section_id(request.section_id)

    decision_id = str(uuid.uuid4())
    decision_record: dict[str, Any] = {
        "decision_id": decision_id,
        "created_at": time.time(),
        "section_id": request.section_id,
        "content_version": (
            content_version_descriptor.get("content_version")
            if content_version_descriptor
            else None
        ),
        "content_version_algorithm": (
            content_version_descriptor.get("algorithm")
            if content_version_descriptor
            else None
        ),
        "learner_id": request.learner_id,
        "session_id": request.session_id,
        "policy_mode": policy_mode,
        "policy_strategy": "heuristic_bandit_v2",
        "candidate_actions": decision["candidate_actions"],
        "selected_action": primary_action,
        "rejected_actions": rejected_actions,
        "action_scores": action_scores,
        "reason_codes": final_reason_codes,
        "evidence_snapshot": evidence_snapshot,
        "annotation_adaptive": request.annotation_adaptive,
        "outcome": None,
        "accepted": None,
    }
    _store_adaptive_decision(decision_record)

    response = AdaptiveRecommendationResponse(
        section_id=request.section_id,
        decision_id=decision_id,
        policy_mode=policy_mode,
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
            policy_mode=policy_mode,
            reason_codes=final_reason_codes,
            recommended_because=recommended_because[:4],
            not_recommended_because=not_recommended_because[:4],
            evidence_snapshot=evidence_snapshot,
            action_scores=action_scores,
            predicted_outcomes=predicted_outcomes,
            candidate_actions=decision["candidate_actions"],
            rejected_actions=rejected_actions,
        ),
    )
    return response


def validate_access_passcode(scope: Literal["engineering", "education", "researcher"], passcode: str) -> bool:
    env_key_by_scope = {
        "engineering": "ENGINEERING_ACCESS_CODE",
        "education": "EDUCATION_ACCESS_CODE",
        "researcher": "RESEARCHER_ACCESS_CODE",
    }
    raw_configured = os.environ.get(env_key_by_scope[scope], "")
    malformed = any(ord(character) < 32 or ord(character) == 127 for character in raw_configured)
    configured = raw_configured.strip()
    if not configured or malformed:
        return False
    candidate = passcode.strip()
    return candidate.lower() == configured.lower()


ARTIFACT_RUBRIC_KEYS = [
    "claim_visibility",
    "evidence_specificity",
    "support_boundary",
    "revision_quality",
    "rejection_rationale",
    "transfer_constraint",
]


def _clamp_int(value: Any, low: int, high: int) -> int:
    try:
        numeric = int(value)
    except (TypeError, ValueError):
        numeric = low
    return max(low, min(high, numeric))


def _research_support_move(trace_score: int) -> str:
    if trace_score <= 3:
        return "explain"
    if trace_score <= 6:
        return "compare"
    return "audit"


def validate_research_evaluation_payload(request: ResearchEvaluationValidationRequest) -> dict[str, Any]:
    total_questions = max(0, int(request.total_questions or len(request.item_responses)))
    normalized_items: list[dict[str, Any]] = []
    validation_errors: list[str] = []
    seen_item_ids: set[str] = set()

    for index, item in enumerate(request.item_responses, start=1):
        item_id = _ensure_str(item.item_id) or f"item_{index:02d}"
        if item_id in seen_item_ids:
            validation_errors.append(f"duplicate_item_id:{item_id}")
        seen_item_ids.add(item_id)

        selected_option = item.selected_option
        correct_index = item.correct_index
        if selected_option is not None and not 0 <= int(selected_option) <= 8:
            validation_errors.append(f"selected_option_out_of_range:{item_id}")
        if correct_index is not None and not 0 <= int(correct_index) <= 8:
            validation_errors.append(f"correct_index_out_of_range:{item_id}")

        confidence = item.confidence
        if confidence is not None:
            confidence = clamp(float(confidence), 0.0, 1.0) if float(confidence) <= 1 else clamp(float(confidence) / 5, 0.0, 1.0)

        normalized_items.append({
            "item_id": item_id,
            "concept_id": _ensure_str(item.concept_id) or None,
            "is_correct": bool(item.is_correct),
            "confidence": confidence,
            "latency_ms": max(0, int(item.latency_ms)) if item.latency_ms is not None else None,
            "response_payload": {
                **(item.response_payload or {}),
                "selected_option": selected_option,
                "correct_index": correct_index,
                "server_validated": True,
            },
        })

    computed_score = sum(1 for item in normalized_items if item["is_correct"])
    denominator = total_questions or len(normalized_items) or 1
    computed_percentage = round((computed_score / denominator) * 100, 2)
    if len(normalized_items) != total_questions:
        validation_errors.append("item_count_mismatch")
    if abs(computed_score - int(request.score)) > 0:
        validation_errors.append("score_mismatch")
    if abs(computed_percentage - float(request.percentage)) > 1.0:
        validation_errors.append("percentage_mismatch")

    return {
        "validator_pass": not validation_errors,
        "validation_errors": validation_errors,
        "computed_score": computed_score,
        "computed_percentage": computed_percentage,
        "item_count": len(normalized_items),
        "normalized_item_responses": normalized_items,
        "policy_version": "research-evaluation-validator-v1",
    }


def validate_artifact_trace_payload(request: ArtifactTraceValidationRequest) -> dict[str, Any]:
    lengths = [
        max(0, request.initial_draft_length),
        max(0, request.claim_length),
        max(0, request.evidence_length),
        max(0, request.accepted_length),
        max(0, request.rejected_length),
        max(0, request.judgment_rationale_length),
        max(0, request.revised_draft_length),
        max(0, request.transfer_length),
    ]
    computed_trace_score = sum(1 for length in lengths if length >= 12)
    normalized_rubric = {
        key: _clamp_int(request.rubric.get(key), 0, 2)
        for key in ARTIFACT_RUBRIC_KEYS
    }
    computed_quality = round(sum(normalized_rubric.values()) / (len(ARTIFACT_RUBRIC_KEYS) * 2), 3)
    recommended_support_move = _research_support_move(computed_trace_score)
    validation_errors: list[str] = []

    if not _ensure_str(request.course):
        validation_errors.append("missing_course")
    if not _ensure_str(request.section):
        validation_errors.append("missing_section")
    if not _ensure_str(request.artifact):
        validation_errors.append("missing_artifact")
    if computed_trace_score != request.trace_score:
        validation_errors.append("trace_score_mismatch")
    if abs(computed_quality - float(request.artifact_quality_score or 0)) > 0.01:
        validation_errors.append("artifact_quality_score_mismatch")
    if request.recommended_support_move and request.recommended_support_move != recommended_support_move:
        validation_errors.append("recommended_support_mismatch")
    if request.support_move not in {"explain", "compare", "audit"}:
        validation_errors.append("unsupported_support_move")

    return {
        "validator_pass": not validation_errors,
        "validation_errors": validation_errors,
        "computed_trace_score": computed_trace_score,
        "computed_artifact_quality_score": computed_quality,
        "recommended_support_move": recommended_support_move,
        "normalized_rubric": normalized_rubric,
        "policy_version": "artifact-trace-validator-v1",
    }


def _text_tokens(value: str) -> set[str]:
    stop_words = {
        "the", "and", "for", "with", "that", "this", "from", "into", "because", "about",
        "what", "which", "when", "where", "their", "there", "would", "could", "should",
        "student", "learner", "artifact", "work", "product"
    }
    return {
        token
        for token in re.findall(r"[a-zA-Z][a-zA-Z0-9_-]{2,}", _ensure_str(value).lower())
        if token not in stop_words
    }


def _bounded_ratio(numerator: float, denominator: float = 1.0) -> float:
    if denominator <= 0:
        return 0.0
    return round(clamp(numerator / denominator, 0.0, 1.0), 3)


def score_artifact_revision_payload(request: ArtifactRevisionScoreRequest) -> dict[str, Any]:
    initial = _ensure_str(request.initial_draft)
    revised = _ensure_str(request.revised_draft)
    claim = _ensure_str(request.claim)
    evidence = _ensure_str(request.evidence)
    rationale = _ensure_str(request.judgment_rationale)
    transfer = _ensure_str(request.transfer)

    initial_tokens = _text_tokens(initial)
    revised_tokens = _text_tokens(revised)
    claim_tokens = _text_tokens(claim)
    evidence_tokens = _text_tokens(evidence)
    rationale_tokens = _text_tokens(rationale)
    transfer_tokens = _text_tokens(transfer)

    added_tokens = revised_tokens - initial_tokens
    shared_with_claim = len(revised_tokens & claim_tokens)
    shared_with_evidence = len(revised_tokens & evidence_tokens)
    shared_with_rationale = len(revised_tokens & rationale_tokens)
    shared_with_transfer = len(revised_tokens & transfer_tokens)

    revision_delta_chars = len(revised) - len(initial)
    revision_depth = clamp(
        _bounded_ratio(len(added_tokens), 12) * 0.65
        + (0.2 if abs(revision_delta_chars) >= 40 else 0.0)
        + (0.15 if len(revised_tokens) >= max(10, len(initial_tokens)) else 0.0),
        0.0,
        1.0,
    )
    claim_clarity = clamp(
        _bounded_ratio(len(claim_tokens), 10) * 0.55
        + _bounded_ratio(shared_with_claim, max(3, len(claim_tokens))) * 0.45,
        0.0,
        1.0,
    )
    evidence_alignment = clamp(
        _bounded_ratio(len(evidence_tokens), 12) * 0.35
        + _bounded_ratio(shared_with_evidence, max(3, len(evidence_tokens))) * 0.65,
        0.0,
        1.0,
    )
    judgment_quality = clamp(
        _bounded_ratio(len(rationale_tokens), 12) * 0.55
        + _bounded_ratio(shared_with_rationale, max(2, len(rationale_tokens))) * 0.25
        + (0.2 if request.judgment in {"modify", "reject"} and len(rationale_tokens) >= 6 else 0.1),
        0.0,
        1.0,
    )
    transfer_readiness = clamp(
        _bounded_ratio(len(transfer_tokens), 10) * 0.55
        + _bounded_ratio(shared_with_transfer, max(2, len(transfer_tokens))) * 0.25
        + (0.2 if any(word in transfer.lower() for word in ["audience", "context", "setting", "course", "role", "dataset"]) else 0.0),
        0.0,
        1.0,
    )
    specificity_delta = clamp(
        _bounded_ratio(len(added_tokens & (claim_tokens | evidence_tokens | rationale_tokens | transfer_tokens)), 8) * 0.7
        + _bounded_ratio(max(0, revision_delta_chars), 180) * 0.3,
        0.0,
        1.0,
    )
    overall = round(
        0.2 * claim_clarity
        + 0.22 * evidence_alignment
        + 0.18 * revision_depth
        + 0.16 * judgment_quality
        + 0.12 * transfer_readiness
        + 0.12 * specificity_delta,
        3,
    )

    validation_errors: list[str] = []
    if not _ensure_str(request.course):
        validation_errors.append("missing_course")
    if not _ensure_str(request.section):
        validation_errors.append("missing_section")
    if len(initial) < 12:
        validation_errors.append("initial_draft_too_short")
    if len(revised) < 12:
        validation_errors.append("revised_draft_too_short")
    if len(evidence) < 12:
        validation_errors.append("evidence_too_short")
    if len(rationale) < 12:
        validation_errors.append("judgment_rationale_too_short")

    return {
        "validator_pass": not validation_errors,
        "validation_errors": validation_errors,
        "scores": {
            "claim_clarity": round(claim_clarity, 3),
            "evidence_alignment": round(evidence_alignment, 3),
            "revision_depth": round(revision_depth, 3),
            "judgment_quality": round(judgment_quality, 3),
            "transfer_readiness": round(transfer_readiness, 3),
            "specificity_delta": round(specificity_delta, 3),
            "overall_revision_quality": overall,
        },
        "diagnostics": {
            "initial_token_count": len(initial_tokens),
            "revised_token_count": len(revised_tokens),
            "added_token_count": len(added_tokens),
            "revision_delta_chars": revision_delta_chars,
            "claim_overlap": shared_with_claim,
            "evidence_overlap": shared_with_evidence,
            "rationale_overlap": shared_with_rationale,
            "transfer_overlap": shared_with_transfer,
        },
        "privacy": {
            "raw_text_persisted": False,
            "policy": "score-derived-only-v1",
        },
        "policy_version": "artifact-revision-scorer-v1",
    }

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


def _collect_course_meta_sections(course_id: str) -> list[dict[str, Any]]:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    course_dir = os.path.join(base_dir, "frontend", "content", course_id)
    sections: list[dict[str, Any]] = []

    if not os.path.isdir(course_dir):
        return sections

    for root, _dirs, files in os.walk(course_dir):
        for filename in files:
            if not filename.endswith(".meta.json"):
                continue

            meta_path = os.path.join(root, filename)
            rel_path = os.path.relpath(meta_path, course_dir)
            parts = rel_path.split(os.sep)
            if len(parts) < 2:
                continue

            chapter_id = parts[-2]
            section_id = filename.replace(".meta.json", "")

            try:
                with open(meta_path, "r", encoding="utf-8") as handle:
                    meta = json.load(handle)
            except Exception as exc:
                logger.warning(f"Skipping diagnostic meta {meta_path}: {exc}")
                continue

            order = meta.get("order")
            if not isinstance(order, int):
                order = len(sections) + 1

            sections.append(
                {
                    "chapter_id": chapter_id,
                    "section_id": section_id,
                    "chapter_title": meta.get("chapter_title") or f"Chapter {chapter_id}",
                    "title": meta.get("title") or f"Section {chapter_id}.{section_id}",
                    "description": meta.get("description") or "",
                    "learning_objectives": meta.get("learning_objectives") or [],
                    "concept_ids": meta.get("concept_ids") or [],
                    "order": order,
                }
            )

    return sorted(sections, key=lambda item: (item["chapter_id"], item["order"], item["section_id"]))


def _humanize_diagnostic_label(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("_", " ").replace("-", " ")).strip()


def _build_dynamic_diagnostic_questions(course_id: str, max_questions: int = 12) -> list[dict[str, Any]]:
    questions: list[dict[str, Any]] = []
    seen_concepts: set[str] = set()

    for section in _collect_course_meta_sections(course_id):
        concept_ids = [concept for concept in section.get("concept_ids", []) if concept]
        objectives = section.get("learning_objectives") or []
        objective = objectives[0] if objectives else section.get("description") or section.get("title")

        for concept_index, concept_id in enumerate(concept_ids):
            if concept_id in seen_concepts:
                continue

            seen_concepts.add(concept_id)
            concept_label = _humanize_diagnostic_label(concept_id)
            section_title = section.get("title") or f"Section {section['chapter_id']}.{section['section_id']}"

            questions.append(
                {
                    "id": f"{course_id}_{section['chapter_id']}_{section['section_id']}_{concept_index + 1}",
                    "concept": concept_id,
                    "stem": (
                        f"In {section_title}, which response best demonstrates usable understanding of "
                        f"{concept_label}?"
                    ),
                    "options": [
                        f"Connect the idea to evidence, constraints, and a justified revision decision: {objective}",
                        "Report that the artifact looks polished without explaining what evidence changed.",
                        "Accept an AI or peer suggestion because it is fluent, even if the rationale is unclear.",
                        "List the topic vocabulary without applying it to the learner's artifact or decision.",
                    ],
                    "correct": 0,
                    "prereqFor": [f"{section['chapter_id']}/{section['section_id']}"],
                }
            )

            if len(questions) >= max_questions:
                return questions

    return questions


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
        
        questions = question_banks.get(course_id)
        if not questions:
            questions = _build_dynamic_diagnostic_questions(course_id)
        if not questions:
            questions = question_banks["statics"]
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


async def require_admin_access(
    request: Request,
    x_alget_admin_token: Optional[str] = Header(default=None),
):
    """Authorize the control plane without shipping a privileged key to the browser."""
    configured_token = os.environ.get("ALGET_ADMIN_TOKEN", "").strip()
    if configured_token and x_alget_admin_token and secrets.compare_digest(configured_token, x_alget_admin_token.strip()):
        return {"role": "admin", "subject": "server-token"}

    auth_header = request.headers.get("authorization", "")
    bearer = auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else ""
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    supabase_anon_key = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    if not bearer or not supabase_url or not supabase_anon_key:
        raise HTTPException(status_code=503, detail="Admin authentication is not configured")

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{supabase_url}/auth/v1/user",
                headers={"apikey": supabase_anon_key, "Authorization": f"Bearer {bearer}"},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Identity provider unavailable") from exc
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired administrator session")

    user = response.json()
    role = (user.get("app_metadata") or {}).get("role")
    if role not in {"admin", "course_admin"}:
        raise HTTPException(status_code=403, detail="Course administrator role required")
    return {"role": role, "subject": user.get("id")}


async def require_course_admin(operator=Depends(require_admin_access)):
    """Restrict identity and lifecycle mutations to accountable administrators."""
    return operator


@app.get("/api/admin/system/summary")
async def admin_system_summary(operator=Depends(require_admin_access)):
    return {
        "status": "ready",
        "operator": operator,
        "agent_count": len(AGENT_MANIFEST),
        "pdf_limit_bytes": MAX_PDF_BYTES,
        "release_policy": "human_approval_required",
    }


@app.get("/api/admin/agents")
async def admin_agents(_operator=Depends(require_admin_access)):
    return {"agents": AGENT_MANIFEST, "release_policy": "human_approval_required"}


@app.post("/api/admin/instructors/invite")
async def admin_invite_instructor(
    payload: AdminInstructorInviteRequest,
    operator=Depends(require_course_admin),
):
    """Invite an instructor without exposing the Supabase service role to the client."""
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not supabase_url or not service_role_key:
        raise HTTPException(status_code=503, detail="Instructor invitations are not configured")

    request_body = {
        "email": payload.email.strip().lower(),
        "data": {
            "display_name": payload.display_name.strip(),
            "role": "instructor",
            "invited_by": operator.get("subject"),
        },
    }
    if payload.redirect_url:
        request_body["redirect_to"] = payload.redirect_url

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.post(
                f"{supabase_url}/auth/v1/invite",
                headers={
                    "apikey": service_role_key,
                    "Authorization": f"Bearer {service_role_key}",
                    "Content-Type": "application/json",
                },
                json=request_body,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Identity provider unavailable") from exc

    if response.status_code not in {200, 201}:
        detail = "Instructor invitation failed"
        try:
            detail = response.json().get("msg") or response.json().get("message") or detail
        except ValueError:
            pass
        raise HTTPException(status_code=response.status_code, detail=detail)

    invited_user = response.json()
    invited_user_id = invited_user.get("id")
    if not invited_user_id:
        raise HTTPException(status_code=502, detail="Identity provider returned no instructor id")

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            metadata_response = await client.put(
                f"{supabase_url}/auth/v1/admin/users/{invited_user_id}",
                headers={
                    "apikey": service_role_key,
                    "Authorization": f"Bearer {service_role_key}",
                    "Content-Type": "application/json",
                },
                json={"app_metadata": {"role": "instructor"}},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Instructor role assignment unavailable") from exc
    if metadata_response.status_code not in {200, 201}:
        raise HTTPException(status_code=502, detail="Instructor was invited but role assignment failed")

    return {
        "id": invited_user_id,
        "email": invited_user.get("email", payload.email.strip().lower()),
        "status": "invited",
    }


@app.post("/api/admin/course-plan")
async def admin_course_plan(payload: AdminCoursePlanRequest, _operator=Depends(require_admin_access)):
    return build_governed_course_plan(payload.course_id, payload.source_id)


@app.post("/api/admin/pdf/convert")
async def admin_convert_pdf(
    file: UploadFile = File(...),
    course_id: str = Form(..., min_length=2, max_length=80),
    _operator=Depends(require_admin_access),
):
    if file.content_type not in {"application/pdf", "application/x-pdf", "application/octet-stream"}:
        raise HTTPException(status_code=415, detail="Only PDF files are accepted")
    payload = await file.read(MAX_PDF_BYTES + 1)
    try:
        result = convert_pdf_bytes(payload, file.filename or "course-source.pdf")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    result["course_id"] = course_id
    result["source_id"] = f"pdf:{result['sha256'][:16]}"
    return result


class AdaptiveDecisionOutcomeRequest(BaseModel):
    accepted: Optional[bool] = None
    outcome: Optional[str] = None
    next_correct: Optional[bool] = None
    note: Optional[str] = None
    supabase_url: Optional[str] = None
    supabase_anon_key: Optional[str] = None


@app.post("/api/adaptive_recommendation", response_model=AdaptiveRecommendationResponse)
async def adaptive_recommendation(request: AdaptiveRecommendationRequest):
    """Recommend the next best learning action by FUSING three signal families
    (KT/telemetry, scored artifact-revision, social-annotation) into one
    support-move policy. The decision is persisted SERVER-SIDE at generation
    time with a faithful evidence -> decision provenance record.
    """
    try:
        response = build_adaptive_recommendation(request)
        # Server-side persistence of the full provenance record. The in-process
        # store is already written inside the builder; here we best-effort
        # mirror to Supabase when credentials are supplied.
        record = get_adaptive_decision(response.decision_id)
        if record is not None:
            await _persist_decision_to_supabase(
                record, request.supabase_url, request.supabase_anon_key
            )
        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Adaptive recommendation error: {str(e)}")


@app.get("/api/adaptive_recommendation/{decision_id}")
async def get_adaptive_decision_provenance(decision_id: str):
    """Return a decision's full provenance for the 'why this support now' UI:
    candidate actions, selected/rejected actions, action scores, reason_codes,
    and the evidence snapshot that drove the choice.
    """
    record = get_adaptive_decision(decision_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Decision not found")
    return record


@app.post("/api/adaptive_recommendation/{decision_id}/outcome")
async def attach_adaptive_decision_outcome(
    decision_id: str, request: AdaptiveDecisionOutcomeRequest
):
    """Attach an outcome / accepted label to a persisted decision so the
    evidence -> decision -> outcome triple is reusable as RCT data.
    """
    record = get_adaptive_decision(decision_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Decision not found")
    if request.accepted is not None:
        record["accepted"] = request.accepted
    if request.outcome is not None:
        record["outcome"] = request.outcome
    if request.next_correct is not None:
        record["next_correct"] = request.next_correct
    if request.note is not None:
        record["note"] = request.note
    await _persist_decision_to_supabase(
        record, request.supabase_url, request.supabase_anon_key
    )
    return {"decision_id": decision_id, "updated": True, "record": record}


@app.post("/api/research/evaluation/validate")
async def validate_research_evaluation(request: ResearchEvaluationValidationRequest):
    """Validate diagnostic/pre-post item traces before they enter research tables."""
    return validate_research_evaluation_payload(request)


@app.post("/api/research/artifact-trace/validate")
async def validate_artifact_trace(request: ArtifactTraceValidationRequest):
    """Validate ArtifactStudio traces before they enter research telemetry."""
    return validate_artifact_trace_payload(request)


@app.post("/api/research/artifact-revision/score")
async def score_artifact_revision(request: ArtifactRevisionScoreRequest):
    """Score before/after artifact revision without persisting raw artifact text."""
    return score_artifact_revision_payload(request)


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

    # Scope the graph to the current chapter when a section is provided.
    # Without this, large supplement courses (64 sections × ~5 concepts)
    # dump 200+ nodes into the SVG and the brain network becomes unreadable.
    chapters = toc.get("chapters", [])
    focus_chapter_id: Optional[str] = None
    if current_section_id:
        parts = current_section_id.split("/")
        if len(parts) >= 2:
            focus_chapter_id = parts[1]
    if focus_chapter_id:
        scoped = [c for c in chapters if _ensure_str(c.get("id")) == focus_chapter_id]
        if scoped:
            chapters = scoped

    for chapter_index, chapter in enumerate(chapters, start=1):
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
        You are an expert instructional designer. Generate an interactive, scan-friendly learning scenario for the following theory/topic and context.
        Topic: {request.topic}
        Context/Constraint: {request.context}
        
        CRITICAL RULES:
        1. Base your explanation strictly on the widely accepted definition of {request.topic}.
        2. Do not hallucinate or invent new theories.
        3. Do not write a long paragraph. Use compact fragments, concrete roles, choices, and feedback.
        4. Make the learner decide what to do next. The scenario should feel like a playable case, not an essay.
        5. Keep every field brief: no field should exceed two short sentences, and array items should be one sentence.
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
                        "setting": {
                            "type": "STRING",
                            "description": "Where the case takes place in one concrete sentence."
                        },
                        "learner_role": {
                            "type": "STRING",
                            "description": "The role the learner plays in the case."
                        },
                        "friction": {
                            "type": "STRING",
                            "description": "The main problem, tension, or misconception the learner must notice."
                        },
                        "decision_point": {
                            "type": "STRING",
                            "description": "A direct prompt asking what the learner should do next."
                        },
                        "variables": {
                            "type": "ARRAY",
                            "items": { "type": "STRING" },
                            "description": "Three to five observable variables, constraints, or evidence cues the learner should inspect."
                        },
                        "choices": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "label": { "type": "STRING" },
                                    "action": { "type": "STRING" },
                                    "tradeoff": { "type": "STRING" },
                                    "feedback": { "type": "STRING" }
                                },
                                "required": ["label", "action", "tradeoff", "feedback"]
                            },
                            "description": "Exactly three plausible learner choices with concise tradeoffs and feedback."
                        },
                        "success_criteria": {
                            "type": "ARRAY",
                            "items": { "type": "STRING" },
                            "description": "Two to four criteria for judging whether the chosen action works."
                        },
                        "theory_moves": {
                            "type": "ARRAY",
                            "items": { "type": "STRING" },
                            "description": "Three concise links between the case and the theory."
                        },
                        "reflection_prompt": {
                            "type": "STRING",
                            "description": "One short question that asks the learner to justify a decision."
                        }
                    },
                    "required": [
                        "setting",
                        "learner_role",
                        "friction",
                        "decision_point",
                        "variables",
                        "choices",
                        "success_criteria",
                        "theory_moves",
                        "reflection_prompt"
                    ]
                }
            )
        )
        
        data = json.loads(response.text)
        
        return {
            "setting": data.get("setting", ""),
            "learner_role": data.get("learner_role", ""),
            "friction": data.get("friction", ""),
            "decision_point": data.get("decision_point", ""),
            "variables": data.get("variables", []),
            "choices": data.get("choices", []),
            "success_criteria": data.get("success_criteria", []),
            "theory_moves": data.get("theory_moves", []),
            "reflection_prompt": data.get("reflection_prompt", ""),
            "scenario_text": data.get("setting", ""),
            "theoretical_mapping": " ".join(data.get("theory_moves", []))
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


# ============================================================================
# SEARCH INDEX (Cmd+K global search)
# ============================================================================

# Course list mirrors frontend/src/lib/courseCatalog.js. Kept in sync by hand;
# adding a new course requires updating both. The search index is a flat
# list of section records that the frontend caches and fuzzy-matches in JS.
SEARCH_COURSE_IDS = [
    "statics",
    "dynamics",
    "bio-inspired",
    "inst-design",
    "ai-ethics",
    "ail606-supplement",
    "cat531-supplement",
    "cat100-supplement",
]


@app.get("/api/search/index")
async def get_search_index():
    """Return a flat list of every section across every course for client-side
    fuzzy search. Includes title, description, and concept_ids per section.

    Response shape:
        {
            "version": int,
            "items": [
                {
                    "type": "section",
                    "course": str,
                    "chapter": str,
                    "section": str,
                    "title": str,
                    "description": str,
                    "concept_ids": [str],
                    "chapter_title": str,
                },
                ...
            ]
        }
    """
    items: list[dict[str, Any]] = []
    version = 0
    for course in SEARCH_COURSE_IDS:
        try:
            toc = generate_toc(course)
        except Exception as e:  # noqa: BLE001
            print(f"[search_index] toc failed for {course}: {e}")
            continue
        if not toc.get("chapters"):
            continue
        for chapter in toc["chapters"]:
            chapter_id = _ensure_str(chapter.get("id"))
            chapter_title = _ensure_str(chapter.get("title")) or f"Chapter {chapter_id}"
            for section in chapter.get("sections", []):
                section_id = _ensure_str(section.get("id"))
                section_title = _ensure_str(section.get("title")) or f"Section {section_id}"
                meta = load_section_meta(course, chapter_id, section_id) or {}
                concept_ids = meta.get("concept_ids") or []
                description = _ensure_str(meta.get("description")) or ""
                items.append({
                    "type": "section",
                    "course": course,
                    "chapter": chapter_id,
                    "section": section_id,
                    "title": section_title,
                    "description": description,
                    "concept_ids": list(concept_ids),
                    "chapter_title": chapter_title,
                })
                version += 1

    return {"version": version, "items": items}


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


def _resolve_option_misconception_id(problem: dict, selected_index: Optional[int]) -> Optional[str]:
    """Resolve the misconception id triggered by a chosen wrong MCQ option.

    Preference order (most specific first):
      1. Per-option mapping the course agents are backfilling in parallel:
         - ``option_misconceptions``: dict keyed by option index ("1" or 1), or
         - ``option_misconception_ids``: list parallel to ``options``.
         A blank/None per-option value means "this option has no authored
         misconception" and is treated as absent.
      2. Problem-level ``misconception_id`` (already present on many MCQs).

    Returns None when nothing is authored, so the grade path never regresses.
    """
    # 1) Per-option dict (index -> id), tolerant of int or str keys.
    option_map = problem.get("option_misconceptions")
    if isinstance(option_map, dict) and selected_index is not None:
        candidate = option_map.get(selected_index)
        if candidate is None:
            candidate = option_map.get(str(selected_index))
        candidate = (candidate or "").strip() if isinstance(candidate, str) else candidate
        if candidate:
            return candidate

    # 1b) Per-option list parallel to options[].
    option_list = problem.get("option_misconception_ids")
    if isinstance(option_list, list) and selected_index is not None:
        if 0 <= selected_index < len(option_list):
            candidate = option_list[selected_index]
            candidate = (candidate or "").strip() if isinstance(candidate, str) else candidate
            if candidate:
                return candidate

    # 2) Problem-level fallback.
    problem_level = problem.get("misconception_id")
    if isinstance(problem_level, str) and problem_level.strip():
        return problem_level.strip()
    return None


@app.post("/api/grade/{problem_id}")
async def grade_submission(problem_id: str, request: GradeRequest):
    """Grade a problem submission against the actual practice JSON.

    Falls back to a numeric sample only when section_id is not supplied or
    the problem cannot be found, so legacy callers still work.
    """
    try:
        problem: Optional[dict] = None
        section_parts: Optional[tuple[str, str, str]] = None
        if request.section_id:
            parts = request.section_id.split("/")
            if len(parts) == 3:
                course, chapter, section = parts
                section_parts = (course, chapter, section)
                practice = load_practice_for_section(course, chapter, section) or {}
                for candidate in practice.get("problems", []):
                    if str(candidate.get("id")) == str(problem_id):
                        problem = candidate
                        break

        if problem is None:
            # Legacy fallback so older callers don't break.
            problem = {
                "id": problem_id,
                "type": "numeric",
                "expected_value": 693.67,
                "expected_unit": "N",
                "tolerance": 0.02,
                "require_unit": True,
            }

        if problem.get("type") == "multiple_choice":
            options = problem.get("options") or []
            correct_index = problem.get("correct_index")
            selected_index = request.selected_option
            if selected_index is None and request.answer:
                # Tolerate legacy text-payload submissions.
                try:
                    selected_index = options.index(request.answer)
                except ValueError:
                    selected_index = None
            is_correct = (
                selected_index is not None
                and correct_index is not None
                and int(selected_index) == int(correct_index)
            )
            expected_text = (
                options[int(correct_index)]
                if correct_index is not None and 0 <= int(correct_index) < len(options)
                else ""
            )
            response: dict[str, Any] = {
                "is_correct": is_correct,
                "user_answer": request.answer or (options[selected_index] if selected_index is not None and 0 <= selected_index < len(options) else ""),
                "expected": expected_text,
                "explanation": problem.get("explanation") or ("Correct." if is_correct else "Not quite — review the explanation and try again."),
                "selected_option": selected_index,
                "correct_index": correct_index,
            }

            # On a WRONG answer, surface authored remediation from the section's
            # misconceptions.json so the feedback and rail_action reach the
            # learner. The misconception id can be attached per-option (course
            # agents are backfilling this: option_misconceptions / a parallel
            # option_misconception_ids list) or, failing that, at the problem
            # level (misconception_id). Robust when none is present: no key is
            # added and the existing response is unchanged (no regression).
            if not is_correct:
                misconception_id = _resolve_option_misconception_id(problem, selected_index)
                if misconception_id and section_parts is not None:
                    course, chapter, section = section_parts
                    entry = find_misconception(course, chapter, section, misconception_id)
                    if entry:
                        response["misconception"] = {
                            "id": entry.get("id", misconception_id),
                            "pattern": entry.get("pattern", ""),
                            "feedback": entry.get("feedback", ""),
                            "rail_action": entry.get("rail_action", ""),
                            "description": entry.get("description", ""),
                        }

            return response

        # Prefer the deterministic reference solver when the problem declares
        # one. The solver recomputes the answer from the givens and grades the
        # learner answer against it (rank-3 dead-solver-layer fix).
        solver_id = problem.get("solver_id")
        if solver_id:
            from grading_service import grade_problem_with_solver

            result = grade_problem_with_solver(
                solver_id=solver_id,
                solver_params=problem.get("params") or {},
                user_answer=request.answer,
                user_unit=request.unit,
            )
            # If the solver could not be resolved or produced no answer, fall
            # back to the static answer key rather than a false "incorrect".
            if result.get("auto_graded"):
                return result

        # Numeric / step_based / conceptual fall through to the shape-aware
        # grader, which normalizes final_answer vs flat expected_value and
        # returns an explicit ungradable result when no key exists.
        result = grade_problem(problem, request.answer, request.unit)
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
# DERIVED PER-ITEM ANALYTICS (read path over the item_problem_stats view)
# ============================================================================


@app.get("/api/item-stats")
async def item_stats(
    supabase_url: Optional[str] = None,
    supabase_key: Optional[str] = None,
    problem_ids: Optional[str] = None,
    section_id: Optional[str] = None,
):
    """Read derived per-problem stats (first-attempt correctness rate, attempt
    count, mean time-to-correct) from the item_problem_stats view.

    These are the cohort-calibrated item statistics the fusion policy and
    authors consume without re-aggregating the event log (plan item 9). The
    read path is ROBUST to the view/table being absent: it returns an empty
    `stats` map rather than raising, so a missing analytics substrate cannot
    crash the app. Credentials are accepted as query params so the same
    client-supplied Supabase config used elsewhere applies here.

    `problem_ids` is an optional comma-separated filter; `section_id` narrows
    to one section.
    """
    pid_list = (
        [p for p in (problem_ids.split(",") if problem_ids else []) if p.strip()]
        or None
    )
    stats = await fetch_item_stats(
        supabase_url=supabase_url,
        supabase_key=supabase_key,
        problem_ids=pid_list,
        section_id=section_id,
    )
    return {"stats": stats, "count": len(stats)}


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

