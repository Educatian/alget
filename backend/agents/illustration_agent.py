import json

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

import logging

logger = logging.getLogger(__name__)

class IllustrationAgent:
    """
    An agent dedicated to generating high-quality conceptual designs and image prompts
    for bio-inspired engineering concepts to act as a 'Illustration Design Agent'.
    """
    def __init__(self, api_key: str):
        self.api_key = api_key
        if GENAI_AVAILABLE and api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None

    def design_illustration(self, biology_context: str, engineering_context: str, history: list = None) -> dict:
        """
        Takes the biological and engineering contexts and generates a conceptual design and image generation prompt.
        """
        if not self.client:
            return {
                "illustration_title": "API Key Required",
                "conceptual_design": "Please provide a valid Gemini API Key to generate an illustration.",
                "image_prompt": "",
                "ui_elements": []
            }

        logger.info(f"Illustration Agent generating conceptual design...")
        
        history_text = ""
        if history:
            for msg in history:
                role = "Student" if msg.get("role") == "user" else "Assistant"
                history_text += f"{role}: {msg.get('content', '')}\\n"

        prompt = f"""
        You are an expert Illustration Design Agent and Technical Artist specializing in Bio-Inspired Design (Biomimicry).
        Your job is to take complex biological mechanisms and their corresponding engineering applications,
        and design a beautiful, clear, and highly professional illustration conceptualizing the connection.
        
        Conversation History (User Constraints/Requests):
        {history_text if history_text else "None"}

        Biological Context:
        {biology_context}

        Engineering Application:
        {engineering_context}

        Please design a technical illustration concept based on these inputs.
        Provide a structured JSON output with the following schema exactly:
        {{
            "illustration_title": "A catchy and professional title for the illustration.",
            "conceptual_design": "A detailed paragraph describing what the visual should look like (composition, color palette, style, key biological vs engineering elements shown).",
            "image_prompt": "A highly descriptive, comma-separated prompt ready to be used in an AI image generator like Midjourney or DALL-E (e.g., 'technical diagram, split screen, left side showing kingfisher beak aerodynamics, right side showing bullet train nose, clean white background, vector art style, --v 6').",
            "ui_elements": ["Key labels or callouts that should be included in the diagram."]
        }}

        Ensure your output is strictly valid JSON without any markdown code blocks wrapping it.
        """
        
        try:
            response = self.client.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.7,
                    response_mime_type="application/json"
                )
            )
            
            result = json.loads(response.text)
            return result
        except Exception as e:
            logger.error(f"Illustration Agent Error: {e}")
            return {
                "illustration_title": "Generation Error",
                "conceptual_design": f"An error occurred while conceptualizing the illustration: {str(e)}",
                "image_prompt": "",
                "ui_elements": []
            }
