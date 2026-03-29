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
def test_orchestrate_illustration_endpoint_responds():
    response = requests.post(
        "http://127.0.0.1:8000/api/orchestrate",
        json={
            "query": "Draw a blueprint for a bullet train nose inspired by a kingfisher beak",
            "grade_level": "Undergraduate",
            "interest": "Aerospace Engineering",
            "history": [],
        },
        timeout=30,
    )

    assert response.status_code == 200
