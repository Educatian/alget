import os
import sys
import json
import webbrowser
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.agents.simulation_agent import SimulationAgent

load_dotenv()

API_KEY = os.environ.get("GEMINI_API_KEY")

if not API_KEY:
    print("Error: GEMINI_API_KEY not found in .env")
    sys.exit(1)

def test_simulation_agent():
    print("\n--- Testing Simulation Agent HTML Generation ---")
    agent = SimulationAgent(API_KEY)
    
    bio_context = "Gecko toes stick using dry van der Waals forces via millions of microscopic setae."
    eng_context = "A dry adhesive climbing pad mimicking gecko spatulae that allows scaling smooth glass."
    validation_context = "Score: 9. Feasible if surface area is maximized. Adhesion force linearly depends on the contact area."
    
    res = agent.generate_interactive_simulation(bio_context, eng_context, validation_context)
    
    print("\n--- Summary ---")
    print(res.get("description", "No description"))
    print("\nConcepts:", res.get("concepts_shown", []))
    
    html = res.get("html_code", "")
    
    if html:
        with open("simulation_test_output.html", "w", encoding="utf-8") as f:
            f.write(html)
            
        file_path = f"file://{os.path.abspath('simulation_test_output.html')}"
        print(f"\n✅ HTML generated successfully! Opening {file_path}")
        webbrowser.open(file_path)
    else:
        print("\n❌ Failed to generate HTML.")
        print(json.dumps(res, indent=2))

if __name__ == "__main__":
    test_simulation_agent()
