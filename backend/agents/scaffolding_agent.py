import json

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


class ScaffoldingAgent:
    """
    Scaffolding Agent acts as a Socratic tutor. When a student is stuck or 
    expresses confusion, it analyzes the history and current roadblock, 
    and provides guiding questions (instead of direct answers) to help 
    the student arrive at the conclusion themselves.
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        if GENAI_AVAILABLE and api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None

    def provide_scaffolding(self, query: str, history: list = None) -> dict:
        """
        Analyzes a student's roadblock and provides Socratic guiding questions.
        """
        if not self.client:
            return {
                "error": "Gemini API key is required.",
                "scaffolding": "API Key is missing. Cannot provide scaffolding."
            }
            
        print(f"[ScaffoldingAgent] Generating Socratic guidance for roadblock...")
        
        prompt = self._build_scaffolding_prompt(query, history)
        
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
                            "misconception_identified": {
                                "type": "STRING",
                                "description": "What is the student confused about or missing?"
                            },
                            "encouraging_remark": {
                                "type": "STRING",
                                "description": "A brief, encouraging response acknowledging their struggle as part of the normal learning process."
                            },
                            "guiding_questions": {
                                "type": "ARRAY",
                                "items": {"type": "STRING"},
                                "description": "1 to 3 Socratic questions that guide the student toward the answer without giving it away."
                            }
                        },
                        "required": ["misconception_identified", "encouraging_remark", "guiding_questions"]
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
            return {"error": f"Error from Scaffolding Agent: {str(e)}"}
            
    def _build_scaffolding_prompt(self, query: str, history: list = None) -> str:
        history_text = ""
        if history:
            for msg in history:
                role = "Student" if msg.get("role") == "user" else "Assistant"
                history_text += f"{role}: {msg.get('content', '')}\n"

        return f"""
        You are an expert Socratic Tutor for a bio-inspired design course.
        The student is stuck, confused, or explicitly asking for help/hints.
        
        YOUR MISSION: DO NOT give them the direct answer.
        Instead, analyze their struggle, identify what they are misunderstanding 
        or missing, and formulate guiding questions to help them think it through themselves.
        Keep your questions focused on biological mechanisms or engineering principles depending on their context.
        
        Conversation History (to understand what they already know):
        {history_text if history_text else "None"}

        Current Student Statement/Question (Roadblock):
        "{query}"
        """
