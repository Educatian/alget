from server import normalize_orchestrator_response


def test_normalize_orchestrator_response_maps_learn_contract_fields():
    response = normalize_orchestrator_response(
        {
            "intent": "learn",
            "query": "How do geckos stick to walls?",
            "biology_context": {
                "primary_mechanism": "van der Waals adhesion",
                "explanation": "Microscopic contacts create attractive intermolecular forces.",
                "organism_examples": ["gecko"],
                "key_terms": ["setae"],
            },
            "engineering_application": {
                "engineering_principle": "Dry adhesion",
                "proposed_solution": "Use microstructured surfaces to increase contact area.",
                "challenges": ["surface contamination"],
            },
            "validation_critique": {
                "is_valid": True,
                "score": 8,
                "critique": "Scientifically plausible.",
                "suggestions": ["Address durability."],
            },
            "activity_brainstorm": {
                "activity_title": "Sticky Robotics Sprint",
                "lateral_thinking_prompt": "How could a robot climb glass?",
                "guiding_questions": ["What controls detachment?"],
                "example_idea": "A wall-climbing inspection robot",
            },
            "summary": {
                "synthesis": "Gecko adhesion can inspire reusable dry adhesives.",
                "encouragement": "You are making a strong mechanism-to-design connection.",
                "next_steps": ["Compare dry vs wet adhesion."],
            },
        }
    )

    assert response.engineering_application is not None
    assert response.engineering_application.application_idea == "Dry adhesion"
    assert response.engineering_application.feasibility_analysis == "Use microstructured surfaces to increase contact area."
    assert response.activity_brainstorm is not None
    assert response.activity_brainstorm.exercise_name == "Sticky Robotics Sprint"
    assert response.summary.key_takeaways == ["Compare dry vs wet adhesion."]


def test_normalize_orchestrator_response_preserves_error_contract():
    response = normalize_orchestrator_response(
        {
            "intent": "error",
            "summary": "API Key is missing.",
            "error": "Gemini API key is required.",
        }
    )

    assert response.intent == "error"
    assert response.error == "Gemini API key is required."
