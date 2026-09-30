"""Offline tests for the OpenRouter request payload (no network, no API key)."""
import json

from openrouter_client import OpenRouterClient, types


def _captured_schema(schema):
    client = OpenRouterClient(api_key="test-key")
    captured = {}

    def fake_post(endpoint, payload):
        captured["payload"] = payload
        return {"choices": [{"message": {"content": "{}"}}]}

    client._post = fake_post
    client.models.generate_content(
        model=None,
        contents="prompt",
        config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=schema),
    )
    return captured["payload"]["response_format"]["json_schema"]["schema"]


def test_gemini_style_types_are_lowercased():
    schema = _captured_schema({
        "type": "OBJECT",
        "properties": {
            "explanation": {"type": "STRING"},
            "score": {"type": "INTEGER"},
            "key_terms": {"type": "ARRAY", "items": {"type": "STRING"}},
            "nested": {"type": "OBJECT", "properties": {"ok": {"type": "BOOLEAN"}}},
        },
        "required": ["explanation"],
    })

    assert schema["type"] == "object"
    assert schema["properties"]["explanation"]["type"] == "string"
    assert schema["properties"]["score"]["type"] == "integer"
    assert schema["properties"]["key_terms"]["items"]["type"] == "string"
    assert schema["properties"]["nested"]["properties"]["ok"]["type"] == "boolean"
    assert schema["required"] == ["explanation"]


def test_property_named_type_is_preserved():
    schema = _captured_schema({
        "type": "OBJECT",
        "properties": {"type": {"type": "STRING", "enum": ["MCQ", "OPEN"]}},
    })

    assert schema["properties"]["type"] == {"type": "string", "enum": ["MCQ", "OPEN"]}


def test_standard_json_schema_is_unchanged():
    original = {"type": "object", "properties": {"a": {"type": ["string", "null"]}}}
    assert _captured_schema(json.loads(json.dumps(original))) == original
