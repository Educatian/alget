# logic_engine.py - Content Generation Engine
"""
Generates educational content using Google Gemini with structured JSON output.
Replaces the PDF-based system with keyword-driven module generation.
"""

from typing import Optional
import json

# Import local modules
from prompts import (
    get_narrative_prompt,
    get_activity_prompt,
    get_simulation_prompt,
    get_scenario_prompt
)

# Google GenAI SDK
try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


# ============================================================================
# CONTENT GENERATION
# ============================================================================

def generate_narrative(
    module: str,
    keywords: list,
    grade_level: str,
    interest: str,
    api_key: str
) -> dict:
    """
    Generate an engaging narrative using Gemini.
    
    Returns:
        Dict with title, story, key_concepts
    """
    if not GENAI_AVAILABLE or not api_key:
        return {
            "title": "The Engineering Student's Discovery",
            "story": "**[API Key Required]**\n\nEnter your Gemini API key in the sidebar to generate personalized narratives.\n\nThis story would feature a UA engineering student discovering the concepts of " + ", ".join(keywords) + " through a real-world scenario at Bryant-Denny Stadium or the Mercedes-Benz plant.",
            "key_concepts": keywords
        }
    
    try:
        client = genai.Client(api_key=api_key)
        prompt = get_narrative_prompt(module, keywords, grade_level, interest)
        
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.8,
                max_output_tokens=2048,
                response_mime_type="application/json"
            )
        )
        
        # Parse JSON response
        result = json.loads(response.text)
        return result
        
    except Exception as e:
        return {
            "title": "Generation Error",
            "story": f"An error occurred: {str(e)}",
            "key_concepts": keywords
        }


def generate_activity(
    module: str,
    keywords: list,
    grade_level: str,
    api_key: str
) -> dict:
    """
    Generate practice activities using Gemini.
    
    Returns:
        Dict with questions array
    """
    if not GENAI_AVAILABLE or not api_key:
        return {
            "questions": [
                {
                    "difficulty": "easy",
                    "type": "conceptual",
                    "question": f"What are the key principles of {keywords[0] if keywords else 'this concept'}?",
                    "options": ["A) Principle 1", "B) Principle 2", "C) Principle 3", "D) Principle 4"],
                    "correct_answer": "A",
                    "explanation": "Enter your Gemini API key to generate real practice questions."
                }
            ]
        }
    
    try:
        client = genai.Client(api_key=api_key)
        prompt = get_activity_prompt(module, keywords, grade_level)
        
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=2048,
                response_mime_type="application/json"
            )
        )
        
        result = json.loads(response.text)
        return result
        
    except Exception as e:
        return {
            "questions": [{
                "difficulty": "N/A",
                "type": "error",
                "question": f"Error generating activities: {str(e)}",
                "options": [],
                "correct_answer": "",
                "explanation": ""
            }]
        }


def generate_simulation(
    module: str,
    keywords: list,
    api_key: str
) -> dict:
    """
    Generate interactive HTML/JS simulation using Gemini.
    
    Returns:
        Dict with description, concepts_shown, html_code
    """
    if not GENAI_AVAILABLE or not api_key:
        # Return a placeholder simulation
        placeholder_html = """
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <style>
        body { font-family: 'Inter', sans-serif; padding: 20px; background: #f8f9fa; }
        h3 { color: #9E1B32; margin-bottom: 10px; }
        .placeholder { 
            background: linear-gradient(135deg, #9E1B32, #7A1527);
            color: white; 
            padding: 40px; 
            border-radius: 16px; 
            text-align: center;
        }
        .icon { font-size: 48px; margin-bottom: 16px; }
    </style>
</head>
<body>
    <div class="placeholder">
        <div class="icon">🔬</div>
        <h3>Interactive Simulation</h3>
        <p>Enter your Gemini API key to generate an interactive simulation for:</p>
        <p><strong>""" + ", ".join(keywords) + """</strong></p>
    </div>
</body>
</html>
"""
        return {
            "description": "Placeholder simulation - API key required for generation",
            "concepts_shown": keywords,
            "html_code": placeholder_html
        }
    
    try:
        client = genai.Client(api_key=api_key)
        prompt = get_simulation_prompt(module, keywords)
        
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=4096,
                response_mime_type="application/json"
            )
        )
        
        result = json.loads(response.text)
        return result
        
    except Exception as e:
        return {
            "description": f"Error: {str(e)}",
            "concepts_shown": keywords,
            "html_code": f"<html><body><h2>Error generating simulation</h2><p>{str(e)}</p></body></html>"
        }


def generate_module_content(
    module: str,
    keywords: list,
    grade_level: str,
    interest: str,
    api_key: str
) -> dict:
    """
    Generate all content types for a module selection.
    
    Returns:
        Dict with narrative, activity, simulation, and illustration keys
    """
    # Generate all content types
    narrative = generate_narrative(module, keywords, grade_level, interest, api_key)
    activity = generate_activity(module, keywords, grade_level, api_key)
    simulation = generate_simulation(module, keywords, api_key)
    
    # Illustration placeholder (will show description instead of actual image)
    illustration = {
        "prompt": f"Educational diagram showing {', '.join(keywords)} concepts in {module}",
        "description": f"A clean, professional engineering diagram illustrating {keywords[0] if keywords else 'the concept'} with labeled components and formulas."
    }
    
    return {
        "narrative": narrative,
        "activity": activity,
        "simulation": simulation,
        "illustration": illustration
    }


# ============================================================================
# LEGACY COMPATIBILITY (to be removed)
# ============================================================================

def get_standard_response(query: str, pdf_text: Optional[str] = None) -> str:
    """Legacy function - returns placeholder."""
    return "This feature has been replaced by module-based content generation."


def get_scenario_response(query: str, grade_level: str, interest: str, api_key: str) -> str:
    """Legacy scenario generation - still used for chat."""
    if not GENAI_AVAILABLE or not api_key:
        return "**🔑 API Key Required**\n\nPlease enter your Gemini API key."
    
    try:
        client = genai.Client(api_key=api_key)
        prompt = get_scenario_prompt(query, grade_level, interest)
        
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.8,
                max_output_tokens=1024
            )
        )
        
        return response.text
        
    except Exception as e:
        return f"**❌ Error:** {str(e)}"


def process_query(query: str, grade_level: str, interest: str, api_key: str, pdf_text: Optional[str] = None) -> dict:
    """Legacy query processing."""
    return {
        "standard": get_standard_response(query, pdf_text),
        "scenario": get_scenario_response(query, grade_level, interest, api_key)
    }
