from generation_trace import build_generation_trace


def test_generation_trace_records_context_without_claim_level_verification():
    trace = build_generation_trace(
        output={"text": "A generated explanation"},
        model="gemini-test",
        prompt_version="explain-v1",
        section_id="ail606-supplement/01/01",
        section_title="Cognitive load foundations",
        content_version={"content_version": "abc123"},
        source_text="Working memory is limited. " * 30,
    )

    assert trace["schema_version"] == "generation-trace-v1"
    assert trace["content_version"] == "abc123"
    assert trace["source_status"] == "context_attached"
    assert trace["verification"]["claim_level_citations"] is False
    assert trace["sources"][0]["locator"] == "ail606-supplement/01/01"
    assert len(trace["sources"][0]["excerpt"]) <= 280
    assert len(trace["output_hash"]) == 64


def test_generation_trace_is_honest_when_no_source_is_attached():
    trace = build_generation_trace(
        output="draft",
        model="gemini-test",
        prompt_version="draft-v1",
    )

    assert trace["source_status"] == "no_source_context"
    assert trace["sources"] == []
    assert trace["verification"]["status"] == "unverified"
    assert "unverified AI draft" in trace["limitations"][0]
