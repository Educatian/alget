"""Statics/Dynamics questions must not use the bio-inspired pipeline or retrieval index."""
from unittest.mock import MagicMock, patch

from agents import orchestrator as orch_module
from agents.orchestrator import OrchestratorAgent


def _agent():
    agent = OrchestratorAgent.__new__(OrchestratorAgent)
    agent.client = object()  # any truthy client
    agent.tutor_agent = MagicMock()
    agent.tutor_agent.general_tutor.return_value = {"synthesis": "Equilibrium means the net force is zero."}
    agent._classify_intent = MagicMock(return_value="learn")
    return agent


def test_statics_goes_to_course_tutor_without_bio_retrieval():
    agent = _agent()
    with patch.object(orch_module.rag_service, "retrieve_context") as retrieve:
        result = agent.orchestrate(query="hi", course="statics", current_content="page", history=[],
                                   section_title="Equilibrium Conditions")
    retrieve.assert_not_called()
    agent._classify_intent.assert_not_called()
    args, kwargs = agent.tutor_agent.general_tutor.call_args
    assert args[1] == "statics"
    assert args[3] == ""  # no bio-inspired excerpts
    assert kwargs["section_title"] == "Equilibrium Conditions"
    assert result["intent"] == "learn"


def test_bio_inspired_still_uses_retrieval():
    agent = _agent()
    with patch.object(orch_module.rag_service, "retrieve_context", return_value=[]) as retrieve:
        try:
            agent.orchestrate(query="How do geckos stick?", course="bio-inspired", history=[])
        except Exception:
            pass  # the specialist agents are not set up in this test
    retrieve.assert_called_once()
    agent.tutor_agent.general_tutor.assert_not_called()
