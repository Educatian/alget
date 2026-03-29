from server import build_mastery_graph_payload


def test_mastery_graph_uses_course_metadata_and_marks_current_focus():
    payload = build_mastery_graph_payload(
        course="bio-inspired",
        mastery_data={
            "cellular_solids": 0.92,
            "porosity": 0.61,
        },
        current_section_id="bio-inspired/01/01",
        current_concepts=["cellular_solids"],
    )

    node_ids = {node["id"] for node in payload["nodes"]}
    assert "cellular_solids" in node_ids
    assert "porosity" in node_ids

    edges = {(edge["source"], edge["target"]) for edge in payload["links"]}
    assert ("cellular_solids", "porosity") in edges

    current_node = next(node for node in payload["nodes"] if node["id"] == "cellular_solids")
    assert current_node["is_current"] is True
    assert current_node["status"] == "mastered"
