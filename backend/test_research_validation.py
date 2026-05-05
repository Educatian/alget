from server import (
    ArtifactRevisionScoreRequest,
    ArtifactTraceValidationRequest,
    ResearchEvaluationItem,
    ResearchEvaluationValidationRequest,
    score_artifact_revision_payload,
    validate_artifact_trace_payload,
    validate_research_evaluation_payload,
)


def test_research_evaluation_validator_recomputes_item_level_scores():
    result = validate_research_evaluation_payload(
        ResearchEvaluationValidationRequest(
            course="cat100-supplement",
            phase="pre",
            score=1,
            percentage=50,
            total_questions=2,
            item_responses=[
                ResearchEvaluationItem(
                    item_id="q1",
                    concept_id="evidence_use",
                    is_correct=True,
                    selected_option=2,
                    correct_index=2,
                    confidence=4,
                    response_payload={"source": "DiagnosticAssessment"},
                ),
                ResearchEvaluationItem(
                    item_id="q2",
                    concept_id="revision_quality",
                    is_correct=False,
                    selected_option=1,
                    correct_index=3,
                    confidence=0.25,
                ),
            ],
        )
    )

    assert result["validator_pass"] is True
    assert result["computed_score"] == 1
    assert result["computed_percentage"] == 50
    assert result["normalized_item_responses"][0]["confidence"] == 0.8
    assert result["normalized_item_responses"][0]["response_payload"]["server_validated"] is True


def test_research_evaluation_validator_rejects_client_score_mismatch():
    result = validate_research_evaluation_payload(
        ResearchEvaluationValidationRequest(
            course="cat100-supplement",
            phase="post",
            score=2,
            percentage=100,
            total_questions=2,
            item_responses=[
                ResearchEvaluationItem(item_id="q1", is_correct=True),
                ResearchEvaluationItem(item_id="q2", is_correct=False),
            ],
        )
    )

    assert result["validator_pass"] is False
    assert "score_mismatch" in result["validation_errors"]
    assert "percentage_mismatch" in result["validation_errors"]


def test_artifact_trace_validator_recomputes_rubric_and_support_move():
    result = validate_artifact_trace_payload(
        ArtifactTraceValidationRequest(
            course="CAT 100",
            section="01.06",
            artifact="AI critique log showing accepted, modified, and rejected suggestions",
            support_move="compare",
            recommended_support_move="audit",
            initial_draft_length=30,
            claim_length=30,
            evidence_length=30,
            accepted_length=30,
            rejected_length=30,
            judgment_rationale_length=30,
            revised_draft_length=30,
            transfer_length=30,
            trace_score=8,
            trace_denominator=8,
            artifact_quality_score=1,
            rubric={
                "claim_visibility": 2,
                "evidence_specificity": 2,
                "support_boundary": 2,
                "revision_quality": 2,
                "rejection_rationale": 2,
                "transfer_constraint": 2,
            },
            confidence=4,
        )
    )

    assert result["validator_pass"] is True
    assert result["computed_trace_score"] == 8
    assert result["computed_artifact_quality_score"] == 1
    assert result["recommended_support_move"] == "audit"


def test_artifact_revision_scorer_scores_without_persisting_raw_text():
    result = score_artifact_revision_payload(
        ArtifactRevisionScoreRequest(
            course="AIL 606",
            section="02.04",
            artifact="AI-supported lesson redesign",
            studio_mode="traceability",
            initial_draft="Students will use AI to make a lesson plan about fractions.",
            claim="The lesson redesign supports learner variability with a specific UDL checkpoint.",
            evidence="The rubric requires alignment among objective, assessment, learner variability, and AI-use boundary.",
            judgment="modify",
            judgment_rationale="The AI suggestion was modified because it overgeneralized the learner support and did not cite the assessment constraint.",
            revised_draft=(
                "Students will use AI to compare two fraction explanations, select one misconception to address, "
                "and revise a formative check so the objective, assessment evidence, learner variability, and AI-use boundary align."
            ),
            transfer="In a different course context, the same AI-use boundary must change for older learners and a different assessment role.",
        )
    )

    assert result["validator_pass"] is True
    assert result["privacy"]["raw_text_persisted"] is False
    assert result["scores"]["overall_revision_quality"] > 0.5
    assert result["scores"]["evidence_alignment"] > 0
    assert result["diagnostics"]["added_token_count"] > 0
