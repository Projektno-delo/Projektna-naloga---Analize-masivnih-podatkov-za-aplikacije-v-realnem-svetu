import sys
import numpy as np
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from svm_face_recognition import predict_user

def test_no_face():
    print("[TEST] Testiram obnašanje modela brez obraza...")
    
    # naključen šum - ni obraz
    test_cases = [
        np.zeros((128, 128), dtype=np.float32),           
        np.ones((128, 128), dtype=np.float32),            
        np.random.rand(128, 128).astype(np.float32),      
    ]
    
    low_confidence = 0
    for i, face in enumerate(test_cases):
        username, prob = predict_user(face)
        print(f"[PREDICT] Prepoznan uporabnik: {username} (verjetnost: {prob:.2f})")
        if prob < 0.7:
            low_confidence += 1
    
    print(f"\n[TEST] Nizka zaupnost ({'{'}< 0.7{'}'}) pri: {low_confidence}/3 primerih")
    if low_confidence >= 2:
        print("[TEST OPOZORILO] Model ne zavrne slik brez obraza — priporočena je dodatna validacija!")
    else:
        print("[TEST] Model je relativno prepričan tudi pri slikah brez obraza.")

if __name__ == "__main__":
    test_no_face()