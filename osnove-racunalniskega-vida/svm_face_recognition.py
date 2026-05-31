import numpy as np
import joblib
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "model"

THRESHOLD = 0.7
EXPECTED_SIZE = (128, 128)

# cache modela
_model_cache = None
_scaler_cache = None
_label_map_cache = None

def load_model():
    global _model_cache, _scaler_cache, _label_map_cache
    if _model_cache is None:
        _model_cache = joblib.load(MODEL_DIR / "svm_model.pkl")
        _scaler_cache = joblib.load(MODEL_DIR / "scaler.pkl")
        _label_map_cache = joblib.load(MODEL_DIR / "label_map.pkl")
        print("[INFO] Model naložen iz diska.")
    else:
        print("[INFO] Model naložen iz predpomnilnika.")
    return _model_cache, _scaler_cache, _label_map_cache

def predict_user(face_array):
    # validacija vhoda
    if face_array is None:
        print("[NAPAKA] Vhodni obraz je None.")
        return None, 0.0
    
    if face_array.shape[:2] != EXPECTED_SIZE:
        print(f"[NAPAKA] Napačna velikost obraza: {face_array.shape}, pričakovano: {EXPECTED_SIZE}")
        return None, 0.0
    
    model, scaler, label_map = load_model()
    
    face_flat = face_array.flatten().reshape(1, -1)
    face_scaled = scaler.transform(face_flat)
    
    label = model.predict(face_scaled)[0]
    probability = model.predict_proba(face_scaled)[0][label]
    username = label_map[label]
    
    if probability < THRESHOLD:
        print(f"[PREDICT] Zavrnjena napoved — prenizka zaupnost: {probability:.2f}")
        return None, probability
    
    print(f"[PREDICT] Prepoznan uporabnik: {username} (verjetnost: {probability:.2f})")
    return username, probability

if __name__ == "__main__":
    print("sam rendum test")
    dummy_face = np.random.rand(128, 128).astype(np.float32)
    username, probability = predict_user(dummy_face)
    print(f"Rezultat: {username}, verjetnost: {probability:.2f}")