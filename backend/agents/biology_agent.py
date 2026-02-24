# backend/agents/biology_agent.py
import json

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


import logging

logger = logging.getLogger(__name__)

class BiologyAgent:
    """
    Biology Expert Agent role is to analyze queries and identify
    the fundamental biological mechanisms at play. It provides structured
    information about how nature solves the specific problem.
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        if GENAI_AVAILABLE and api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None

    def analyze_biology(self, query: str, grade_level: str = "Sophomore", history: list = None, background_knowledge: str = "") -> dict:
        """
        Analyzes a student query to provide biological context and mechanisms, considering conversation history and textbook context.
        """
        if not self.client:
            return {
                "error": "Gemini API key is required.",
                "explanation": "API Key is missing."
            }
            
        logger.info(f"Analyzing biological mechanisms for query: {query}")
        
        prompt = self._build_biology_prompt(query, grade_level, history, background_knowledge)
        
        try:
            # We use structured output to get distinct sections for the UI
            response = self.client.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.7,
                    response_mime_type="application/json",
                    response_schema={
                        "type": "OBJECT",
                        "properties": {
                            "primary_mechanism": {
                                "type": "STRING",
                                "description": "The name of the main biological mechanism or strategy used by nature."
                            },
                            "explanation": {
                                "type": "STRING",
                                "description": "A detailed, accessible explanation of how this mechanism works in nature."
                            },
                            "organism_examples": {
                                "type": "ARRAY",
                                "items": {"type": "STRING"},
                                "description": "A list of specific organisms that utilize this mechanism."
                            },
                            "key_terms": {
                                "type": "ARRAY",
                                "items": {"type": "STRING"},
                                "description": "Important biological terminology related to this mechanism."
                            }
                        },
                        "required": ["primary_mechanism", "explanation", "organism_examples", "key_terms"]
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
            return {"error": f"Error from Biology Agent: {str(e)}"}
            
    def _build_biology_prompt(self, query: str, grade_level: str, history: list = None, background_knowledge: str = "") -> str:
        history_text = ""
        if history:
            for msg in history:
                role = "Student" if msg.get("role") == "user" else "Assistant"
                history_text += f"{role}: {msg.get('content', '')}\\n"

        return f"""
        You are an expert Biology Agent for a {grade_level} level bio-inspired design course.
        Analyze the following student query or topic and determine the underlying biological mechanisms.
        Focus purely on how nature works in this context, preparing the user to later apply this to engineering.
        Make your response detailed but accessible to an engineering student with limited biology background.
        
        Retrieve facts and examples primarily from the following Course Literature (if relevant to the query). If it's completely irrelevant, rely on your general knowledge.
        
        Course Literature (Textbook Fragments):
        {background_knowledge if background_knowledge else "None available."}
        
        Conversation History:
        {history_text if history_text else "None"}

        Student Query / Topic: "{query}"
        """
