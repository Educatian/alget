import json
import os
from pydantic import BaseModel, Field
import typing

try:
    from google import genai
    from google.genai import types
except ImportError:
    import google.generativeai as legacy_genai
    genai = None

class QuestionOption(BaseModel):
    id: str = Field(description="Option ID (e.g., A, B, C, D)")
    text: str = Field(description="The text of the option")

class MultipleChoiceQuestion(BaseModel):
    question: str = Field(description="The question text")
    options: list[QuestionOption] = Field(description="List of 4 options")
    correct_option_id: str = Field(description="ID of the correct option")
    explanation: str = Field(description="Explanation of why the correct option is right and others are wrong")
    concept_id: str = Field(description="The underlying concept being tested (e.g., 'sum_of_forces', 'fbd', 'tension', 'equilibrium')")

class KnowledgeCheckForm(BaseModel):
    questions: list[MultipleChoiceQuestion] = Field(description="List of 3 multiple choice questions")

class AssessmentAgent:
    """Agent for generating formative assessments (MCQs) for knowledge tracing."""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        
        if genai:
            self.client = genai.Client(api_key=self.api_key)
            self.model_id = "gemini-2.5-flash"
        else:
            legacy_genai.configure(api_key=self.api_key)
            self.model = legacy_genai.GenerativeModel('gemini-2.0-flash')

    def generate_assessment(self, bio_context: str, eng_context: str, section_title: str) -> dict:
        """Generates a 3-question MCQ assessment."""
        
        prompt = f"""
        You are an expert engineering and biology educator. 
        Generate a 3-question formative assessment (Multiple Choice Questions) based on the following context.
        The goal is to test the student's understanding of the concepts for a simple Knowledge Tracing model.
        
        Section Title: {section_title}
        Biology Context: {bio_context}
        Engineering Context: {eng_context}
        
        Requirements:
        1. Create exactly 3 questions.
        2. Questions should range from basic recall to conceptual application.
        3. Each question must target a specific `concept_id` from the curriculum (e.g., 'equilibrium', 'sum_of_forces', 'fbd', 'tension'). Use these exact IDs if applicable, or infer simple ones like 'van_der_waals', 'adhesion', etc.
        4. Provide 4 options (A, B, C, D) per question.
        5. Provide a clear explanation for the correct answer.
        """

        try:
            if genai:
                response = self.client.models.generate_content(
                    model=self.model_id,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=KnowledgeCheckForm,
                        temperature=0.7,
                    ),
                )
                return json.loads(response.text)
            else:
                # Use legacy SDK
                response = self.model.generate_content(
                    prompt,
                    generation_config=legacy_genai.GenerationConfig(
                        response_mime_type="application/json",
                        temperature=0.7,
                    )
                )
                return json.loads(response.text)
                
        except Exception as e:
            print(f"[ERROR] AssessmentAgent generation failed: {e}")
            # Fallback mock data in case of failure
            return {
                "questions": [
                    {
                        "question": "Which biological principle is primarily discussed?",
                        "options": [
                            {"id": "A", "text": "Van der Waals forces"},
                            {"id": "B", "text": "Photosynthesis"},
                            {"id": "C", "text": "Cellular respiration"},
                            {"id": "D", "text": "Mitosis"}
                        ],
                        "correct_option_id": "A",
                        "explanation": "The text focuses on adhesion via Van der Waals forces.",
                        "concept_id": "van_der_waals"
                    }
                ]
            }
