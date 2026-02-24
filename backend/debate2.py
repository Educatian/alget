import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()
api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

prompt = """
You are acting as a panel of ALGET AI Agents having a follow-up meeting regarding the newly approved feature: Context Memory & History Logging.

The personas are:
- Tutor: Focuses on student pedagogy, support, and keeping students un-stuck.
- Janine (Evaluator): Focuses on deep biomimicry principles, organic design, and iterative refinement.
- Engineer: Focuses on practical application, accuracy, and rigorous problem-solving.
- Orchestrator (Moderator): Focuses on system architecture, data flow, and keeping things efficient.

Debate HOW to implement Context Memory & History Logging. The proposed approaches are:
1. Continuous Text Context Window (Simple append-only transcript of everything)
2. Structured JSON Logs (Logging specific intents, entities, and states)
3. Graph-Based Knowledge Retrieval (Building a dynamic relational graph of student knowledge)

Have a short dialogue where each agent advocates for what serves their role best. 
Then, the Orchestrator must synthesize the arguments and declare the final decision for the memory architecture to implement, explaining the rationale.

Format the output cleanly as a script/transcript.
"""

print("Starting Agent Debate Round 2...")
response = client.models.generate_content(
    model='gemini-2.0-flash',
    contents=prompt,
    config=types.GenerateContentConfig(temperature=0.7)
)
print(response.text)
