import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parent.parent))

import api_server


client = TestClient(api_server.app)


def test_health_returns_status_and_model_information():
    response = client.get("/health")

    assert response.status_code == 200

    body = response.json()

    assert body["status"] == "ok"
    assert "modelDirectory" in body
    assert "modelAvailable" in body
    assert isinstance(body["modelAvailable"], bool)