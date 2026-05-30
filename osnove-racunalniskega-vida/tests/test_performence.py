import sys
import time
import numpy as np
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from svm_face_recognition import predict_user

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "users"

def test_performance():
    """Test: merjenje hitrosti napovedi modela."""
    print("[TEST] Testiram hitrost modela...")
    
    npz_files = list(DATA_DIR.glob("*.npz"))
    if not npz_files:
        print("[NAPAKA] Ni podatkov v data/users/")
        return
    
    data = np.load(npz_files[0], allow_pickle=True)
    samples = data["samples"]
    
    # Test hitrosti na 10 ponovitvah
    times = []
    print("\n  Merimo čas napovedi...")
    
    for i in range(10):
        face = samples[i % len(samples)]
        start = time.time()
        predict_user(face)
        end = time.time()
        elapsed = (end - start) * 1000  # v milisekundah
        times.append(elapsed)
        print(f"  Napoved {i+1}: {elapsed:.2f} ms")
    
    avg_time = np.mean(times)
    min_time = np.min(times)
    max_time = np.max(times)
    
    print(f"\n[REZULTAT] Povprečen čas: {avg_time:.2f} ms")
    print(f"[REZULTAT] Najhitrejša napoved: {min_time:.2f} ms")
    print(f"[REZULTAT] Najpočasnejša napoved: {max_time:.2f} ms")
    
    if avg_time < 100:
        print("[TEST USPEŠEN] ✓ Model je dovolj hiter za realnočasovno uporabo!")
    else:
        print("[TEST NEUSPEŠEN] ✗ Model je prepočasen!")

if __name__ == "__main__":
    test_performance()