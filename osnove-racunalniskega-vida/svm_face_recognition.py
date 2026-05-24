import numpy as np
import joblib
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "model"

def load_model():
    model = joblib.load(MODEL_DIR / "svm_model.pkl")
    scaler = joblib.load(MODEL_DIR / "scaler.pkl")
    label_map = joblib.load(MODEL_DIR / "label_map.pkl")
    return model, scaler, label_map

def predict_user(face_array):
    model, scaler, label_map = load_model()
    
    face_flat = face_array.flatten().reshape(1, -1)
    face_scaled = scaler.transform(face_flat)
    
    label = model.predict(face_scaled)[0]
    probability = model.predict_proba(face_scaled)[0][label]
    username = label_map[label]
    
    print(f"[PREDICT] Prepoznan uporabnik: {username} (verjetnost: {probability:.2f})")
    return username, probability

if __name__ == "__main__":
    print("sam rendum test")
    dummy_face = np.random.rand(128, 128).astype(np.float32)
    username, probability = predict_user(dummy_face)
    print(f"Rezultat: {username}, verjetnost: {probability:.2f}")