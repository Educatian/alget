import os
from dotenv import load_dotenv
from agents.orchestrator import OrchestratorAgent

load_dotenv()
api_key = os.environ.get("GEMINI_API_KEY")

agent = OrchestratorAgent(api_key=api_key)

print("--- Testing Help Intent ---")
response = agent.orchestrate(
    query="I'm totally lost. How do geckos stick to walls?",
    grade_level="Sophomore",
    interest="Robotics"
)

import json
print(json.dumps(response, indent=2))
