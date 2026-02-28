# backend/agents/tutor_agent.py
import json

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


import logging

logger = logging.getLogger(__name__)

class TutorAgent:
    """
    Tutor Agent acts as the pedagogical layer, synthesizing the deep knowledge
    from the domain experts into an encouraging, cohesive summary for the student.
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        if GENAI_AVAILABLE and api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None

    def synthesize(self, query: str, grade_level: str, bio_context_str: str, eng_context_str: str, val_context_str: str = "", history: list = None) -> dict:
        """
        Synthesizes expert insights into a cohesive message.
        """
        if not self.client:
            return {
                "error": "Gemini API key is required.",
                "synthesis": "API Key is missing."
            }
            
        logger.info(f"Synthesizing insights for query: {query}")
        
        prompt = self._build_tutor_prompt(query, grade_level, bio_context_str, eng_context_str, val_context_str, history)
        
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
                            "synthesis": {
                                "type": "STRING",
                                "description": "An engaging, cohesive narrative that weaves together the biology and engineering insights."
                            },
                            "encouragement": {
                                "type": "STRING",
                                "description": "A supportive closing remark to motivate the student."
                            },
                            "next_steps": {
                                "type": "ARRAY",
                                "items": {"type": "STRING"},
                                "description": "1-3 actionable questions or activities the student can think about next."
                            }
                        },
                        "required": ["synthesis", "encouragement", "next_steps"]
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
            return {"error": f"Error from Tutor Agent: {str(e)}"}
            
    def _build_tutor_prompt(self, query: str, grade_level: str, bio_context_str: str, eng_context_str: str, val_context_str: str, history: list = None) -> str:
        history_text = ""
        if history:
            for msg in history:
                role = "Student" if msg.get("role") == "user" else "Assistant"
                history_text += f"{role}: {msg.get('content', '')}\n"

        return f"""
        You are a supportive Tutor Agent for a {grade_level} student studying bio-inspired design.
        Synthesize the biology and engineering insights below into a cohesive, encouraging, and easy-to-understand summary.
        
        Use the conversation history to understand the context of the student's question and personalize your response accordingly.
        
        Conversation History:
        {history_text if history_text else "None"}
        
        Crucially, you have also been provided with a critique from a rigorous Validation Review Board. 
        If the Validation Review Board found logical flaws or impossibilities in the Engineering Insight, gently mention the limitations or correct the engineering insight in the final summary. 
        If it was perfectly valid, use that to bolster confidence.
        
        Ensure the final summary is engaging, directly answers the student's query, and clearly highlights the connection between biology and engineering.
        
        Student Query: {query}
        
        Biology Insight (Ground Truth Mechanism): 
        {bio_context_str}
        
        Engineering Insight (Proposed Translation): 
        {eng_context_str}
        
        Validation Critique (Scientific Assessment of Feasibility & Biological Fidelity):
        {val_context_str}
        """

    def general_tutor(self, query: str, course: str, current_content: str, rag_context: str, history: list = None) -> dict:
        """
        Generic tutoring method for courses other than bio-inspired design.
        """
        if not self.client:
            return {
                "error": "Gemini API key is required.",
                "synthesis": "API Key is missing."
            }
            
        logger.info(f"Generating generic tutor response for course {course}, query: {query}")
        
        history_text = ""
        if history:
            for msg in history:
                role = "Student" if msg.get("role") == "user" else "Assistant"
                history_text += f"{role}: {msg.get('content', '')}\n"

        # Determine domain persona based on course
        domain = "Instructional Design and Educational Technology" if course == "inst-design" else course.replace('-', ' ').title()
        
        prompt = f"""
        You are a highly knowledgeable Tutor Agent specializing in {domain}.
        A student is asking a question. Synthesize an encouraging, easy-to-understand response based on the context provided.
        
        Use the conversation history to understand the context of the student's question and personalize your response accordingly.
        
        Conversation History:
        {history_text if history_text else "None"}
        
        Ensure your response directly answers the student's query and leverages the retrieved textbook knowledge and current page context.
        
        Student Query: {query}
        
        Current Page Content (What the student is currently reading):
        {current_content if current_content else "No explicit page content provided."}
        
        Retrieved Textbook/Literature Context: 
        {rag_context if rag_context else "No retrieved context."}
        """
        
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
                            "synthesis": {
                                "type": "STRING",
                                "description": f"An engaging, cohesive narrative answering the student's question about {domain}."
                            },
                            "encouragement": {
                                "type": "STRING",
                                "description": "A supportive closing remark to motivate the student."
                            },
                            "next_steps": {
                                "type": "ARRAY",
                                "items": {"type": "STRING"},
                                "description": "1-3 actionable questions or activities the student can think about next."
                            }
                        },
                        "required": ["synthesis", "encouragement", "next_steps"]
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
            return {"error": f"Error from Tutor Agent: {str(e)}"}
