"""Small synchronous client for OpenRouter's OpenAI-compatible APIs."""
from __future__ import annotations

import os
import re
from dataclasses import dataclass
from types import SimpleNamespace
from typing import Any

import httpx


API_BASE = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "google/gemini-3.1-flash-lite"
DEFAULT_EMBEDDING_MODEL = "google/gemini-embedding-001"


@dataclass
class GenerateContentConfig:
    temperature: float | None = None
    max_output_tokens: int | None = None
    response_mime_type: str | None = None
    response_schema: Any = None


@dataclass
class EmbedContentConfig:
    output_dimensionality: int | None = None


types = SimpleNamespace(
    GenerateContentConfig=GenerateContentConfig,
    EmbedContentConfig=EmbedContentConfig,
)


@dataclass
class _Embedding:
    values: list[float]


@dataclass
class _TextResponse:
    text: str


def _schema_dict(schema: Any) -> dict[str, Any] | None:
    if schema is None:
        return None
    if isinstance(schema, dict):
        return schema
    if hasattr(schema, "model_json_schema"):
        return schema.model_json_schema()
    if hasattr(schema, "schema"):
        return schema.schema()
    raise TypeError("response_schema must be a JSON Schema or Pydantic model")


def _schema_name(schema: dict[str, Any]) -> str:
    name = schema.get("title") or "alget_response"
    return re.sub(r"[^a-zA-Z0-9_-]", "_", name)[:64]


def _inline_schema_refs(schema: dict[str, Any]) -> dict[str, Any]:
    definitions = schema.get("$defs", {})

    def expand(value: Any) -> Any:
        if isinstance(value, list):
            return [expand(item) for item in value]
        if not isinstance(value, dict):
            return value
        ref = value.get("$ref")
        if isinstance(ref, str) and ref.startswith("#/$defs/"):
            name = ref.rsplit("/", 1)[-1]
            if name not in definitions:
                raise ValueError(f"Unresolved JSON Schema reference: {ref}")
            expanded = expand(definitions[name])
            if len(value) > 1:
                expanded = {**expanded, **expand({k: v for k, v in value.items() if k != "$ref"})}
            return expanded
        return {
            key: expand(item)
            for key, item in value.items()
            if key not in {"$defs", "$schema"}
        }

    return expand(schema)


class _Models:
    def __init__(self, client: "OpenRouterClient"):
        self.client = client

    def generate_content(self, *, model: str | None, contents: Any, config: Any = None):
        model_id = self.client.resolve_model(model)
        prompt = contents if isinstance(contents, str) else str(contents)
        payload: dict[str, Any] = {
            "model": model_id,
            "messages": [{"role": "user", "content": prompt}],
        }
        if config:
            temperature = getattr(config, "temperature", None)
            max_tokens = getattr(config, "max_output_tokens", None)
            if temperature is not None:
                payload["temperature"] = temperature
            if max_tokens is not None:
                payload["max_tokens"] = max_tokens
            schema = _schema_dict(getattr(config, "response_schema", None))
            mime_type = getattr(config, "response_mime_type", None)
            if schema:
                schema = _inline_schema_refs(schema)
                payload["provider"] = {"require_parameters": True}
                payload["response_format"] = {
                    "type": "json_schema",
                    "json_schema": {
                        "name": _schema_name(schema),
                        "strict": False,
                        "schema": schema,
                    },
                }
            elif mime_type == "application/json":
                payload["response_format"] = {"type": "json_object"}

        response = self.client._post("/chat/completions", payload)
        choices = response.get("choices") or []
        if not choices:
            raise RuntimeError("OpenRouter returned no completion choices")
        content = (choices[0].get("message") or {}).get("content")
        if isinstance(content, list):
            content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
        if not isinstance(content, str):
            raise RuntimeError("OpenRouter returned an empty completion")
        return _TextResponse(text=content)

    def embed_content(self, *, model: str, contents: str, config: Any = None):
        model_id = os.environ.get("OPENROUTER_EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL)
        if "/" in model:
            model_id = model
        payload: dict[str, Any] = {"model": model_id, "input": contents}
        dimensions = getattr(config, "output_dimensionality", None) if config else None
        if dimensions is not None:
            payload["dimensions"] = dimensions
        response = self.client._post("/embeddings", payload)
        data = response.get("data") or []
        if not data or not data[0].get("embedding"):
            raise RuntimeError("OpenRouter returned no embedding vector")
        return SimpleNamespace(embeddings=[_Embedding(values=data[0]["embedding"])])


class OpenRouterClient:
    def __init__(self, api_key: str | None = None, timeout: float = 120.0):
        self.api_key = (api_key or os.environ.get("OPENROUTER_API_KEY", "")).strip()
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY is not configured")
        self.timeout = timeout
        self.models = _Models(self)

    @staticmethod
    def resolve_model(model: str | None) -> str:
        configured = os.environ.get("OPENROUTER_MODEL", DEFAULT_MODEL).strip()
        if not model or model == DEFAULT_MODEL:
            return configured
        return model if "/" in model else f"google/{model}"

    def _post(self, endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            response = httpx.post(
                f"{API_BASE}{endpoint}",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": os.environ.get("OPENROUTER_SITE_URL", "https://alget.pages.dev"),
                    "X-OpenRouter-Title": os.environ.get("OPENROUTER_APP_NAME", "ALGET"),
                },
                json=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as exc:
            try:
                detail = exc.response.json().get("error", {}).get("message")
            except Exception:
                detail = None
            raise RuntimeError(
                f"OpenRouter returned HTTP {exc.response.status_code}"
                + (f": {detail}" if detail else "")
            ) from None
        except httpx.RequestError as exc:
            raise RuntimeError(f"Could not reach OpenRouter ({exc.__class__.__name__})") from None


def generate_image(*, api_key: str, prompt: str, model: str | None = None, aspect_ratio: str = "16:9") -> tuple[str, str]:
    """Generate one image via OpenRouter's dedicated Images API."""
    client = OpenRouterClient(api_key=api_key, timeout=180.0)
    image_model = model or os.environ.get("OPENROUTER_IMAGE_MODEL", "google/gemini-2.5-flash-image")
    response = client._post(
        "/images",
        {"model": image_model, "prompt": prompt, "n": 1, "aspect_ratio": aspect_ratio},
    )
    data = response.get("data") or []
    if not data or not data[0].get("b64_json"):
        raise RuntimeError("OpenRouter returned no generated image")
    item = data[0]
    return item["b64_json"], item.get("media_type") or "image/png"
