# backend/agents/engineering_agent.py
import json

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


import logging

logger = logging.getLogger(__name__)

class EngineeringAgent:
    """
    Engineering Expert Agent role is to take the biological mechanisms
    and translate them into practical engineering concepts and solutions.
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        if GENAI_AVAILABLE and api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None

    def analyze_engineering(self, query: str, interest: str, bio_context_str: str, history: list = None) -> dict:
        """
        Analyzes biological context to provide engineering translation.
        """
        if not self.client:
            return {
                "error": "Gemini API key is required.",
                "engineering_principle": "N/A",
                "proposed_solution": "API Key is missing."
            }
            
        logger.info(f"Analyzing engineering translation for query: {query}")
        
        prompt = self._build_engineering_prompt(query, interest, bio_context_str, history)
        
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
                            "engineering_principle": {
                                "type": "STRING",
                                "description": "The core engineering principle derived from the biological mechanism."
                            },
                            "application_areas": {
                                "type": "ARRAY",
                                "items": {"type": "STRING"},
                                "description": "Relevant engineering fields or industries where this can be applied."
                            },
                            "proposed_solution": {
                                "type": "STRING",
                                "description": "A detailed explanation of how this mechanism can solve an engineering problem."
                            },
                            "challenges": {
                                "type": "ARRAY",
                                "items": {"type": "STRING"},
                                "description": "Potential challenges or limitations in implementing this bio-inspired design."
                            }
                        },
                        "required": ["engineering_principle", "application_areas", "proposed_solution", "challenges"]
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
            return {"error": f"Error from Engineering Agent: {str(e)}"}
            
    def _build_engineering_prompt(self, query: str, interest: str, bio_context_str: str, history: list = None) -> str:
        history_text = ""
        if history:
            for msg in history:
                role = "Student" if msg.get("role") == "user" else "Assistant"
                history_text += f"{role}: {msg.get('content', '')}\\n"
        return f"""
        You are an expert Engineering Agent for a bio-inspired design course.
        A student is interested in {interest}.
        Based on the biological context below, explain how this biological mechanism can be translated 
        into an engineering solution or application, particularly relating to {interest} if possible.
        
        CRITICAL DOMAIN APPLICABILITY REQUIREMENT:
        To make this content highly accessible for traditional Mechanical Engineering (ME) professors, 
        you MUST frame your engineering translation using direct, explicit analogies to core ME domains.
        Use accessible wording that bridges the biological concept to established ME principles in:
        1. Thermodynamics and Fluids (e.g., heat exchangers, fluid drag, boundary layers)
        2. Dynamic Systems and Control (e.g., PID control, feedback loops, kinematics, sensors)
        3. Material Manufacturing & Solid Mechanics (e.g., composites, structural matrices, yield strength)
        
        Do not overcomplicate the biological taxonomy; focus simply on how the mechanism functions as a 
        traditional engineering system.
        
        Use the conversation history to understand the context of the student's constraints and personalize your response accordingly.
        
        Conversation History:
        {history_text if history_text else "None"}
        
        Biology Context: 
        {bio_context_str}
        
        Student Query: {query}
        """

    def revise_engineering(self, query: str, interest: str, bio_context_str: str, previous_eng_str: str, validation_critique_str: str, history: list = None) -> dict:
        """
        Revises the engineering context based on critique from the Validation Agent.
        """
        if not self.client:
            return {
                "error": "Gemini API key is required.",
                "engineering_principle": "N/A",
                "proposed_solution": "API Key is missing."
            }
            
        logger.info(f"Revising engineering application based on validation critique...")
        
        prompt = self._build_revision_prompt(query, interest, bio_context_str, previous_eng_str, validation_critique_str, history)
        
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
                            "engineering_principle": {
                                "type": "STRING",
                                "description": "The revised core engineering principle derived from the biological mechanism."
                            },
                            "application_areas": {
                                "type": "ARRAY",
                                "items": {"type": "STRING"},
                                "description": "Relevant engineering fields or industries where this can be applied."
                            },
                            "proposed_solution": {
                                "type": "STRING",
                                "description": "A revised, scientifically sound detailed explanation of how this mechanism can solve an engineering problem."
                            },
                            "challenges": {
                                "type": "ARRAY",
                                "items": {"type": "STRING"},
                                "description": "Potential challenges or limitations in implementing this bio-inspired design."
                            }
                        },
                        "required": ["engineering_principle", "application_areas", "proposed_solution", "challenges"]
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
            return {"error": f"Error from Engineering Agent Revision: {str(e)}"}
            
    def _build_revision_prompt(self, query: str, interest: str, bio_context_str: str, previous_eng_str: str, validation_critique_str: str, history: list = None) -> str:
        history_text = ""
        if history:
            for msg in history:
                role = "Student" if msg.get("role") == "user" else "Assistant"
                history_text += f"{role}: {msg.get('content', '')}\\n"
        return f"""
        You are an expert Engineering Agent for a bio-inspired design course.
        A student is interested in {interest}. You previously proposed a design, 
        but it was rejected or heavily critiqued by the Scientific Validation Review Board.
        
        Your task is to REVISE your engineering application to address their concerns,
        ensuring it is physically feasible and adheres to the actual biological mechanism.
        
        CRITICAL DOMAIN APPLICABILITY REQUIREMENT:
        When revising your application, continue to firmly ground your explanation using explicit analogies 
        to traditional Mechanical Engineering principles (Thermodynamics, Dynamic Systems/Controls, Material Manufacturing).
        Ensure the revised language is accessible to a standard ME professor without a deep biology background.

        Conversation History:
        {history_text if history_text else "None"}
        
        Student Query: {query}
        
        Biology Context (Ground Truth): 
        {bio_context_str}
        
        Your Previous (Rejected) Engineering Proposal:
        {previous_eng_str}
        
        Validation Board Critique:
        {validation_critique_str}
        
        Please provide a scientifically valid and improved engineering application.
        """
