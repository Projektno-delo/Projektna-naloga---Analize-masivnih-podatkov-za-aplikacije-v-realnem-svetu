import sys
import numpy as np
from pathlib import Path
import cv2

sys.path.append(str(Path(__file__).resolve().parent.parent))
from svm_face_recognition import predict_user

THRESHOLDS = [0.5, 0.6, 0.7, 0.8, 0.9]

def test_threshold_analysis():
    test_dir = Path(__file__).resolve().parent.parent / "data" / "test_images"
    users = ["anja", "Maja", "Ziga"]

    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )

    results = {}

    for threshold in THRESHOLDS:

        accepted = 0
        rejected = 0
        total = 0

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

                total += 1

                if probability >= threshold:
                    accepted += 1
                else:
                    rejected += 1

        results[threshold] = {
            "accepted": accepted,
            "rejected": rejected,
            "total": total
        }

    print("\n===== ANALIZA THRESHOLDA =====")

    for threshold, data in results.items():

        print(
            f"Threshold {threshold:.1f} | "
            f"Sprejete: {data['accepted']}/{data['total']} | "
            f"Zavrnjene: {data['rejected']}/{data['total']}"
        )

if __name__ == "__main__":
    test_threshold_analysis()