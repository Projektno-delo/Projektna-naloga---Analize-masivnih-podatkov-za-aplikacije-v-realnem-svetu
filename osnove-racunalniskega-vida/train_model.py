import numpy as np
import os
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
USERS_DIR = DATA_DIR / "users"

def load_dataset():
    """Nalaganje shranjenih slik iz .npz datotek (MAS-72)."""
    X, y = [], []
    label_map = {}
    current_label = 0

    if not USERS_DIR.exists():
        return np.array(X), np.array(y), label_map
    
    for npz_file in USERS_DIR.glob("*.npz"):
        data = np.load(npz_file, allow_pickle=True)
        samples = data["samples"]
        username = str(data["username"])
        
        label_map[current_label] = username
        
        for sample in samples:
            X.append(sample.flatten())  
            y.append(current_label)
            
        current_label += 1

    return np.array(X), np.array(y), label_map

if __name__ == "__main__":
    X, y, label_map = load_dataset()
    print(f"[STATUS] Skupaj uspešno naloženo: {len(X)} vzorcev obrazov.")
    
    if len(X) == 0:
        print("[OPOZORILO] Ni podatkov za trening! Preveri mapo z uporabniki.")
    else:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        print(f"[INFO] Podatki razdeljeni: {len(X_train)} za učenje, {len(X_test)} za test.")
        
        print("[INFO] Pričenjam z učenjem osnovnega SVM modela (RBF kernel)...")
        model = SVC(kernel='rbf', C=1.0, probability=True)
        model.fit(X_train, y_train)
        print("[STATUS] Model je uspešno naučen!")
        
        y_pred = model.predict(X_test)
        acc = accuracy_score(y_test, y_pred)
        print(f"[EVALVACIJA] Točnost modela na testnih podatkih: {acc * 100:.2f}%")