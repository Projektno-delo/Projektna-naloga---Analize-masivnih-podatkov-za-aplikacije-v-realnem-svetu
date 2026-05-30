import sys
import numpy as np
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from svm_face_recognition import predict_user

def test_no_face():
    """Test: model mora obvladati situacijo ko ni obraza."""
    print("[TEST] Testiram obnašanje brez obraza...")
    
    test_cases = [
        ("Črna slika", np.zeros((128, 128), dtype=np.float32)),
        ("Bela slika", np.ones((128, 128), dtype=np.float32)),
        ("Slika s šumom", np.random.rand(128, 128).astype(np.float32) * 0.1),
    ]
    
    for naziv, slika in test_cases:
        try:
            predicted_user, probability = predict_user(slika)
            print(f"  {naziv}: predvideno={predicted_user}, verjetnost={probability:.2f}")
        except Exception as e:
            print(f"  {naziv}: napaka={e}")
    
    print("\n[INFO] Test zaključen — preverili smo obnašanje modela brez obraza.")

if __name__ == "__main__":
    test_no_face()