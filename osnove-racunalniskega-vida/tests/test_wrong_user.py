import sys
import numpy as np
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from svm_face_recognition import predict_user

def test_wrong_user():
    """Test: model mora vrniti nizko verjetnost za neznano osebo."""
    print("[TEST] Testiram zavrnitev napačne osebe...")
    
    # Simuliramo neznano osebo z random podatki
    unknown_faces = [np.random.rand(128, 128).astype(np.float32) for _ in range(5)]
    
    low_confidence = 0
    THRESHOLD = 0.7
    
    for i, face in enumerate(unknown_faces):
        predicted_user, probability = predict_user(face)
        is_rejected = probability < THRESHOLD
        if is_rejected:
            low_confidence += 1
        print(f"  Test {i+1}: predvideno={predicted_user}, verjetnost={probability:.2f}, zavrnjen={is_rejected}")
    
    print(f"\n[REZULTAT] Zavrnjenih: {low_confidence}/5")
    
    if low_confidence >= 4:
        print("[TEST USPEŠEN] ✓ Model pravilno zavrne neznane osebe!")
    else:
        print("[TEST NEUSPEŠEN] ✗ Model sprejema neznane osebe!")

if __name__ == "__main__":
    test_wrong_user()