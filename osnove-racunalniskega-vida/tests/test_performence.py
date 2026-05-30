import sys
import numpy as np
import time
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from svm_face_recognition import predict_user

def test_performance():
    print("[TEST] Testiram hitrost modela...")
    
    test_cases = [np.random.rand(128, 128).astype(np.float32) for _ in range(100)]
    
    times = []
    for face in test_cases:
        start_single = time.time()
        predict_user(face)
        end_single = time.time()
        times.append((end_single - start_single) * 1000)
    
    print(f"[TEST] Najhitrejša napoved: {min(times):.2f}ms")
    print(f"[TEST] Najpočasnejša napoved: {max(times):.2f}ms")
    print(f"[TEST] Povprečni čas na napoved: {sum(times)/len(times):.2f}ms")
    
    if sum(times)/len(times) < 100:
        print("[TEST USPEŠEN] ✓ Model je dovolj hiter za realnočasovno uporabo!")
    else:
        print("[TEST OPOZORILO] Model je počasen za realnočasovno uporabo.")

if __name__ == "__main__":
    test_performance()