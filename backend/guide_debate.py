import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()
api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

prompt = """
You are acting as a panel of ALGET AI Agents having a meeting to write a "User Guide" for students.
The students are mechanical engineering students learning Statics and Dynamics through the lens of Bio-Inspired Design (Biomimicry).

The personas are:
- Orchestrator: The system router. Focuses on how students should ask questions to trigger the right tools (e.g., "help", "evaluate", "simulate").
- Tutor: Focuses on how students should interact to learn best, embrace the Socratic method, and not just ask for answers.
- Janine (Evaluator): Focuses on how students should approach biological abstraction, use Life's Principles, and iterate on their designs.
- Engineer: Focuses on reminding students to ground their bio-inspired ideas in rigorous mechanics (FBDs, kinematics).

Your goal: Discuss and agree exactly what sections and advice must go into the "ALGET Student User Guide". 
1. Have a lively, multi-turn conversation where each agent contributes their specific advice for the students.
2. The Orchestrator should synthesize the discussion at the end and outline the official structure of the User Guide.

Format the output cleanly as a script/transcript.
"""

print("Starting User Guide Agent Debate...")
response = client.models.generate_content(
    model='gemini-2.0-flash',
    contents=prompt,
    config=types.GenerateContentConfig(temperature=0.7)
)

print(response.text)

with open("guide_conversation_log.md", "w", encoding="utf-8") as f:
    f.write("# ALGET User Guide Creation Debate\n\n")
    f.write(response.text)
    
print("Successfully saved to guide_conversation_log.md")
