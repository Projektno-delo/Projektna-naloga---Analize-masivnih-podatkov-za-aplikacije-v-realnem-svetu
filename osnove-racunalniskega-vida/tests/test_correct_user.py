import sys
import numpy as np
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from svm_face_recognition import predict_user

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "users"

def test_correct_user():
    print("[TEST] Testiram prepoznavo pravilne osebe...")
    
    npz_files = list(DATA_DIR.glob("*.npz"))
    if not npz_files:
        print("[NAPAKA] Ni podatkov v data/users/")
        return
    
    data = np.load(npz_files[0], allow_pickle=True)
    samples = data["samples"]
    username = str(data["username"])
    
    correct = 0
    for i, sample in enumerate(samples):
        predicted_user, probability = predict_user(sample)
        success = predicted_user == username
        if success:
            correct += 1
        print(f"  Vzorec {i+1}: predvideno={predicted_user}, pravo={username}, verjetnost={probability:.2f}, ok={success}")
    
    accuracy = correct / len(samples) * 100
    print(f"\nTočnost na vzorcih: {accuracy:.2f}% ({correct}/{len(samples)})")
    
    if accuracy == 100:
        print("Model pravilno prepozna registriranega uporabnika!")
    else:
        print("Model ne prepozna vseh vzorcev!")

if __name__ == "__main__":
    test_correct_user()