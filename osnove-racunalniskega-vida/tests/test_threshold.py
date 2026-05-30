import sys
import numpy as np
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from svm_face_recognition import predict_user

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "users"

def test_threshold():
    """Test: primerjava različnih pragov verjetnosti."""
    print("[TEST] Testiram različne pragove verjetnosti...")
    
    npz_files = list(DATA_DIR.glob("*.npz"))
    if not npz_files:
        print("[NAPAKA] Ni podatkov v data/users/")
        return
    
    data = np.load(npz_files[0], allow_pickle=True)
    samples = data["samples"]
    username = str(data["username"])
    
    thresholds = [0.5, 0.6, 0.7, 0.8, 0.9]
    
    print(f"\n  Testiramo z vzorci uporabnika: {username}")
    print(f"  {'Prag':<10} {'Sprejeto':<10} {'Zavrnjeno':<10}")
    print(f"  {'-'*30}")
    
    for threshold in thresholds:
        accepted = 0
        rejected = 0
        for sample in samples:
            _, probability = predict_user(sample)
            if probability >= threshold:
                accepted += 1
            else:
                rejected += 1
        print(f"  {threshold:<10} {accepted:<10} {rejected:<10}")
    
    print("\n[INFO] Priporočen prag: 0.7 — dober kompromis med varnostjo in uporabnostjo.")

if __name__ == "__main__":
    test_threshold()