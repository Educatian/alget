# backend/agents/evaluator_agent.py
import json

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


import logging

logger = logging.getLogger(__name__)

class EvaluatorAgent:
    """
    Evaluator Agent acts as a Janine Benyus persona to evaluate student
    bio-inspired design proposals. It checks the design against the 
    core principles of biomimicry and provides encouraging, expert feedback.
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        if GENAI_AVAILABLE and api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None

    def evaluate_design(self, student_design: str, biological_context: str = "", history: list = None) -> dict:
        """
        Evaluates a student's bio-inspired design proposal, handling context from history if provided.
        """
        if not self.client:
            return {
                "error": "Gemini API key is required.",
                "feedback": "API Key is missing. Cannot evaluate design."
            }
            
        logger.info(f"Evaluating student design...")
        
        prompt = self._build_evaluation_prompt(student_design, biological_context, history)
        
        try:
            response = self.client.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.7,
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
                                "description": "Areas where the design could better align with biomimicry principles."
                            },
                            "janine_feedback": {
                                "type": "STRING",
                                "description": "Overall encouraging feedback written in the persona of Janine Benyus."
                            },
                            "score": {
                                "type": "INTEGER",
                                "description": "A score from 1 to 10 evaluating the biomimicry aspect of the design."
                            }
                        },
                        "required": ["strengths", "areas_for_improvement", "janine_feedback", "score"]
                    }
                )
            )
            
            try:
                result_json = json.loads(response.text)
                return result_json
            except json.JSONDecodeError:
                # Fallback if the response isn't strictly JSON despite the schema
                return {
                    "error": "Failed to parse JSON response.",
                    "raw_response": response.text
                }
                
        except Exception as e:
            return {"error": f"Error from Evaluator Agent: {str(e)}"}
            
    def _build_evaluation_prompt(self, student_design: str, biological_context: str, history: list = None) -> str:
        history_text = ""
        if history:
            for msg in history:
                role = "Student" if msg.get("role") == "user" else "Assistant"
                history_text += f"{role}: {msg.get('content', '')}\n"

        base_prompt = f"""
        You are Janine Benyus, the pioneer of Biomimicry. 
        You are evaluating a student's bio-inspired design proposal. 
        Your goal is to be encouraging but intellectually rigorous. Do not accept superficial "greenwashing".
        
        Evaluate the design against the core Biomimicry tenets:
        1. Nature as Model: Does the design deeply emulate nature's forms, processes, or ecosystems, or is it just superficially copying a shape?
        2. Nature as Measure: Does the design use an ecological standard to judge sustainability? Will it create toxic waste, or does it follow "Life's Principles" (e.g., life creates conditions conducive to life, uses life-friendly chemistry)?
        3. Nature as Mentor: Is the design based on a respectful, accurate understanding of biological insights?
        
        Provide a strict Score (1-10):
        - 1-3: Superficial mimicry, fundamentally unsustainable, or biologically inaccurate.
        - 4-6: Good concept but lacks depth in either mechanism translation or sustainability.
        - 7-8: Strong functional mimicry and sustainable approach.
        - 9-10: Masterful translation of biological mechanism into a regenerative, deeply sustainable engineering design.
        
        Write your feedback directly speaking to the student as Janine. Highlight strengths, but heavily focus on areas for improvement to push their thinking further. Always ask a concluding question like "How would nature handle the end-of-life for this product?"
        
        Conversation History:
        {history_text if history_text else "None"}

        Student Design Proposal:
        "{student_design}"
        """
        
        if biological_context:
            base_prompt += f"\n\nContext on Relevant Biological Mechanism:\n\"{biological_context}\""
            
        return base_prompt
