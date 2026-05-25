import numpy as np
import joblib
import argparse
import json
import time
from pathlib import Path
import cv2

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "model"
DATA_DIR = BASE_DIR / "data"
IMG_SIZE = (128, 128)
DEFAULT_THRESHOLD = 0.70

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

def load_model():
    model = joblib.load(MODEL_DIR / "svm_model.pkl")
    scaler = joblib.load(MODEL_DIR / "scaler.pkl")
    label_map = joblib.load(MODEL_DIR / "label_map.pkl")
    return model, scaler, label_map


def detect_largest_face(gray):
    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(70, 70),
    )
    if len(faces) == 0:
        return None

    return max(faces, key=lambda face: face[2] * face[3])


def prepare_face(frame, img_size=IMG_SIZE):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    detected = detect_largest_face(gray)

    if detected is None:
        return None, None

    x, y, w, h = detected
    face_crop = gray[y : y + h, x : x + w]
    face_resized = cv2.resize(face_crop, img_size)
    face_equalized = cv2.equalizeHist(face_resized)
    face_normalized = face_equalized.astype(np.float32) / 255.0

    return face_normalized, detected


def save_login_attempt(username, success, predicted_username, probability, threshold):
    login_log = DATA_DIR / "login-attempts.jsonl"
    login_log.parent.mkdir(parents=True, exist_ok=True)
    attempt = {
        "method": "svm",
        "username": username,
        "predicted_username": predicted_username,
        "success": bool(success),
        "probability": round(float(probability), 4),
        "threshold": float(threshold),
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    with login_log.open("a", encoding="utf-8") as log_file:
        log_file.write(json.dumps(attempt, ensure_ascii=False) + "\n")

def predict_user(face_array):
    model, scaler, label_map = load_model()
    
    face_flat = face_array.flatten().reshape(1, -1)
    face_scaled = scaler.transform(face_flat)
    
    label = model.predict(face_scaled)[0]
    class_index = list(model.classes_).index(label)
    probability = model.predict_proba(face_scaled)[0][class_index]
    username = label_map[label]
    
    print(f"[PREDICT] Prepoznan uporabnik: {username} (verjetnost: {probability:.2f})")
    return username, probability


def verify_identity(expected_username, face_array, threshold=DEFAULT_THRESHOLD):
    predicted_username, probability = predict_user(face_array)
    success = predicted_username.lower() == expected_username.lower() and probability >= threshold
    return success, predicted_username, probability


def verify_image(expected_username, image_path, threshold=DEFAULT_THRESHOLD):
    image = cv2.imread(str(image_path))
    if image is None:
        raise FileNotFoundError(f"Slike ni mogoce prebrati: {image_path}")

    face, _ = prepare_face(image)
    if face is None:
        save_login_attempt(expected_username, False, None, 0.0, threshold)
        print("LOGIN ZAVRNJEN - obraz ni zaznan.")
        return False

    success, predicted_username, probability = verify_identity(expected_username, face, threshold)
    save_login_attempt(expected_username, success, predicted_username, probability, threshold)

    if success:
        print(f"LOGIN DOVOLJEN za '{expected_username}' ({predicted_username}, {probability:.2f}).")
    else:
        print(f"LOGIN ZAVRNJEN za '{expected_username}' ({predicted_username}, {probability:.2f}).")

    return success


def login_user(expected_username, threshold=DEFAULT_THRESHOLD, camera_index=0):
    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise RuntimeError("Kamere ni mogoce odpreti.")

    print("Poglej v kamero. Pritisni SPACE za preverjanje, ali 'q' za izhod.")
    last_face = None
    predicted_username = None
    probability = 0.0
    success = False

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        face, detected = prepare_face(frame)
        preview = frame.copy()

        if face is not None and detected is not None:
            last_face = face
            predicted_username, probability = predict_user(face)
            color = (0, 180, 0) if predicted_username.lower() == expected_username.lower() else (0, 0, 255)
            x, y, w, h = detected
            cv2.rectangle(preview, (x, y), (x + w, y + h), color, 2)
            cv2.putText(
                preview,
                f"{predicted_username}: {probability:.2f}",
                (x, max(24, y - 10)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                color,
                2,
            )

        cv2.imshow("SVM face login", preview)
        key = cv2.waitKey(1) & 0xFF

        if key == ord(" "):
            success = (
                last_face is not None
                and predicted_username is not None
                and predicted_username.lower() == expected_username.lower()
                and probability >= threshold
            )
            break
        if key == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
    save_login_attempt(expected_username, success, predicted_username, probability, threshold)

    if success:
        print(f"LOGIN DOVOLJEN za '{expected_username}' ({predicted_username}, {probability:.2f}).")
    else:
        print(f"LOGIN ZAVRNJEN za '{expected_username}' ({predicted_username}, {probability:.2f}).")

    return success


def build_parser():
    parser = argparse.ArgumentParser(description="SVM face-recognition login.")
    subparsers = parser.add_subparsers(dest="command")

    login_parser = subparsers.add_parser("login", help="Preveri prijavo s kamero.")
    login_parser.add_argument("username")
    login_parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    login_parser.add_argument("--camera", type=int, default=0)

    verify_parser = subparsers.add_parser("verify-image", help="Preveri prijavo iz slike.")
    verify_parser.add_argument("username")
    verify_parser.add_argument("image_path")
    verify_parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "login":
        login_user(args.username, args.threshold, args.camera)
    elif args.command == "verify-image":
        verify_image(args.username, args.image_path, args.threshold)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
