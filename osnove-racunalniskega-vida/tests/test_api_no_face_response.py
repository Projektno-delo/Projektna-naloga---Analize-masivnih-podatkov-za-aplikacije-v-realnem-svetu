import sys
from pathlib import Path

import cv2
import numpy as np
from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parent.parent))

import api_server


client = TestClient(api_server.app)


def make_test_image_bytes():
    image = np.zeros((128, 128, 3), dtype=np.uint8)
    success, encoded = cv2.imencode(".jpg", image)

    assert success

    return encoded.tobytes()


def test_predict_face_returns_no_face_response(monkeypatch):
    monkeypatch.setattr(api_server, "get_recognizer", lambda: {"kind": "test"})
    monkeypatch.setattr(
        api_server,
        "prepare_face_from_image",
        lambda image, force_night_mode=False: (None, None),
    )

    response = client.post(
        "/predict-face",
        files={
            "image": ("face.jpg", make_test_image_bytes(), "image/jpeg"),
        },
        data={
            "threshold": "0.7",
            "nightMode": "false",
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["success"] is False
    assert body["faceDetected"] is False
    assert body["predictedUser"] is None
    assert body["probability"] == 0.0
    assert body["accepted"] is False
    assert body["threshold"] == 0.7
    assert body["faceBox"] is None


def test_verify_face_returns_no_face_response(monkeypatch):
    monkeypatch.setattr(api_server, "get_recognizer", lambda: {"kind": "test"})
    monkeypatch.setattr(
        api_server,
        "prepare_face_from_image",
        lambda image, force_night_mode=False: (None, None),
    )

    response = client.post(
        "/verify-face",
        files={
            "image": ("face.jpg", make_test_image_bytes(), "image/jpeg"),
        },
        data={
            "expectedUser": "anze",
            "threshold": "0.7",
            "nightMode": "false",
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["success"] is False
    assert body["verified"] is False
    assert body["faceDetected"] is False
    assert body["expectedUser"] == "anze"
    assert body["predictedUser"] is None
    assert body["probability"] == 0.0
    assert body["threshold"] == 0.7
    assert body["faceBox"] is None