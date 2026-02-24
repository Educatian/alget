# backend/agents/activity_agent.py
import json

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


import logging

logger = logging.getLogger(__name__)

class ActivityAgent:
    """
    Activity Agent generates interactive, lateral thinking exercises 
    to help students brainstorm and connect biological mechanisms to engineering problems.
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        if GENAI_AVAILABLE and api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None

    def generate_brainstorming(self, biological_context: str, engineering_interest: str, history: list = None) -> dict:
        """
        Generates lateral thinking and ideation activities.
        """
        if not self.client:
            return {
                "error": "Gemini API key is required.",
                "activity": "API Key is missing."
            }
            
        logger.info(f"Generating brainstorming activity for context: {biological_context[:50]}...")
        
        prompt = self._build_activity_prompt(biological_context, engineering_interest, history)
        
        try:
            response = self.client.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.8,
                    response_mime_type="application/json",
                    response_schema={
                        "type": "OBJECT",
                        "properties": {
                            "activity_title": {
                                "type": "STRING",
                                "description": "A catchy title for the brainstorming activity."
                            },
                            "lateral_thinking_prompt": {
                                "type": "STRING",
                                "description": "A creative prompt asking the student to connect the biology to their engineering interest."
                            },
                            "guiding_questions": {
                                "type": "ARRAY",
                                "items": {"type": "STRING"},
                                "description": "2-3 questions to help the student think outside the box."
                            },
                            "example_idea": {
                                "type": "STRING",
                                "description": "A wild, creative example of an idea to get their juices flowing."
                            }
                        },
                        "required": ["activity_title", "lateral_thinking_prompt", "guiding_questions", "example_idea"]
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
            return {"error": f"Error from Activity Agent: {str(e)}"}
            
    def _build_activity_prompt(self, biological_context: str, engineering_interest: str, history: list = None) -> str:
        history_text = ""
        if history:
            for msg in history:
                role = "Student" if msg.get("role") == "user" else "Assistant"
                history_text += f"{role}: {msg.get('content', '')}\\n"
        return f"""
        You are an enthusiastic Activity Agent for a bio-inspired design course.
        Your goal is to spark creativity in a student interested in {engineering_interest}.
        
        Based on the following biological mechanism, generate a brainstorming activity. 
        Encourage lateral thinking—how can this biology inspire completely new ways to approach {engineering_interest}?
        
        Conversation History:
        {history_text if history_text else "None"}
        
        Biology Context: 
        {biological_context}
        """
