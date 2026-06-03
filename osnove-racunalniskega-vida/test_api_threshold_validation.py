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


def test_predict_face_rejects_threshold_above_one():
    response = client.post(
        "/predict-face",
        files={
            "image": ("face.jpg", make_test_image_bytes(), "image/jpeg"),
        },
        data={
            "threshold": "1.5",
            "nightMode": "false",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Threshold mora biti med 0.0 in 1.0."


def test_verify_face_rejects_threshold_below_zero():
    response = client.post(
        "/verify-face",
        files={
            "image": ("face.jpg", make_test_image_bytes(), "image/jpeg"),
        },
        data={
            "expectedUser": "anze",
            "threshold": "-0.1",
            "nightMode": "false",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Threshold mora biti med 0.0 in 1.0."