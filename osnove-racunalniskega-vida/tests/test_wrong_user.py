import sys
import numpy as np
import cv2
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from svm_face_recognition import predict_user

def load_face_from_image(img_path):
    img = cv2.imread(str(img_path))
    if img is None:
        return None
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    faces = face_cascade.detectMultiScale(gray, 1.1, 4)
    if len(faces) == 0:
        return None
    x, y, w, h = faces[0]
    face = cv2.resize(gray[y:y+h, x:x+w], (128, 128))
    return face.astype(np.float32) / 255.0

def test_wrong_user():
    test_dir = Path(__file__).resolve().parent.parent / "data" / "test_images"
    users = ["anja", "Maja", "Ziga"]

    total = 0
    correct_rejections = 0

    for wrong_user in users:
        wrong_dir = test_dir / wrong_user
        if not wrong_dir.exists():
            continue
        images = list(wrong_dir.glob("*.jpg"))
        
        for correct_user in users:
            if correct_user == wrong_user:
                continue
            group_total = 0
            group_correct = 0
            for img_path in images:
                face = load_face_from_image(img_path)
                if face is None:
                    continue
                predicted, prob = predict_user(face)
                group_total += 1
                if predicted != correct_user:
                    group_correct += 1
            
            total += group_total
            correct_rejections += group_correct
            print(f"[TEST] {wrong_user} slike → preverja {correct_user}: {group_correct}/{group_total} ✓" if group_correct == group_total else f"[TEST] {wrong_user} slike → preverja {correct_user}: {group_correct}/{group_total} ✗")

    print(f"\n[TEST] Skupaj napačni uporabnik zavrnjen: {correct_rejections}/{total}")
    acc = correct_rejections / total * 1