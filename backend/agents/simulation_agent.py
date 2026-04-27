# backend/agents/simulation_agent.py
import json

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


import logging

from .config import get as get_config
from .schema_gate import SIMULATION_FALLBACK, SimulationOutput, gate

logger = logging.getLogger(__name__)

class SimulationAgent:
    """
    Simulation Agent generates self-contained HTML/JS interactive simulations 
    using physics libraries (p5.js or Plotly) based on validated 
    engineering and biological concepts.
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        if GENAI_AVAILABLE and api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None

    def generate_interactive_simulation(self, bio_context: str, eng_context: str, validation_context: str = "", history: list = None) -> dict:
        """
        Generates interactive HTML simulation code based on the valid concepts.
        """
        if not self.client:
            return {
                "error": "Gemini API key is required.",
                "description": "API Key missing.",
                "concepts_shown": [],
                "html_code": "<p>Error: API Key missing.</p>"
            }
            
        logger.info(f"Generating interactive HTML simulation...")
        
        prompt = self._build_simulation_prompt(bio_context, eng_context, validation_context, history)
        
        try:
            cfg = get_config("simulation")
            response = self.client.models.generate_content(
                model=cfg.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=cfg.temperature,
                    max_output_tokens=cfg.max_output_tokens,
                    response_mime_type="application/json",
                    response_schema={
                        "type": "OBJECT",
                        "properties": {
                            "description": {
                                "type": "STRING",
                                "description": "A short summary of what the simulation demonstrates and how the user should interact with it."
                            },
                            "concepts_shown": {
                                "type": "ARRAY",
                                "items": {"type": "STRING"},
                                "description": "Key science or engineering concepts visualized in the simulation."
                            },
                            "html_code": {
                                "type": "STRING",
                                "description": "The COMPLETE, valid HTML5 document containing all necessary CSS and JavaScript (like p5.js from a CDN) required to run the simulation interactively."
                            }
                        },
                        "required": ["description", "concepts_shown", "html_code"]
                    }
                )
            )
            
            try:
                result_json = json.loads(response.text)
            except json.JSONDecodeError:
                return {**SIMULATION_FALLBACK, "_schema_error": "json_decode", "raw_response": response.text}

            return gate(result_json, SimulationOutput, SIMULATION_FALLBACK, "SimulationAgent")

        except Exception as e:
            logger.exception("Simulation Agent failed")
            return {**SIMULATION_FALLBACK, "_schema_error": "exception", "error": str(e)}
            
    def _build_simulation_prompt(self, bio_context: str, eng_context: str, validation_context: str, history: list = None) -> str:
        history_text = ""
        if history:
            for msg in history:
                role = "Student" if msg.get("role") == "user" else "Assistant"
                history_text += f"{role}: {msg.get('content', '')}\\n"
        return f"""
        You are an expert Physics and Engineering Simulation Developer for an educational platform.
        Your task is to write a self-contained, interactive HTML5 simulation that demonstrates a specific bio-inspired engineering application.
        
        You MUST use either 'p5.js' or 'Plotly.js' via CDN for your visualization logic.
        
        Requirements for the 'html_code':
        1. It MUST be a fully complete HTML document, starting with <!DOCTYPE html>.
        2. It MUST include a CDN script tag for the library (e.g., `<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>`).
        3. Provide interactive controls (sliders, buttons, or mouse interactions) so the student can change variables (like weight, surface area, friction, etc.) and see the physical reaction in real-time.
        4. Focus on clarity and visual appeal. Use clean CSS.
        5. DO NOT use markdown code blocks (like ```html) inside the JSON string value. Just return the raw HTML string.
        
        Conversation History:
        {history_text if history_text else "None"}
        
        ---
        
        Biological Truth (The mechanism from nature):
        \"\"\"{bio_context}\"\"\"
        
        Proposed Engineering Application:
        \"\"\"{eng_context}\"\"\"
        
        Validation Feasibility / Constraints (Ensure your physics match these constraints!):
        \"\"\"{validation_context}\"\"\"
        """
