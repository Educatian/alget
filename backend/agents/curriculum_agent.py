# backend/agents/curriculum_agent.py
import json
import logging
import re

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


logger = logging.getLogger(__name__)

class CurriculumAgent:
    """
    Curriculum Agent takes a deeply researched Bio-Inspired Design concept 
    (from the Generative Lab) and transforms it into a structured, physical 
    Interactive Textbook module (MDX narrative, Meta data, Practice problems).
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        if GENAI_AVAILABLE and api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None

    def generate_module(self, bio_context: str, eng_context: str) -> dict:
        """
        Synthesizes the Lab contexts into structured textbook files.
        """
        if not self.client:
            return {
                "error": "Gemini API key is required.",
                "slug": None,
                "meta": None,
                "mdx_content": None,
                "practice": None
            }
            
        logger.info(f"Generating full curriculum module from Lab context...")
        
        prompt = self._build_curriculum_prompt(bio_context, eng_context)
        
        try:
            response = self.client.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.4, # Balanced for structure and engaging narrative
                    response_mime_type="application/json",
                    response_schema={
                        "type": "OBJECT",
                        "properties": {
                            "slug": {
                                "type": "STRING",
                                "description": "A very short, hyphenated, URL-friendly string derived from the biological concept (e.g., 'whale-flipper-turbine', 'gecko-adhesion')."
                            },
                            "meta": {
                                "type": "OBJECT",
                                "properties": {
                                    "title": {"type": "STRING", "description": "The specific engineering application name."},
                                    "chapter_title": {"type": "STRING", "description": "The overarching biological concept name."},
                                    "learning_objectives": {
                                        "type": "ARRAY",
                                        "items": {"type": "STRING"},
                                        "description": "2-3 clear learning objectives for the student."
                                    },
                                    "concept_ids": {
                                        "type": "ARRAY",
                                        "items": {"type": "STRING"},
                                        "description": "Tags like ['bio-inspired', 'fluid-dynamics']"
                                    }
                                },
                                "required": ["title", "chapter_title", "learning_objectives", "concept_ids"]
                            },
                            "mdx_content": {
                                "type": "STRING",
                                "description": "The full instructional content formatted in Markdown. Start with an # Introduction, then ## The Biological Mechanism, then ## Engineering Translation, and finally ## Future Outlook. Use latex math formatting where appropriate, bolding, and bullet points. Make it read like an engaging textbook chapter."
                            },
                            "practice": {
                                "type": "OBJECT",
                                "properties": {
                                    "problems": {
                                        "type": "ARRAY",
                                        "items": {
                                            "type": "OBJECT",
                                            "properties": {
                                                "id": {"type": "STRING"},
                                                "type": {"type": "STRING", "description": "Always 'numeric' for ALGET."},
                                                "statement": {"type": "STRING", "description": "A numeric physics or engineering word problem based on the context."},
                                                "expected_value": {"type": "NUMBER"},
                                                "expected_unit": {"type": "STRING"},
                                                "hint": {"type": "STRING"}
                                            },
                                            "required": ["id", "type", "statement", "expected_value", "expected_unit", "hint"]
                                        }
                                    }
                                },
                                "required": ["problems"]
                            }
                        },
                        "required": ["slug", "meta", "mdx_content", "practice"]
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
            return {"error": f"Error from Curriculum Agent: {str(e)}"}
            
    def _build_curriculum_prompt(self, bio_context: str, eng_context: str) -> str:
        return f"""
        You are an expert curriculum developer and instructional designer. 
        Take the following biological context and engineering application and transform it 
        into a highly engaging, structured textbook chapter suitable for an engineering student.
        
        This will be deployed directly as an active module in the ALGET Intelligent Textbook.
        
        Biological Context (Mechanism):
        \"\"\"{bio_context}\"\"\"
        
        Engineering Application (Translation):
        \"\"\"{eng_context}\"\"\"
        
        Generate a complete module. Ensure that the 'practice' section contains at least 1 actual calculable numeric engineering problem (e.g. lift force, tension, efficiency) that stems directly from the provided engineering context. Do not invent magical physics; stick to standard engineering principles. Ensure the 'mdx_content' includes standard Markdown headers and paragraphs.
        """
