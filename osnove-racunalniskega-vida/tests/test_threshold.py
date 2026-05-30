import sys
import numpy as np
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from svm_face_recognition import predict_user

THRESHOLD = 0.7

def test_threshold():
    print(f"[TEST] Testiram threshold verjetnosti (prag: {THRESHOLD})...")
    
    test_dir = Path(__file__).resolve().parent.parent / "data" / "test_images"
    users = ["anja", "Maja", "Ziga"]
    
    total = 0
    above_threshold = 0
    below_threshold = 0
    
    import cv2
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    
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
            face = cv2.resize(gray[y:y+h, x:x+w], (128, 128)).astype(np.float32) / 255.0
            username, prob = predict_user(face)
            total += 1
            if prob >= THRESHOLD:
                above_threshold += 1
            else:
                below_threshold += 1
                print(f"[NIZKA ZAUPNOST] {img_path.name}: {username} (verjetnost: {prob:.2f})")
    
    print(f"\n[TEST] Nad pragom: {above_threshold}/{total}")
    print(f"[TEST] Pod pragom: {below_threshold}/{total}")

if __name__ == "__main__":
    test_threshold()