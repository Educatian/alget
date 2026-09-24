import os

import pytest
from dotenv import load_dotenv


load_dotenv(override=True)


@pytest.mark.skipif(
    not os.getenv("OPENROUTER_API_KEY"),
    reason="OpenRouter API key required for live embedding smoke tests.",
)
def test_openrouter_client_initializes_for_embedding_smoke():
    from openrouter_client import OpenRouterClient

    api_key = os.environ.get("OPENROUTER_API_KEY")
    client = OpenRouterClient(api_key=api_key)

    assert client is not None
