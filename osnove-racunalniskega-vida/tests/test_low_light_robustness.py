import sys
import numpy as np
from pathlib import Path
import cv2

sys.path.append(str(Path(__file__).resolve().parent.parent))

from svm_face_recognition import predict_user

def darken_image(image, factor=0.5):
    return np.clip(image * factor, 0, 1)

def test_low_light_robustness():

    test_dir = Path(__file__).resolve().parent.parent / "data" / "test_images"

    users = ["anja", "Maja", "Ziga"]

    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )

    normal_probs = []
    dark_probs = []

    print("\n===== LOW LIGHT TEST =====\n")

    for user in users:

        user_dir = test_dir / user

        if not user_dir.exists():
            continue

        for img_path in user_dir.glob("*.jpg"):

            img = cv2.imread(str(img_path))

            if img is None:
                continue

            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            faces = face_cascade.detectMultiScale(gray, 1.1, 4)

            if len(faces) == 0:
                continue

            x, y, w, h = faces[0]

            face = cv2.resize(
                gray[y:y+h, x:x+w],
                (128, 128)
            ).astype(np.float32) / 255.0

            _, normal_prob = predict_user(face)

            dark_face = darken_image(face, factor=0.5)

            _, dark_prob = predict_user(dark_face)

            normal_probs.append(normal_prob)
            dark_probs.append(dark_prob)

    avg_normal = np.mean(normal_probs)
    avg_dark = np.mean(dark_probs)

    print(f"Povprečna verjetnost (normalne slike): {avg_normal:.2f}")
    print(f"Povprečna verjetnost (temne slike): {avg_dark:.2f}")
    print(f"Razlika: {(avg_normal - avg_dark):.2f}")

if __name__ == "__main__":
    test_low_light_robustness()