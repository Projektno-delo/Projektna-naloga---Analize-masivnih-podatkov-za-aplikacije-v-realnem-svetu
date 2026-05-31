import sys
import numpy as np
from pathlib import Path
import cv2

sys.path.append(str(Path(__file__).resolve().parent.parent))

from svm_face_recognition import predict_user

THRESHOLD = 0.7

def test_low_confidence_analysis():

    test_dir = Path(__file__).resolve().parent.parent / "data" / "test_images"

    users = ["anja", "Maja", "Ziga"]

    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )

    print("\n===== ANALIZA NIZKE ZAUPNOSTI =====\n")

    low_confidence_count = 0

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

            username, probability = predict_user(face)

            if probability < THRESHOLD:

                low_confidence_count += 1

                print(f"Datoteka: {img_path.name}")
                print(f"Pravi uporabnik: {user}")
                print(f"Napoved modela: {username}")
                print(f"Verjetnost: {probability:.2f}")
                print("-" * 40)

    print(f"\nSkupaj slik pod thresholdom: {low_confidence_count}")

if __name__ == "__main__":
    test_low_confidence_analysis()