import sys
import numpy as np
import cv2
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from svm_face_recognition import predict_user

def test_multiple_faces():
    print("[TEST] Testiram obnašanje modela pri več obrazih na sliki...")
    
    test_dir = Path(__file__).resolve().parent.parent / "data" / "test_images"
    users = ["anja", "Maja", "Ziga"]
    
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    
    multiple_faces_found = 0
    total_checked = 0
    
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
            total_checked += 1
            if len(faces) > 1:
                multiple_faces_found += 1
                print(f"[VEČ OBRAZOV] {img_path.name}: {len(faces)} obrazi zaznani")
                for i, (x, y, w, h) in enumerate(faces):
                    face = cv2.resize(gray[y:y+h, x:x+w], (128, 128)).astype(np.float32) / 255.0
                    username, prob = predict_user(face)
                    print(f"  → Obraz {i+1}: {username} (verjetnost: {prob:.2f})")
    
    print(f"\n[TEST] Slike z več obrazi: {multiple_faces_found}/{total_checked}")
    if multiple_faces_found == 0:
        print("[TEST] Nobena slika ne vsebuje več obrazov.")
    else:
        print("[TEST OPOZORILO] Aplikacija mora določiti kateri obraz uporabiti pri prijavi!")

if __name__ == "__main__":
    test_multiple_faces()