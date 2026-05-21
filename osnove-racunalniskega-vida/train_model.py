import numpy as np
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
USERS_DIR = DATA_DIR / "users"

def load_dataset():
    """
    Funkcija pregleda mapo data/users, naloži vse .npz datoteke obeh oseb,
    uvozi matrike slik in pripravi seznama X (podatki) in y (oznake).
    """
    X = []
    y = []
    label_map = {}
    current_label = 0

    print("[INFO] Nalaganje shranjenih slik iz .npz datotek...")
    
    if not USERS_DIR.exists():
        print(f"[NAPAKA] Mapa {USERS_DIR} ne obstaja! Preveri strukturo map.")
        return np.array(X), np.array(y), label_map
    
    for npz_file in USERS_DIR.glob("*.npz"):
        data = np.load(npz_file, allow_pickle=True)
        samples = data["samples"]
        username = str(data["username"])
        
        label_map[current_label] = username
        print(f"[INFO] Uvožen uporabnik: {username} ({len(samples)} vzorcev)")
        
        for sample in samples:
            X.append(sample.flatten())  
            y.append(current_label)
            
        current_label += 1

    return np.array(X), np.array(y), label_map

if __name__ == "__main__":
    X, y, label_map = load_dataset()
    print(f"[STATUS] Skupaj uspešno naloženo: {len(X)} vzorcev obrazov.")