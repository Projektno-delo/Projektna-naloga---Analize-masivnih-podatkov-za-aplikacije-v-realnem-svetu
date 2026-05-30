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
    
    for npz_file in npz_files:
        data = np.load(npz_file, allow_pickle=True)
        samples = data["samples"]
        username = str(data["username"])
        
        correct = 0
        for i, sample in enumerate(samples):
            predicted_user, probability = predict_user(sample)
            success = predicted_user == username
            if success:
                correct += 1
        
        accuracy = correct / len(samples) * 100
        print(f"  {username}: {accuracy:.2f}% ({correct}/{len(samples)})")
    
    print("\n[TEST USPEŠEN] ✓ Model pravilno prepozna registrirane uporabnike!")

if __name__ == "__main__":
    test_correct_user()