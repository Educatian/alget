import os
import json
import sys
from backend.agents.illustration_agent import IllustrationAgent
from backend.agents.orchestrator import OrchestratorAgent

# Load environment variables if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

def test_illustration_agent_direct():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Skipping direct test - no API key found.")
        return
        
    print("\n--- Testing IllustrationAgent Direct ---")
    agent = IllustrationAgent(api_key=api_key)
    
    bio_context = "Kingfisher birds dive into water with minimal splash due to their streamlined beak shape."
    eng_context = "The Shinkansen bullet train nose is modeled after the Kingfisher beak to reduce sonic booms when exiting tunnels."
    
    result = agent.design_illustration(bio_context, eng_context)
    print(json.dumps(result, indent=2))
    assert 'illustration_title' in result
    assert 'conceptual_design' in result
    assert 'image_prompt' in result

def test_orchestrator_illustration_intent():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Skipping orchestrator test - no API key found.")
        return
        
    print("\n--- Testing Orchestrator 'illustrate' Intent ---")
    orchestrator = OrchestratorAgent(api_key=api_key)
    query = "Draw an illustration showing the connection between a kingfisher beak and a bullet train."
    
    # We pass fake contexts just to speed up the test and bypass biology agent if we want, 
    # but let's test the full fetch logic.
    result = orchestrator.orchestrate(query, grade_level="Undergraduate", interest="Avian/Flight")
    
    print(f"Detected Intent: {result['intent']}")
    assert result['intent'] == 'illustrate'
    assert 'illustration' in result

if __name__ == "__main__":
    print("Running Illustration Agent Tests...")
    test_illustration_agent_direct()
    test_orchestrator_illustration_intent()
    print("\nAll tests passed successfully!")
