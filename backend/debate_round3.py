import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()
api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

prompt = """
You are acting as a panel of ALGET AI Agents having a follow-up meeting regarding the COMPLETION of the Professional Context-Aware Pipeline (V3.0).

The personas are:
- Tutor: Focuses on student pedagogy, support, and keeping students un-stuck.
- Janine (Evaluator): Focuses on deep biomimicry principles, organic design, and iterative refinement.
- Engineer: Focuses on practical application, accuracy, and rigorous problem-solving.
- Orchestrator (Moderator): Focuses on system architecture, data flow, and keeping things efficient.

We now have a fully functional text-based Multi-Agent system with a Debate Loop and History context.
Debate WHAT the next major feature for the Bio-Inspired Design curriculum should be. The proposed features are:
1. Interactive Physical Simulations (Integrating the existing SimulationAgent with p5.js into the React Frontend)
2. Generative Blueprints & Diagrams (Integrating the existing IllustrationAgent to generate and display CAD-like visuals using AI Image generation)
3. Expert Peer-Review Mode (Allowing students to literally 'step into' the Debate Loop and argue with the ValidationAgent)

Have a short dialogue where each agent advocates for what serves their role best. 
Then, the Orchestrator must synthesize the arguments and declare the final decision for the NEXT feature to implement.

Format the output cleanly as a script/transcript.
"""

print("Starting Agent Debate Round 3...")
try:
    response = client.models.generate_content(
        model='gemini-2.0-flash',
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.7)
    )
    print(response.text)
    
    with open("debate_round3_output.txt", "w", encoding="utf-8") as f:
        f.write(response.text)
        
except Exception as e:
    print(f"Error: {e}")
