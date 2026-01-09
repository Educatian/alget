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

import google.generativeai as genai

# Load environment variable for API key
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
print(f"[INFO] GEMINI_API_KEY loaded: {'Yes' if GEMINI_API_KEY else 'No'}")

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from logic_engine import generate_module_content
from module_hooks import (
    get_module_titles,
    get_hooks_for_module,
    get_module_info,
    FRESHMAN_MODULES,
    SOPHOMORE_MODULES
)
from content_service import load_section, generate_toc, get_fallback_toc
from grading_service import grade_problem

# Initialize FastAPI
app = FastAPI(
    title="UA Intelligent Textbook API",
    description="Backend for AI-powered engineering learning",
    version="2.0.0"
)

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
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

class RepresentRequest(BaseModel):
    section_id: str
    representation_type: str  # mindmap, analogy, visual, formula

class StuckEventRequest(BaseModel):
    user_id: str
    problem_id: Optional[str]
    section_id: Optional[str]
    reason: str
    timestamp: str

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
        api_key = GEMINI_API_KEY or request.api_key
        
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


@app.get("/api/all-modules")
async def get_all_modules():
    """Get all modules organized by grade level."""
    return {
        "Freshman": [
            {"icon": m["icon"], "title": m["title"], "description": m["description"]}
            for m in FRESHMAN_MODULES.values()
        ],
        "Sophomore": [
            {"icon": m["icon"], "title": m["title"], "description": m["description"]}
            for m in SOPHOMORE_MODULES.values()
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
            # Return placeholder content for development
            return {
                "meta": {
                    "title": f"Section {chapter}.{section}",
                    "course": course,
                    "chapter": chapter,
                    "section": section,
                    "learning_objectives": [
                        "Understand equilibrium conditions",
                        "Apply ΣF = 0 to particle systems"
                    ],
                    "concept_ids": ["equilibrium", "sum_of_forces", "fbd"]
                },
                "content": f"""
## Introduction

This section covers the fundamentals of **equilibrium** for particles.

When a particle is in equilibrium, the vector sum of all forces acting on it is zero:

$$\\sum \\vec{{F}} = 0$$

### Key Concepts

1. **Equilibrium Condition**: A particle is in equilibrium when the resultant of all forces is zero.

2. **Free Body Diagram (FBD)**: A diagram showing all external forces acting on a body.

3. **Two-Force Members**: When only two forces act on a body in equilibrium, those forces must be equal, opposite, and collinear.

### Example Problem

A 100 kg crate is suspended by two cables. If cable A makes an angle of 30° with the horizontal, find the tension in cable A.

**Given:**
- Mass: 100 kg
- Angle: 30°
- g = 9.81 m/s²

**Solution:**
Using ΣFy = 0:
T_A sin(30°) = mg
T_A = 100 × 9.81 / sin(30°) = **1962 N**
                """,
                "simulation": None,
                "illustration": None,
                "practice": {
                    "problems": [
                        {
                            "id": "p001",
                            "type": "numeric",
                            "difficulty": "medium",
                            "statement": "A 50 kg object is suspended by a cable at 45° from horizontal. Calculate the tension in the cable (in N).",
                            "givens": {"mass": "50 kg", "angle": "45°", "g": "9.81 m/s²"},
                            "expected_value": 693.67,
                            "expected_unit": "N",
                            "tolerance": 0.02,
                            "require_unit": True,
                            "hint": "Use ΣFy = 0. The vertical component of tension must equal the weight."
                        }
                    ]
                }
            }
        return section_data
    except Exception as e:
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
        if GEMINI_API_KEY:
            from google import genai
            from google.genai import types
            
            client = genai.Client(api_key=GEMINI_API_KEY)
            
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
    # In production, this would save to Supabase
    print(f"[STUCK EVENT] User: {request.user_id}, Problem: {request.problem_id}, Reason: {request.reason}")
    return {"status": "logged"}


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
        if not GEMINI_API_KEY:
            print("[BIGAL ERROR] No API key configured!")
            return {"response": "BigAL is not configured yet. Please set up the API key."}
        
        print("[BIGAL] Calling Gemini API with RAG context...")
        genai.configure(api_key=GEMINI_API_KEY)
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

@app.post("/api/generate-image")
async def generate_image(request: ImageGenerateRequest):
    """Generate a diagram or illustration using Gemini API."""
    try:
        if not GEMINI_API_KEY:
            return {
                "success": False,
                "error": "Gemini API key not configured",
                "placeholder": True,
                "message": "Image generation unavailable - please configure GEMINI_API_KEY"
            }
        
        from google import genai
        from google.genai import types
        import base64
        
        client = genai.Client(api_key=GEMINI_API_KEY)
        
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
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)

