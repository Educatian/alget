import os

import pytest
from dotenv import load_dotenv


load_dotenv(override=True)


@pytest.mark.skipif(
    not (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")),
    reason="Gemini API key required for live embedding smoke tests.",
)
def test_gemini_client_initializes_for_embedding_smoke():
    from google import genai

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    client = genai.Client(api_key=api_key)

    assert client is not None
