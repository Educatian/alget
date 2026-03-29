import os
import urllib.request

import pytest
from dotenv import load_dotenv


load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")


@pytest.mark.skipif(
    not SUPABASE_URL or not SUPABASE_KEY,
    reason="SUPABASE_URL and SUPABASE_KEY are required for REST smoke tests.",
)
def test_supabase_mastery_rest_endpoint_reachable():
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/mastery",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
        },
    )

    with urllib.request.urlopen(req) as response:
        assert response.status < 400
