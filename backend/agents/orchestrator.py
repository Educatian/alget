# backend/agents/orchestrator.py
import json
from .biology_agent import BiologyAgent
from .engineering_agent import EngineeringAgent
from .tutor_agent import TutorAgent
from .validation_agent import ValidationAgent
from .evaluator_agent import EvaluatorAgent
from .activity_agent import ActivityAgent
from .simulation_agent import SimulationAgent
from .illustration_agent import IllustrationAgent
from .scaffolding_agent import ScaffoldingAgent

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from rag_service import rag_service

import logging
logger = logging.getLogger(__name__)

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

class OrchestratorAgent:
    def __init__(self, api_key: str):
        self.api_key = api_key
        if GENAI_AVAILABLE and api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None
            
        # Initialize specialized sub-agents
        self.biology_agent = BiologyAgent(api_key)
        self.validation_agent = ValidationAgent(api_key)
        self.engineering_agent = EngineeringAgent(api_key)
        self.tutor_agent = TutorAgent(api_key)
        self.evaluator_agent = EvaluatorAgent(api_key)
        self.activity_agent = ActivityAgent(api_key)
        self.simulation_agent = SimulationAgent(api_key)
        self.illustration_agent = IllustrationAgent(api_key)
        self.scaffolding_agent = ScaffoldingAgent(api_key)

    def orchestrate(self, query: str, grade_level: str, interest: str, current_bio_context: str = "", history: list = None) -> dict:
        """
        Main orchestration method:
        1. Analyzes intent.
        2. Routes/splits tasks to appropriate sub-agents based on intent.
        3. Returns structured output for the UI.
        """
        if history is None:
            history = []
        if not self.client:
            return {
                "intent": "error",
                "error": "Gemini API key is required.",
                "biology_context": "N/A",
                "engineering_application": "N/A",
                "summary": "API Key is missing."
            }
            
        logger.info(f"Processing query: {query}")
        
        # Determine Intent
        intent = self._classify_intent(query, history)
        logger.info(f"Classified Intent: {intent}")
        
        # Retrieve context from RAG Service
        rag_contexts = rag_service.retrieve_context(query, top_k=2)
        background_knowledge = "\\n\\n".join([
            f"Excerpt from {c['metadata'].get('filename', 'Textbook')}:\\n{c['content']}" 
            for c in rag_contexts
        ]) if rag_contexts else ""
        
        if intent == "evaluate":
            evaluation = self.evaluator_agent.evaluate_design(query, current_bio_context, history=history)
            return {
                "intent": intent,
                "evaluation": evaluation,
                "summary": "Evaluation complete."
            }
            
        elif intent == "help":
            logger.info("Help intent detected. Calling ScaffoldingAgent...")
            scaffolding_response = self.scaffolding_agent.provide_scaffolding(query, history=history)
            return {
                "intent": "help",
                "scaffolding": scaffolding_response,
                "summary": "Scaffolding provided."
            }
            
        elif intent == "brainstorm":
            if not current_bio_context:
                logger.info("Brainstorm intent missing bio context. Fetching from BiologyAgent...")
                bio_response_dict = self.biology_agent.analyze_biology(
                    query, grade_level, history=history, background_knowledge=background_knowledge
                )
                current_bio_context = json.dumps(bio_response_dict, indent=2) if isinstance(bio_response_dict, dict) else str(bio_response_dict)
                
            activity_response_dict = self.activity_agent.generate_brainstorming(current_bio_context, interest, history=history)
            return {
                "intent": "brainstorm",
                "biology_context": json.loads(current_bio_context) if isinstance(current_bio_context, str) and current_bio_context.startswith('{') else current_bio_context,
                "activity_brainstorm": activity_response_dict,
                "summary": "Brainstorming activity generated."
            }
            
        elif intent == "illustrate":
            if not current_bio_context:
                logger.info("Illustrate intent missing context. Fetching from BiologyAgent and EngineeringAgent...")
                bio_response_dict = self.biology_agent.analyze_biology(
                    query, grade_level, history=history, background_knowledge=background_knowledge
                )
                current_bio_context = json.dumps(bio_response_dict, indent=2) if isinstance(bio_response_dict, dict) else str(bio_response_dict)
                eng_response_dict = self.engineering_agent.analyze_engineering(query, interest, current_bio_context, history=history)
                current_eng_context = json.dumps(eng_response_dict, indent=2) if isinstance(eng_response_dict, dict) else str(eng_response_dict)
            else:
                eng_response_dict = self.engineering_agent.analyze_engineering(query, interest, current_bio_context, history=history)
                current_eng_context = json.dumps(eng_response_dict, indent=2) if isinstance(eng_response_dict, dict) else str(eng_response_dict)
                
            logger.info("Calling IllustrationAgent...")
            illustration_response_dict = self.illustration_agent.design_illustration(current_bio_context, current_eng_context, history=history)
            return {
                "intent": "illustrate",
                "illustration": illustration_response_dict,
                "summary": "Illustration design generated."
            }
            
        elif intent == "simulate":
            if not current_bio_context:
                logger.info("Simulate intent missing context. Fetching from BiologyAgent and EngineeringAgent...")
                bio_response_dict = self.biology_agent.analyze_biology(
                    query, grade_level, history=history, background_knowledge=background_knowledge
                )
                current_bio_context = json.dumps(bio_response_dict, indent=2) if isinstance(bio_response_dict, dict) else str(bio_response_dict)
                eng_response_dict = self.engineering_agent.analyze_engineering(query, interest, current_bio_context, history=history)
                current_eng_context = json.dumps(eng_response_dict, indent=2) if isinstance(eng_response_dict, dict) else str(eng_response_dict)
                
                validation_response_dict = self.validation_agent.validate_engineering_concept(current_bio_context, current_eng_context, history=history)
                validation_context = json.dumps(validation_response_dict, indent=2) if isinstance(validation_response_dict, dict) else str(validation_response_dict)
            else:
                eng_response_dict = self.engineering_agent.analyze_engineering(query, interest, current_bio_context, history=history)
                current_eng_context = json.dumps(eng_response_dict, indent=2) if isinstance(eng_response_dict, dict) else str(eng_response_dict)
                
                validation_response_dict = self.validation_agent.validate_engineering_concept(current_bio_context, current_eng_context, history=history)
                validation_context = json.dumps(validation_response_dict, indent=2) if isinstance(validation_response_dict, dict) else str(validation_response_dict)
                
            logger.info("Calling SimulationAgent...")
            simulation_response_dict = self.simulation_agent.generate_interactive_simulation(current_bio_context, current_eng_context, validation_context, history=history)
            return {
                "intent": "simulate",
                "simulation": simulation_response_dict,
                "summary": "Interactive simulation generated."
            }
            
        else: # Default to "learn"
            # 1. Biology Expert Agent
            bio_response_dict = self.biology_agent.analyze_biology(
                query, grade_level, history=history, background_knowledge=background_knowledge
            )
            logger.info("Biology Agent complete.")
            
            # Format for downstream agents
            bio_response_str = json.dumps(bio_response_dict, indent=2) if isinstance(bio_response_dict, dict) else str(bio_response_dict)
            
            # 2. Engineering Expert Agent (Initial V1)
            eng_response_dict = self.engineering_agent.analyze_engineering(query, interest, bio_response_str, history=history)
            logger.info("Engineering Agent complete.")
            eng_response_str = json.dumps(eng_response_dict, indent=2) if isinstance(eng_response_dict, dict) else str(eng_response_dict)
            
            # 2.5 Validation Agent (Quality Control V1)
            validation_response_dict = self.validation_agent.validate_engineering_concept(bio_response_str, eng_response_str, history=history)
            logger.info("Validation Agent complete.")
            val_response_str = json.dumps(validation_response_dict, indent=2) if isinstance(validation_response_dict, dict) else str(validation_response_dict)
            
            # --- DEBATE LOOP ---
            max_revisions = 2
            revision_count = 0
            
            # Check if validation failed (Score < 7 or is_valid is False)
            while revision_count < max_revisions and (
                isinstance(validation_response_dict, dict) and 
                (not validation_response_dict.get("is_valid", True) or validation_response_dict.get("score", 10) < 7)
            ):
                logger.info(f"Validation failed. Initiating Debate Loop (Revision {revision_count + 1})...")
                
                # Extract critique to pass back
                critique_str = f"Score: {validation_response_dict.get('score', 'N/A')}/10\\n"
                critique_str += f"Critique: {validation_response_dict.get('critique', 'N/A')}\\n"
                if validation_response_dict.get("suggestions"):
                    critique_str += "Suggestions:\\n" + "\\n".join([f"- {s}" for s in validation_response_dict.get("suggestions", [])])
                
                # Engineering Agent REVISES based on critique
                eng_response_dict = self.engineering_agent.revise_engineering(query, interest, bio_response_str, eng_response_str, critique_str, history=history)
                eng_response_str = json.dumps(eng_response_dict, indent=2) if isinstance(eng_response_dict, dict) else str(eng_response_dict)
                logger.info(f"Engineering Agent revision {revision_count + 1} complete.")
                
                # Validation Agent RE-EVALUATES the new revision
                validation_response_dict = self.validation_agent.validate_engineering_concept(bio_response_str, eng_response_str, history=history)
                val_response_str = json.dumps(validation_response_dict, indent=2) if isinstance(validation_response_dict, dict) else str(validation_response_dict)
                logger.info(f"Validation Agent re-evaluation {revision_count + 1} complete.")
                
                revision_count += 1
            # --- END DEBATE LOOP ---
            # 3. Tutor/Aggregator Agent
            final_summary_dict = self.tutor_agent.synthesize(query, grade_level, bio_response_str, eng_response_str, val_response_str, history=history)
            logger.info("Tutor Agent complete.")
            
            # 4. Activity Agent (Brainstorming alongside learning)
            activity_response_dict = self.activity_agent.generate_brainstorming(bio_response_str, interest, history=history)
            logger.info("Activity Agent complete.")
            
            return {
                "intent": intent,
                "query": query,
                "biology_context": bio_response_dict,
                "engineering_application": eng_response_dict,
                "validation_critique": validation_response_dict,
                "activity_brainstorm": activity_response_dict,
                "iterations": revision_count,
                "summary": final_summary_dict
            }
        
    def _classify_intent(self, query: str, history: list = None) -> str:
        """
        Classifies the student's query into: learn, evaluate, brainstorm.
        """
        history_text = ""
        if history:
            for msg in history:
                role = "Student" if msg.get("role") == "user" else "Assistant"
                history_text += f"{role}: {msg.get('content', '')}\n"

        prompt = f"""
        Classify the intent of the following student query into one of six categories:
        1. "learn": The student wants to learn a new concept or is asking a standard informational question.
        2. "evaluate": The student is proposing a design, sharing an idea, or asking for feedback on their work.
        3. "brainstorm": The student is asking for ideas, activities, or ways to brainstorm.
        4. "illustrate": The student is asking to draw, visualize, illustrate, or create a diagram/image of a concept.
        5. "simulate": The student is asking for an interactive physics simulation or interactive code representation.
        6. "help": The student explicitly states they are lost, stuck, confused, struggling, or asking for a hint. THIS OVERRIDES "learn" if they express negative emotion or confusion.
        
        Examples:
        - "How do geckos stick to walls?" -> learn
        - "Here is my design for a sticky shoe, what do you think?" -> evaluate
        - "Give me some crazy ideas for sticky robots" -> brainstorm
        - "Draw a diagram of the gecko setae" -> illustrate
        - "Show me a simulation of van der waals forces" -> simulate
        - "I'm totally lost. How do geckos stick to walls?" -> help
        - "I don't understand this at all, can you give me a hint?" -> help
        
        Respond with ONLY the exact word of the category ("learn", "evaluate", "brainstorm", "illustrate", "simulate", or "help").
        
        Conversation History:
        {history_text if history_text else "None"}

        Student Query: "{query}"
        """
        try:
            response = self.client.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.0)
            )
            intent = response.text.strip().lower()
            if intent not in ["learn", "evaluate", "brainstorm", "illustrate", "simulate", "help"]:
                return "learn"
            return intent
        except Exception as e:
            print(f"Intent classification failed: {e}")
            return "learn"
