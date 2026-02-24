import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()
api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

prompt = """
You are acting as a panel of ALGET AI Agents having a meeting to decide the architectural roadmap.
The personas are:
- Tutor: Focuses on student pedagogy, support, and keeping students un-stuck.
- Janine (Evaluator): Focuses on deep biomimicry principles, organic design, and iterative refinement.
- Engineer: Focuses on practical application, accuracy, and rigorous problem-solving.
- Orchestrator (Moderator): Focuses on system architecture, data flow, and keeping things efficient.

Debate the following 4 proposed improvements for the ALGET system:
1. Implement the Scaffolding Agent (Socratic Tutor for when students are stuck)
2. Context Memory & History Logging (Remembering past interactions, contexts, and designs)
3. Multi-turn Evaluator Feedback loop (Iterative design refinement with Janine)
4. Integration with OpenStax book content (Seamlessly referencing course textbook text)

Have a short dialogue where each agent advocates for what they care about. 
Then, the Orchestrator must synthesize the arguments and declare the final decision for the SINGLE most important feature to build NEXT, explaining the dependency logic.

Format the output cleanly as a script/transcript.
"""

print("Starting Agent Debate...")
response = client.models.generate_content(
    model='gemini-2.0-flash',
    contents=prompt,
    config=types.GenerateContentConfig(temperature=0.7)
)
print(response.text)
