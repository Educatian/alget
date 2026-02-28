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

class ShortAnswerQuestion(BaseModel):
    question: str = Field(description="The short answer or summary question text")
    concept_id: str = Field(description="The underlying concept being tested")
    rubric: str = Field(description="A brief grading rubric or key points expected in the answer")

class KnowledgeCheckForm(BaseModel):
    mcq_questions: list[MultipleChoiceQuestion] = Field(description="List of 2 multiple choice questions")
    summary_question: ShortAnswerQuestion = Field(description="One generative short-answer or summary question")

class SummaryGradingFeedback(BaseModel):
    content_score: float = Field(description="Total score from 0.0 to 1.0 based on factual correctness")
    wording_score: float = Field(description="Score from 0.0 to 1.0 based on clarity, structure, and professional tone")
    sub_scores: dict[str, float] = Field(description="Dictionary mapping each distinct dimension/concept in the rubric to a partial credit score (0.0 to 1.0)")
    feedback: str = Field(description="Constructive feedback summarizing what was good and what was missing")
    is_passing: bool = Field(description="True if content_score >= 0.7, else False")

class AssessmentAgent:
    """Agent for generating formative assessments (MCQs and Short Answer) for knowledge tracing."""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        
        if genai:
            self.client = genai.Client(api_key=self.api_key)
            self.model_id = "gemini-2.5-flash"
        else:
            legacy_genai.configure(api_key=self.api_key)
            self.model = legacy_genai.GenerativeModel('gemini-2.0-flash')

    def generate_assessment(self, bio_context: str, eng_context: str, section_title: str, learning_objectives: list[str] = None, concept_ids: list[str] = None) -> dict:
        """Generates a 3-question assessment (2 MCQs, 1 Summary)."""
        
        objs_text = "\n".join([f"- {obj}" for obj in learning_objectives]) if learning_objectives else "None specified"
        concepts_text = ", ".join(concept_ids) if concept_ids else "infer from context"

        prompt = f"""
        You are an expert engineering and biology educator. 
        Generate a formative assessment based on the following context.
        The primary goal of this assessment is to explicitly evaluate whether the student has met the defined Learning Objectives.
        
        Section Title: {section_title}
        Biology Context: {bio_context}
        Engineering Context: {eng_context}
        Learning Objectives to Evaluate:
        {objs_text}
        
        Requirements:
        1. Create exactly 2 Multiple Choice Questions (mcq_questions).
        2. Create exactly 1 Short Answer / Summary Question (summary_question) that requires generative knowledge construction.
        3. Questions should range from basic recall to conceptual application, strongly aligned with the Learning Objectives.
        4. Each question must target a specific concept. Use one of these target concepts if applicable: [{concepts_text}].
        5. For MCQs, provide 4 options (A, B, C, D) and a clear explanation for the correct answer.
        6. For the Short Answer question, provide a clear rubric or key points expected in the student's answer.
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
                "mcq_questions": [],
                "summary_question": None
            }

    def grade_summary(self, question: str, student_answer: str, rubric: str) -> dict:
        """Grades a student's summary/short-answer response."""
        
        prompt = f"""
        You are an expert engineering and biology educator grading a student's short answer response.
        
        Question: {question}
        Rubric/Expected Key Points: {rubric}
        Student Answer: {student_answer}
        
        Task:
        Evaluate the student's answer. Provide:
        1. content_score (0.0 to 1.0): Overall accuracy and completeness against the entire rubric.
        2. wording_score (0.0 to 1.0): How clear and well-structured is their writing?
        3. sub_scores: Break the rubric down into its core dimensions/concepts. For each dimension, assign a partial score (0.0 to 1.0). Return a dictionary where keys are the concept names and values are the scores.
        4. feedback: A brief, constructive feedback message (2-3 sentences max) starting with praise then pointing out any missing aspects.
        5. is_passing: true if content_score is >= 0.7.
        """
        
        try:
            if genai:
                response = self.client.models.generate_content(
                    model=self.model_id,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=SummaryGradingFeedback,
                        temperature=0.3,
                    ),
                )
                return json.loads(response.text)
            else:
                response = self.model.generate_content(
                    prompt,
                    generation_config=legacy_genai.GenerationConfig(
                        response_mime_type="application/json",
                        temperature=0.3,
                    )
                )
                return json.loads(response.text)
        except Exception as e:
            print(f"[ERROR] Summary grading failed: {e}")
            return {
                "content_score": 0.5,
                "wording_score": 0.5,
                "feedback": "Unable to automatically grade your response at this time.",
                "is_passing": False
            }
