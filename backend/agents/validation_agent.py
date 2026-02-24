# backend/agents/validation_agent.py
import json

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


import logging

logger = logging.getLogger(__name__)

class ValidationAgent:
    """
    Validation Agent acts as an internal scientific peer-reviewer.
    It takes the purely biological context and the proposed engineering application,
    and validates whether the engineering application is scientifically accurate,
    biologically faithful, and physically feasible.
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        if GENAI_AVAILABLE and api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None

    def validate_engineering_concept(self, bio_context: str, eng_context: str, history: list = None) -> dict:
        """
        Validates the engineering concept against the biological context.
        """
        if not self.client:
            return {
                "error": "Gemini API key is required.",
                "is_valid": False,
                "score": 0,
                "critique": "API Key is missing. Cannot validate output.",
                "suggestions": []
            }
            
        logger.info(f"Validating engineering concept against biology...")
        
        prompt = self._build_validation_prompt(bio_context, eng_context, history)
        
        try:
            response = self.client.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3, # Low temperature for more analytical/strict validation
                    response_mime_type="application/json",
                    response_schema={
                        "type": "OBJECT",
                        "properties": {
                            "is_valid": {
                                "type": "BOOLEAN",
                                "description": "True if the engineering application is fundamentally sound, scientifically accurate, and physically feasible."
                            },
                            "score": {
                                "type": "INTEGER",
                                "description": "A score from 1 to 10 rating the overall biological fidelity and engineering feasibility."
                            },
                            "critique": {
                                "type": "STRING",
                                "description": "A detailed critique explaining the reasoning behind the validation and score."
                            },
                            "suggestions": {
                                "type": "ARRAY",
                                "items": {"type": "STRING"},
                                "description": "If there are logical flaws or hallucinations, provide actionable suggestions to correct the engineering application."
                            },
                            "biological_fidelity": {
                                "type": "STRING",
                                "description": "Assessment of how well the engineering application adheres to the actual biological mechanism."
                            },
                            "engineering_feasibility": {
                                "type": "STRING",
                                "description": "Assessment of whether the proposed design is physically possible with current or near-future technology."
                            }
                        },
                        "required": ["is_valid", "score", "critique", "suggestions", "biological_fidelity", "engineering_feasibility"]
                    }
                )
            )
            
            try:
                result_json = json.loads(response.text)
                return result_json
            except json.JSONDecodeError:
                return {
                    "error": "Failed to parse JSON response.",
                    "raw_response": response.text
                }
                
        except Exception as e:
            return {"error": f"Error from Validation Agent: {str(e)}"}
            
    def _build_validation_prompt(self, bio_context: str, eng_context: str, history: list = None) -> str:
        history_text = ""
        if history:
            for msg in history:
                role = "Student" if msg.get("role") == "user" else "Assistant"
                history_text += f"{role}: {msg.get('content', '')}\\n"
        return f"""
        You are an expert Scientific and Engineering Review Board for a Bio-Inspired Design curriculum.
        Your job is to act as a strict quality control agent. You must review an AI-generated engineering application
        and ensure it is scientifically accurate, physically feasible, and faithful to the actual biological mechanism.
        We must prevent 'AI hallucinations' where physical laws or biological realities are ignored for the sake of a creative answer.
        
        1. Biological Fidelity: Does the engineering concept accurately reflect the provided biological mechanism? Or does it misunderstand how the organism actually works?
        2. Engineering Feasibility: Is this physically possible to build? Does it violate laws of thermodynamics, material science, or physics?
        
        Conversation History:
        {history_text if history_text else "None"}
        
        Biological Context (The absolute ground truth facts):
        \"\"\"{bio_context}\"\"\"
        
        Proposed Engineering Application (To be validated):
        \"\"\"{eng_context}\"\"\"
        
        Provide a rigorous, critical evaluation. If the engineering application is implausible or relies on magic/sci-fi tech, mark it as invalid (`is_valid`: false) and provide strict critique.
        """
