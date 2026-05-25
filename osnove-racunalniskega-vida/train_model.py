import numpy as np
import joblib
from collections import Counter
from pathlib import Path
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report
from sklearn.preprocessing import StandardScaler

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
USERS_DIR = DATA_DIR / "users"


def load_dataset():
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
    print(f"[STATUS] Skupaj nalozeno: {len(X)} vzorcev obrazov.")

    if len(X) == 0:
        print("[OPOZORILO] Ni podatkov za trening! Preveri mapo z uporabniki.")
    elif len(label_map) < 2:
        print("[OPOZORILO] SVM potrebuje vsaj 2 razreda.")
        print("[NAMIG] Dodaj se enega uporabnika ali mapo slik za razred 'unknown'/'drugi'.")
    elif min(Counter(y).values()) < 2:
        print("[OPOZORILO] Vsak razred potrebuje vsaj 2 zaznana obraza za delitev train/test.")
    else:
        test_count = max(len(label_map), int(np.ceil(len(X) * 0.2)))
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_count, random_state=42, stratify=y
        )
        print(f"[INFO] Podatki razdeljeni: {len(X_train)} za ucenje, {len(X_test)} za test.")

        print("[INFO] Normalizacija podatkov z StandardScaler...")
        scaler = StandardScaler()
        X_train = scaler.fit_transform(X_train)
        X_test = scaler.transform(X_test)
        print("[STATUS] Normalizacija uspesno izvedena!")

        cv_folds = min(3, min(Counter(y_train).values()))
        if cv_folds >= 2:
            print("[INFO] Optimizacija hiperparametrov z GridSearchCV...")
            param_grid = {
                "C": [0.1, 1, 10, 100],
                "gamma": ["scale", "auto", 0.001, 0.01],
                "kernel": ["rbf", "linear"],
            }
            grid_search = GridSearchCV(
                SVC(probability=True),
                param_grid,
                cv=cv_folds,
                scoring="accuracy",
                verbose=1,
            )
            grid_search.fit(X_train, y_train)
            model = grid_search.best_estimator_
            print(f"[STATUS] Najboljsi hiperparametri: {grid_search.best_params_}")
            print(f"[STATUS] Najboljsa cross-validation tocnost: {grid_search.best_score_ * 100:.2f}%")
        else:
            print("[INFO] Premalo ucnih vzorcev za GridSearchCV, uporabljam privzeti SVC.")
            model = SVC(C=1, gamma="scale", kernel="rbf", probability=True)
            model.fit(X_train, y_train)

        y_pred = model.predict(X_test)
        acc = accuracy_score(y_test, y_pred)
        print(f"[EVALVACIJA] Tocnost modela na testnih podatkih: {acc * 100:.2f}%")
        print("[EVALVACIJA] Confusion matrix:")
        print(confusion_matrix(y_test, y_pred))
        print("[EVALVACIJA] Classification report:")
        print(classification_report(
            y_test,
            y_pred,
            labels=list(label_map.keys()),
            target_names=list(label_map.values()),
            zero_division=0,
        ))

        MODEL_DIR = BASE_DIR / "model"
        MODEL_DIR.mkdir(exist_ok=True)

        joblib.dump(model, MODEL_DIR / "svm_model.pkl")
        joblib.dump(label_map, MODEL_DIR / "label_map.pkl")
        joblib.dump(scaler, MODEL_DIR / "scaler.pkl")
        print("[STATUS] Model, scaler in label_map uspesno shranjeni!")
