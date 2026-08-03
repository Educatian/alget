import socket

import pytest
import requests


def _local_server_available(host: str = "127.0.0.1", port: int = 8000) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.25)
        return sock.connect_ex((host, port)) == 0


@pytest.mark.skipif(
    not _local_server_available(),
    reason="Local backend server is not running on http://127.0.0.1:8000.",
)
def test_generate_scenario_endpoint_responds():
    response = requests.post(
        "http://127.0.0.1:8000/api/generate_scenario",
        json={
            "topic": "Classical Conditioning",
            "context": "Virtual Reality Classroom",
            "course": "inst-design",
        },
        timeout=30,
    )

    # The endpoint intentionally refuses to fabricate a scenario when the
    # local process has no model credential. Keep this optional live-server
    # probe honest without turning a missing secret into a product failure.
    if response.status_code == 400 and "GEMINI_API_KEY" in response.text:
        pytest.skip("Local backend is running without GEMINI_API_KEY.")

    assert response.status_code == 200
