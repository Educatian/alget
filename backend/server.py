# backend/server.py - FastAPI Backend for UA Intelligent Textbook
"""
FastAPI server providing:
- Module and hooks data
- Gemini content generation (narrative, activity, simulation)
- Book content API (MDX sections)
- Grading API (solver-based)
- Assist API (Rail)
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
import sys
import os

# Load .env file
from dotenv import load_dotenv
load_dotenv()

# Allow standard GOOGLE_API_KEY to persist

# Load environment variables, allowing overrides
load_dotenv(override=True)

import google.generativeai as genai

# Load environment variable for API key
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
print(f"[INFO] GEMINI_API_KEY loaded: {'Yes' if GEMINI_API_KEY else 'No'}")

def get_api_key(request=None):
    """Get API key at request time: env var (fresh read) > request body > cached module var."""
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", "")
    if key:
        return key
    if request and hasattr(request, 'api_key') and request.api_key:
        return request.api_key
    if GEMINI_API_KEY:
        return GEMINI_API_KEY
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
from content_service import load_section, generate_toc, get_fallback_toc
from grading_service import grade_problem
from rag_service import rag_service
from agents.assessment_agent import AssessmentAgent
from knowledge_tracing import BayesianKnowledgeTracing

# Initialize FastAPI
app = FastAPI(
    title="UA Intelligent Textbook API",
    description="Backend for AI-powered engineering learning",
    version="2.0.0"
)

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000"
    ],
    allow_origin_regex="https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize systems on backend startup."""
    print("[INFO] Application startup: Indexing Bio-Inspired curriculum for RAG...")
    # Get absolute path to frontend/content/bio-inspired
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    content_dir = os.path.join(base_dir, "frontend", "content", "bio-inspired")
    if os.path.exists(content_dir):
        rag_service.load_curriculum(content_dir)
    else:
        print(f"[ERROR] Curriculum directory not found: {content_dir}")

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

@app.post("/api/orchestrate")
async def orchestrate_query(request: OrchestrateRequest):
    """Analyze student query and delegate to specialist agents based on intent."""
    try:
        api_key = get_api_key(request)
        agent = OrchestratorAgent(api_key=api_key)
        result = agent.orchestrate(
            query=request.query,
            course=request.course,
            current_content=request.current_content,
            history=request.history,
            is_highlight=request.is_highlight
        )
        return result
    except Exception as e:
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

class MasteryGraphRequest(BaseModel):
    # This could take user_id and fetch from a real DB.
    # For now, it accepts a dictionary of concept_id -> p_known scores
    mastery_data: dict

@app.post("/api/mastery_graph")
async def generate_mastery_graph(request: MasteryGraphRequest):
    """Generates a node-link structured JSON representing current curriculum mastery."""
    try:
        # Mocking hardcoded structural relationships for 'inst-design'
        # In a generic system, this graph topology might live in a unified `q_matrix` or curriculum graph db.
        nodes = []
        edges = []
        
        # Hardcoding the curriculum structure for the mockup ID course
        topics = [
            {"id": "ct_1_1", "label": "Foundations of ID", "group": "core"},
            {"id": "ct_1_2", "label": "Learning Theories", "group": "theory"},
            {"id": "ct_1_3", "label": "Cognitive Load", "group": "theory"},
            {"id": "ct_2_1", "label": "ADDIE Analysis", "group": "process"},
            {"id": "ct_2_2", "label": "ADDIE Design", "group": "process"},
            {"id": "ct_2_3", "label": "ADDIE Development", "group": "process"}
        ]
        
        # Dependencies
        links = [
            {"source": "ct_1_1", "target": "ct_1_2"},
            {"source": "ct_1_2", "target": "ct_1_3"},
            {"source": "ct_1_1", "target": "ct_2_1"},
            {"source": "ct_2_1", "target": "ct_2_2"},
            {"source": "ct_2_2", "target": "ct_2_3"}
        ]
        
        for topic in topics:
            p_known = request.mastery_data.get(topic["id"], 0.1) # Default to 0.1
            status = "novice"
            if p_known > 0.8:
                status = "mastered"
            elif p_known > 0.5:
                status = "emerging"
                
            nodes.append({
                "id": topic["id"],
                "label": topic["label"],
                "group": topic["group"],
                "p_known": round(p_known, 2),
                "status": status
            })
            
        return {"nodes": nodes, "links": links}
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
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        from pydantic import BaseModel
        
        class ScenarioResponse(BaseModel):
            scenario_text: str
            theoretical_mapping: str

        prompt = f"""
        You are an expert instructional designer. Generate a tailored case study for the following theory/topic and context.
        Topic: {request.topic}
        Context/Constraint: {request.context}
        
        CRITICAL RULES:
        1. Base your explanation strictly on the widely accepted definition of {request.topic}.
        2. Do not hallucinate or invent new theories.
        3. Formulate a relatable, practical scenario applying this theory in the requested context.
        """
        
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.4,
                response_mime_type="application/json",
                response_schema=ScenarioResponse
            )
        )
        
        data = json.loads(response.text)
        
        # Ensure we always return the fields exactly to avoid frontend missing them
        return {
            "scenario_text": data.get("scenario_text", ""),
            "theoretical_mapping": data.get("theoretical_mapping", "")
        }
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
        # 2. Generate content via GenAI
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = f"""You are acting as a fellow student 'Alex' taking this course at the University of Alabama.
        A student just highlighted the following text in the textbook:
        "{req.text}"
        
        And they wrote this note on it:
        "{req.user_note}"
        
        Provide a concise, constructive peer comment that expands on their thought or politely adds a new perspective.
        Keep it natural, conversational, and under 2 sentences. DO NOT sound like a robot."""
        
        response = model.generate_content(prompt)
        ai_note = response.text.strip()
        
        # 3. Insert into Supabase via REST API using provided frontend credentials
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
    """Endpoint called by frontend to trigger the stealth AI peer note generation."""
    background_tasks.add_task(generate_and_insert_peer_note_task, request)
    return {"status": "scheduled", "message": "Peer note formulation is running in the background."}


class ChatRequest(BaseModel):
    message: str
    section_id: str = "general"
    page_content: str = ""  # Current page MDX for RAG
    section_title: str = ""  # Current section title
    history: List[dict] = []


@app.post("/api/assist/chat")
async def chat_with_assistant(request: ChatRequest):
    """Chat with the AI learning assistant - RAG-enhanced with page content."""
    print(f"[BIGAL] Received chat request: {request.message[:50]}...")
    print(f"[BIGAL] Section: {request.section_id}, Page content length: {len(request.page_content)} chars")
    
    try:
        # Build conversation history for context
        history_text = ""
        for msg in request.history[-6:]:  # Last 6 messages
            role = "Student" if msg.get("role") == "user" else "Assistant"
            history_text += f"{role}: {msg.get('content', '')}\n"
        
        # Truncate page content to fit context window (max 6000 chars)
        page_context = request.page_content[:6000] if request.page_content else ""
        
        # Check if this is the first message (no history)
        is_first_message = len(request.history) == 0
        
        prompt = f"""You are BigAL, a friendly elephant tutor at the University of Alabama.

REFERENCE MATERIAL (from current page):
---
{page_context[:4000] if page_context else "No specific page content available."}
---

Conversation so far:
{history_text if history_text else "(This is the start of our chat)"}

Student: {request.message}

RESPONSE GUIDELINES:
{"- Since this is your FIRST message, briefly greet them (one short sentence like 'Hey! Great question.')" if is_first_message else "- DO NOT introduce yourself again or repeat greetings - just continue the conversation naturally"}
- Keep responses SHORT: 1-3 sentences max
- Sound like a helpful friend, not a formal tutor
- Use casual language: "Hmm, what if you try...", "Right! So basically...", "Good thinking!"
- Ask ONE follow-up question to keep the dialogue going
- Reference page content naturally ("Like in Example 1.2...", "Remember the formula...")
- Skip "Roll Tide" unless it fits naturally
- NO long explanations - be punchy and conversational

BigAL:"""

        # Configure Gemini API
        _key = get_api_key()
        if not _key:
            print("[BIGAL ERROR] No API key configured!")
            return {"response": "BigAL is not configured yet. Please set up the API key."}
        
        print("[BIGAL] Calling Gemini API with RAG context...")
        genai.configure(api_key=_key)
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        
        print(f"[BIGAL] Response received: {response.text[:100]}...")
        return {"response": response.text}
    
    except Exception as e:
        print(f"[BIGAL ERROR] Exception: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return {"response": "I'm having trouble connecting right now. Please try again in a moment."}


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
# RUN SERVER
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)

