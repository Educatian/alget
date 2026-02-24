import os
import sys
import json
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.agents.validation_agent import ValidationAgent
from backend.agents.orchestrator import OrchestratorAgent

load_dotenv()

API_KEY = os.environ.get("GEMINI_API_KEY")

if not API_KEY:
    print("Error: GEMINI_API_KEY not found in .env")
    sys.exit(1)

def test_validation_independent():
    print("\n--- Testing ValidationAgent Independently ---")
    agent = ValidationAgent(API_KEY)
    
    bio_context = "Gecko toes have millions of microscopic hairs called setae. These setae branch off into even smaller spatulae. The combined microscopic surface area allows geckos to utilize intermolecular van der Waals forces to stick to almost any surface, completely dry."
    
    eng_context_valid = "We can create a specialized climbing tape that mimics the hierarchical structure of gecko setae using carbon nanotubes. This dry adhesive tape would allow a robot to climb smooth glass walls using van der Waals forces."
    
    eng_context_invalid = "We propose modifying human genetics to grow gecko setae directly on the palms of our hands, allowing students to permanently walk on ceilings using magical sticky fluids that geckos secrete."
    
    print("\nTesting Valid Concept:")
    valid_res = agent.validate_engineering_concept(bio_context, eng_context_valid)
    print(json.dumps(valid_res, indent=2))
    
    print("\nTesting Invalid Concept:")
    invalid_res = agent.validate_engineering_concept(bio_context, eng_context_invalid)
    print(json.dumps(invalid_res, indent=2))

def test_orchestrator():
    print("\n--- Testing Full Orchestrator Integration ---")
    agent = OrchestratorAgent(API_KEY)
    
    query = "How can humans walk on walls like geckos?"
    grade_level = "Sophomore"
    interest = "Biomedical Engineering"
    
    res = agent.orchestrate(query, grade_level, interest)
    
    print("\nValidation Result:")
    print(json.dumps(res.get("validation_critique", {}), indent=2))
    
    print("\nFinal Tutor Summary:")
    print(json.dumps(res.get("summary", {}), indent=2))
    
if __name__ == "__main__":
    test_validation_independent()
    test_orchestrator()
