from pathlib import Path
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from face_name_preview import (
    MODEL_DIR,
    detect_largest_face,
    enhance_dark_face,
    load_model,
    predict_face,
)

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_THRESHOLD = 0.7
MIN_THRESHOLD = 0.0
MAX_THRESHOLD = 1.0
IMAGE_SIZE = (128, 128)
PHONE_PREVIEW_WINDOW = "ORV telefon kamera preview"
PHONE_PREVIEW_MAX_WIDTH = 420
PHONE_PREVIEW_MAX_HEIGHT = 560

app = FastAPI(
    title="Hribovc ORV Face Recognition API",
    description="API za uporabo modela računalniškega vida v aplikacijskem sistemu.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_model_cache: Any = None


def validate_threshold(threshold: float) -> float:
    if threshold < MIN_THRESHOLD or threshold > MAX_THRESHOLD:
        raise HTTPException(
            status_code=400,
            detail=f"Threshold mora biti med {MIN_THRESHOLD} in {MAX_THRESHOLD}.",
        )

    return threshold


def get_recognizer():
    global _model_cache

    if not is_model_available():
        raise HTTPException(
            status_code=503,
            detail=(
                "ORV model ni pripravljen. Najprej natreniraj model z ukazom: "
                "python .\\face_name_preview.py train"
            ),
        )

    if _model_cache is None:
        try:
            _model_cache = load_model(MODEL_DIR)
        except FileNotFoundError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        except Exception as error:
            raise HTTPException(
                status_code=500,
                detail=f"Napaka pri nalaganju ORV modela: {error}",
            ) from error

    return _model_cache


def read_image_from_upload(file: UploadFile) -> np.ndarray:
    raw_bytes = file.file.read()

    if not raw_bytes:
        raise HTTPException(
            status_code=400,
            detail="Prazna slikovna datoteka.",
        )

    image_array = np.frombuffer(raw_bytes, np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    if image is None:
        raise HTTPException(
            status_code=400,
            detail="Datoteke ni mogoče prebrati kot sliko.",
        )

    return image


def prepare_face_from_image(image: np.ndarray, force_night_mode: bool = False):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    detected_face = detect_largest_face(gray, force_night_mode=force_night_mode)

    if detected_face is None:
        return None, None

    x, y, w, h = detected_face

    face_crop = gray[y : y + h, x : x + w]
    face_crop = enhance_dark_face(face_crop, force_night_mode=force_night_mode)
    face_resized = cv2.resize(face_crop, IMAGE_SIZE)
    face_equalized = cv2.equalizeHist(face_resized)
    face_normalized = face_equalized.astype(np.float32) / 255.0

    return face_normalized, {
        "x": int(x),
        "y": int(y),
        "width": int(w),
        "height": int(h),
    }


def resize_for_phone_preview(frame: np.ndarray) -> np.ndarray:
    height, width = frame.shape[:2]
    scale = min(
        PHONE_PREVIEW_MAX_WIDTH / width,
        PHONE_PREVIEW_MAX_HEIGHT / height,
        1.0,
    )

    if scale >= 1.0:
        return frame

    return cv2.resize(
        frame,
        (int(width * scale), int(height * scale)),
        interpolation=cv2.INTER_AREA,
    )


def show_phone_preview_frame(
    image: np.ndarray,
    expected_user: str = "",
    force_night_mode: bool = False,
):
    frame = image.copy()
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    detected_face = detect_largest_face(gray, force_night_mode=force_night_mode)
    face_box = None

    if detected_face is not None:
        x, y, w, h = detected_face
        face_box = {
            "x": int(x),
            "y": int(y),
            "width": int(w),
            "height": int(h),
        }
        cv2.rectangle(frame, (x, y), (x + w, y + h), (52, 107, 255), 2)

    label = "Telefon kamera -> ORV"
    if expected_user:
        label = f"{label}: {expected_user}"

    cv2.putText(
        frame,
        label,
        (16, 32),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.75,
        (52, 107, 255),
        2,
        cv2.LINE_AA,
    )
    display_frame = resize_for_phone_preview(frame)
    cv2.namedWindow(PHONE_PREVIEW_WINDOW, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(
        PHONE_PREVIEW_WINDOW,
        display_frame.shape[1],
        display_frame.shape[0],
    )
    cv2.imshow(PHONE_PREVIEW_WINDOW, display_frame)
    cv2.waitKey(1)

    return face_box


def is_model_available() -> bool:
    recognizer_model = MODEL_DIR / "recognizer.pkl"
    svm_model = MODEL_DIR / "svm_model.pkl"
    scaler = MODEL_DIR / "scaler.pkl"
    label_map = MODEL_DIR / "label_map.pkl"

    return recognizer_model.exists() or (
        svm_model.exists()
        and scaler.exists()
        and label_map.exists()
    )


@app.get("/")
def root():
    return {
        "service": "Hribovc ORV Face Recognition API",
        "status": "running",
        "endpoints": [
            "GET /health",
            "POST /predict-face",
            "POST /verify-face",
            "POST /phone-preview-frame",
            "POST /phone-preview-close",
        ],
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "modelDirectory": str(MODEL_DIR),
        "modelAvailable": is_model_available(),
    }


@app.post("/predict-face")
async def predict_face_endpoint(
    image: UploadFile = File(...),
    threshold: float = Form(DEFAULT_THRESHOLD),
    nightMode: bool = Form(False),
):
    threshold = validate_threshold(threshold)
    recognizer = get_recognizer()
    uploaded_image = read_image_from_upload(image)

    prepared_face, face_box = prepare_face_from_image(
        uploaded_image,
        force_night_mode=nightMode,
    )

    if prepared_face is None:
        return {
            "success": False,
            "faceDetected": False,
            "predictedUser": None,
            "probability": 0.0,
            "accepted": False,
            "threshold": threshold,
            "faceBox": None,
            "message": "Obraz ni bil zaznan na poslani sliki.",
        }

    predicted_user, probability = predict_face(prepared_face, recognizer)
    accepted = probability >= threshold

    return {
        "success": True,
        "faceDetected": True,
        "predictedUser": predicted_user,
        "probability": round(float(probability), 4),
        "accepted": bool(accepted),
        "threshold": threshold,
        "faceBox": face_box,
        "message": "Obraz je bil uspešno obdelan.",
    }


@app.post("/verify-face")
async def verify_face_endpoint(
    image: UploadFile = File(...),
    expectedUser: str = Form(...),
    threshold: float = Form(DEFAULT_THRESHOLD),
    nightMode: bool = Form(False),
):
    threshold = validate_threshold(threshold)
    recognizer = get_recognizer()
    uploaded_image = read_image_from_upload(image)

    prepared_face, face_box = prepare_face_from_image(
        uploaded_image,
        force_night_mode=nightMode,
    )

    if prepared_face is None:
        return {
            "success": False,
            "verified": False,
            "faceDetected": False,
            "expectedUser": expectedUser,
            "predictedUser": None,
            "probability": 0.0,
            "threshold": threshold,
            "faceBox": None,
            "message": "Obraz ni bil zaznan na poslani sliki.",
        }

    predicted_user, probability = predict_face(prepared_face, recognizer)
    verified = predicted_user == expectedUser and probability >= threshold

    return {
        "success": True,
        "verified": bool(verified),
        "faceDetected": True,
        "expectedUser": expectedUser,
        "predictedUser": predicted_user,
        "probability": round(float(probability), 4),
        "threshold": threshold,
        "faceBox": face_box,
        "message": "Uporabnik je potrjen." if verified else "Uporabnik ni potrjen.",
    }


@app.post("/phone-preview-frame")
async def phone_preview_frame_endpoint(
    image: UploadFile = File(...),
    expectedUser: str = Form(""),
    nightMode: bool = Form(False),
):
    uploaded_image = read_image_from_upload(image)
    face_box = show_phone_preview_frame(
        uploaded_image,
        expected_user=expectedUser,
        force_night_mode=nightMode,
    )

    return {
        "success": True,
        "faceDetected": face_box is not None,
        "faceBox": face_box,
    }


@app.post("/phone-preview-close")
async def phone_preview_close_endpoint():
    try:
        cv2.destroyWindow(PHONE_PREVIEW_WINDOW)
    except cv2.error:
        pass

    return {
        "success": True,
    }
