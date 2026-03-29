from agents.orchestrator import OrchestratorAgent


def test_orchestrate_accepts_personalization_inputs_without_api_key():
    agent = OrchestratorAgent(api_key="")

    response = agent.orchestrate(
        query="I'm totally lost. How do geckos stick to walls?",
        grade_level="Sophomore",
        interest="Robotics",
    )

    assert response["intent"] == "error"
    assert "API Key" in response["summary"]
