import argparse
import json
from pathlib import Path

import cv2
import joblib
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
TEST_IMAGES_DIR = DATA_DIR / "test_images"
MODEL_DIR = BASE_DIR / "model_from_test_images"
RECOGNIZER_FILE = "recognizer.pkl"
IMG_SIZE = (128, 128)
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
PREVIEW_WINDOW = "Face name preview"
USERS_PREVIEW_WINDOW = "Face login profiles preview"
LOGIN_WINDOW = "Hribovc ORV face login"

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)


def focus_window(window_name):
    try:
        cv2.setWindowProperty(window_name, cv2.WND_PROP_TOPMOST, 1)
        cv2.waitKey(1)
        cv2.setWindowProperty(window_name, cv2.WND_PROP_TOPMOST, 0)
    except cv2.error:
        pass

    try:
        import ctypes

        user32 = ctypes.windll.user32
        handle = user32.FindWindowW(None, window_name)
        if handle:
            user32.ShowWindow(handle, 5)
            user32.SetForegroundWindow(handle)
    except Exception:
        pass


def detect_largest_face(gray):
    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(70, 70),
    )

    if len(faces) == 0:
        return None

    return max(faces, key=lambda face: face[2] * face[3])


def prepare_face(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    detected = detect_largest_face(gray)

    if detected is None:
        return None, None

    x, y, w, h = detected
    face_crop = gray[y : y + h, x : x + w]
    face_resized = cv2.resize(face_crop, IMG_SIZE)
    face_equalized = cv2.equalizeHist(face_resized)
    face_normalized = face_equalized.astype(np.float32) / 255.0

    return face_normalized, detected


def iter_named_images(images_dir):
    if not images_dir.exists():
        raise FileNotFoundError(f"Mapa ne obstaja: {images_dir}")

    for person_dir in sorted(path for path in images_dir.iterdir() if path.is_dir()):
        person_name = person_dir.name

        for image_path in sorted(person_dir.iterdir()):
            if image_path.suffix.lower() in IMAGE_EXTENSIONS:
                yield person_name, image_path


def load_training_data(images_dir):
    samples = []
    labels = []
    label_map = {}
    name_to_label = {}
    skipped = []

    for person_name, image_path in iter_named_images(images_dir):
        if person_name not in name_to_label:
            label_id = len(name_to_label)
            name_to_label[person_name] = label_id
            label_map[label_id] = person_name

        image = cv2.imread(str(image_path))
        if image is None:
            skipped.append((image_path, "slike ni mogoce prebrati"))
            continue

        face, _ = prepare_face(image)
        if face is None:
            skipped.append((image_path, "obraz ni zaznan"))
            continue

        samples.append(face.flatten())
        labels.append(name_to_label[person_name])

    return np.array(samples), np.array(labels), label_map, skipped


def train_from_test_images(images_dir=TEST_IMAGES_DIR, model_dir=MODEL_DIR):
    X, y, label_map, skipped = load_training_data(images_dir)

    if len(X) == 0:
        raise RuntimeError("Ni uporabnih slik za trening.")

    recognizer = {
        "kind": "nearest",
        "samples": X.astype(np.float32),
        "labels": y.astype(int),
        "label_map": label_map,
    }

    if len(label_map) >= 2:
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        model = SVC(kernel="rbf", C=10, gamma="scale", probability=True)
        model.fit(X_scaled, y)

        recognizer.update({
            "kind": "svm",
            "model": model,
            "scaler": scaler,
        })

    model_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(recognizer, model_dir / RECOGNIZER_FILE)
    joblib.dump(label_map, model_dir / "label_map.pkl")

    if recognizer["kind"] == "svm":
        joblib.dump(recognizer["model"], model_dir / "svm_model.pkl")
        joblib.dump(recognizer["scaler"], model_dir / "scaler.pkl")

    print(f"[OK] Model shranjen v: {model_dir}")
    print(f"[OK] Nacin prepoznave: {recognizer['kind']}")
    print("[OK] Imena iz map:")
    for label_id, name in label_map.items():
        count = int(np.sum(y == label_id))
        print(f"  - {name}: {count} uporabnih slik")

    if recognizer["kind"] == "nearest":
        print(
            "[INFO] Najdena je samo ena oseba z uporabnimi slikami, "
            "zato skript uporablja primerjavo z vzorci namesto SVM."
        )

    if skipped:
        print("[INFO] Preskocene slike:")
        for image_path, reason in skipped:
            print(f"  - {image_path.name}: {reason}")


def safe_username(name):
    cleaned = "".join(ch for ch in name.lower() if ch.isalnum() or ch in ("-", "_"))
    if not cleaned:
        raise ValueError(f"Ime mape ni veljavno uporabnisko ime: {name}")

    return cleaned


def export_test_images_to_users(
    images_dir=TEST_IMAGES_DIR,
    users_dir=DATA_DIR / "users",
    overwrite=False,
):
    X, y, label_map, skipped = load_training_data(images_dir)

    if len(X) == 0:
        raise RuntimeError("Ni uporabnih slik za izvoz v data/users.")

    users_dir.mkdir(parents=True, exist_ok=True)

    print("[INFO] Izvoz v format, ki ga uporablja detect-face.py login ...")

    for label_id, person_name in label_map.items():
        samples = X[y == label_id].reshape((-1, IMG_SIZE[1], IMG_SIZE[0]))
        username = safe_username(person_name)
        profile_path = users_dir / f"{username}.npz"

        if profile_path.exists() and not overwrite:
            print(
                f"[SKIP] {profile_path.name} ze obstaja. "
                "Za prepis uporabi: --overwrite"
            )
            continue

        if profile_path.exists() and overwrite:
            backup_path = profile_path.with_suffix(profile_path.suffix + ".bak")
            counter = 1
            while backup_path.exists():
                backup_path = profile_path.with_suffix(profile_path.suffix + f".bak{counter}")
                counter += 1

            profile_path.replace(backup_path)
            print(f"[BACKUP] Star profil shranjen kot: {backup_path.name}")

        np.savez_compressed(
            profile_path,
            samples=samples.astype(np.float32),
            username=username,
            source=f"test_images/{person_name}",
        )
        print(f"[OK] {person_name} -> {profile_path} ({len(samples)} vzorcev)")

    if skipped:
        print("[INFO] Preskocene slike:")
        for image_path, reason in skipped:
            print(f"  - {image_path.name}: {reason}")


def load_user_profiles(users_dir=DATA_DIR / "users"):
    profiles = {}

    if not users_dir.exists():
        raise FileNotFoundError(f"Mapa ne obstaja: {users_dir}")

    for profile_path in sorted(users_dir.glob("*.npz")):
        data = np.load(profile_path, allow_pickle=False)
        username = str(data["username"]) if "username" in data else profile_path.stem
        profiles[username] = data["samples"]

    if not profiles:
        raise RuntimeError(f"V mapi ni uporabniskih profilov: {users_dir}")

    return profiles


def predict_from_user_profiles(face, profiles):
    face_flat = face.flatten()
    best_name = None
    best_score = 0.0

    for username, samples in profiles.items():
        for sample in samples:
            score = cosine_similarity(face_flat, sample.flatten())
            if score > best_score:
                best_name = username
                best_score = score

    return best_name or "neznan", best_score


def preview_users(users_dir=DATA_DIR / "users", camera_index=0, threshold=0.95):
    profiles = load_user_profiles(users_dir)
    print("[INFO] Nalozeni ORV profili:", ", ".join(profiles.keys()))
    print("[INFO] To uporablja isti tip profila kot: python .\\detect-face.py login ziga")
    print("[INFO] Pritisni q za izhod.")

    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise RuntimeError("Kamere ni mogoce odpreti.")

    last_printed = None
    focused = False

    cv2.namedWindow(USERS_PREVIEW_WINDOW, cv2.WINDOW_NORMAL)

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        face, box = prepare_face(frame)

        if face is not None and box is not None:
            name, confidence = predict_from_user_profiles(face, profiles)
            draw_label(frame, box, name, confidence, threshold)

            printed = (name, round(confidence, 2))
            if printed != last_printed:
                print(f"[PREDICT] {name} ({confidence:.2f})")
                last_printed = printed
        else:
            cv2.putText(
                frame,
                "Obraz ni zaznan",
                (16, 32),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 0, 255),
                2,
            )

        cv2.imshow(USERS_PREVIEW_WINDOW, frame)

        if not focused:
            focus_window(USERS_PREVIEW_WINDOW)
            focused = True

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


def login_users(username, users_dir=DATA_DIR / "users", camera_index=0, threshold=0.95):
    expected_username = safe_username(username)
    profiles = load_user_profiles(users_dir)

    if expected_username not in profiles:
        return {
            "success": False,
            "username": expected_username,
            "recognized": None,
            "score": None,
            "threshold": threshold,
            "method": "orv-face-name-preview",
            "error": f"Profil '{expected_username}' ni najden v data/users.",
        }

    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        return {
            "success": False,
            "username": expected_username,
            "recognized": None,
            "score": None,
            "threshold": threshold,
            "method": "orv-face-name-preview",
            "error": "Kamere ni mogoce odpreti.",
        }

    best_name = None
    best_score = 0.0
    success = False
    focused = False

    print("Poglej v kamero. Pritisni SPACE za preverjanje, ali q za izhod.")
    print("Nalozeni profili:", ", ".join(profiles.keys()))

    cv2.namedWindow(LOGIN_WINDOW, cv2.WINDOW_NORMAL)

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        face, box = prepare_face(frame)

        if face is not None and box is not None:
            best_name, best_score = predict_from_user_profiles(face, profiles)
            draw_label(frame, box, best_name, best_score, threshold)

            x, y, _, h = box
            expected_text = f"Prijava kot: {expected_username}"
            cv2.putText(
                frame,
                expected_text,
                (x, y + h + 28),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                (255, 255, 255),
                2,
            )
        else:
            cv2.putText(
                frame,
                "Obraz ni zaznan",
                (16, 32),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 0, 255),
                2,
            )

        cv2.imshow(LOGIN_WINDOW, frame)

        if not focused:
            focus_window(LOGIN_WINDOW)
            focused = True

        key = cv2.waitKey(1) & 0xFF

        if key == ord(" "):
            success = (
                best_name == expected_username
                and best_score >= threshold
            )
            break

        if key == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()

    return {
        "success": bool(success),
        "username": expected_username,
        "recognized": best_name,
        "score": round(float(best_score), 4),
        "threshold": threshold,
        "method": "orv-face-name-preview",
        "error": None if success else "Face login ni uspel.",
    }


def load_model(model_dir):
    recognizer_path = model_dir / RECOGNIZER_FILE
    if recognizer_path.exists():
        return joblib.load(recognizer_path)

    model_path = model_dir / "svm_model.pkl"
    scaler_path = model_dir / "scaler.pkl"
    label_map_path = model_dir / "label_map.pkl"

    missing = [
        path.name
        for path in (model_path, scaler_path, label_map_path)
        if not path.exists()
    ]
    if missing:
        raise FileNotFoundError(
            f"Manjkajo datoteke v {model_dir}: {', '.join(missing)}. "
            "Najprej zazeni: python .\\face_name_preview.py train"
        )

    return {
        "kind": "svm",
        "model": joblib.load(model_path),
        "scaler": joblib.load(scaler_path),
        "label_map": joblib.load(label_map_path),
    }


def label_name(label_map, label):
    if label in label_map:
        return label_map[label]

    text_key = str(label)
    if text_key in label_map:
        return label_map[text_key]

    return f"label-{label}"


def cosine_similarity(a, b):
    denominator = np.linalg.norm(a) * np.linalg.norm(b)
    if denominator == 0:
        return 0.0

    return float(np.dot(a, b) / denominator)


def predict_nearest(face, recognizer):
    face_flat = face.flatten()
    samples = recognizer["samples"]
    labels = recognizer["labels"]
    label_map = recognizer["label_map"]

    scores = [cosine_similarity(face_flat, sample) for sample in samples]
    best_index = int(np.argmax(scores))
    best_label = int(labels[best_index])

    return label_name(label_map, best_label), float(scores[best_index])


def predict_face(face, recognizer):
    if recognizer["kind"] == "nearest":
        return predict_nearest(face, recognizer)

    model = recognizer["model"]
    scaler = recognizer["scaler"]
    label_map = recognizer["label_map"]
    face_flat = face.flatten().reshape(1, -1)
    face_scaled = scaler.transform(face_flat)

    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(face_scaled)[0]
        best_index = int(np.argmax(probabilities))
        label = int(model.classes_[best_index])
        confidence = float(probabilities[best_index])
    else:
        label = int(model.predict(face_scaled)[0])
        confidence = 1.0

    return label_name(label_map, label), confidence


def draw_label(frame, box, name, confidence, threshold):
    x, y, w, h = box
    accepted = confidence >= threshold
    color = (0, 180, 0) if accepted else (0, 165, 255)
    display_name = name if accepted else f"{name}?"
    label = f"{display_name}  podobnost: {confidence:.2f}"

    cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)

    label_y = max(28, y - 10)
    cv2.putText(
        frame,
        label,
        (x, label_y),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        color,
        2,
    )


def preview(model_dir=MODEL_DIR, camera_index=0, threshold=0.45):
    recognizer = load_model(model_dir)
    label_map = recognizer["label_map"]
    print("[INFO] Nalozena imena:", ", ".join(str(name) for name in label_map.values()))
    print(f"[INFO] Nacin prepoznave: {recognizer['kind']}")
    print("[INFO] Pritisni q za izhod.")

    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise RuntimeError("Kamere ni mogoce odpreti.")

    last_printed = None
    focused = False

    cv2.namedWindow(PREVIEW_WINDOW, cv2.WINDOW_NORMAL)

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        face, box = prepare_face(frame)

        if face is not None and box is not None:
            name, confidence = predict_face(face, recognizer)
            draw_label(frame, box, name, confidence, threshold)

            printed = (name, round(confidence, 2))
            if printed != last_printed:
                print(f"[PREDICT] {name} ({confidence:.2f})")
                last_printed = printed
        else:
            cv2.putText(
                frame,
                "Obraz ni zaznan",
                (16, 32),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 0, 255),
                2,
            )

        cv2.imshow(PREVIEW_WINDOW, frame)

        if not focused:
            focus_window(PREVIEW_WINDOW)
            focused = True

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


def print_labels(model_dir=MODEL_DIR):
    recognizer = load_model(model_dir)
    label_map = recognizer["label_map"]
    print("[INFO] Imena v modelu:")
    for label_id, name in label_map.items():
        print(f"  - {label_id}: {name}")


def build_parser():
    parser = argparse.ArgumentParser(
        description="Live prikaz prepoznanega imena obraza brez spreminjanja obstojecih ORV skript."
    )
    subparsers = parser.add_subparsers(dest="command")

    train_parser = subparsers.add_parser(
        "train",
        help="Natrenira model iz podmap data/test_images/ImeOsebe.",
    )
    train_parser.add_argument("--images-dir", default=str(TEST_IMAGES_DIR))
    train_parser.add_argument("--model-dir", default=str(MODEL_DIR))

    preview_parser = subparsers.add_parser(
        "preview",
        help="Odpre kamero in ob obrazu izpise ime ter podobnost.",
    )
    preview_parser.add_argument("--model-dir", default=str(MODEL_DIR))
    preview_parser.add_argument("--camera", type=int, default=0)
    preview_parser.add_argument("--threshold", type=float, default=0.45)

    labels_parser = subparsers.add_parser(
        "labels",
        help="Izpise imena, ki jih pozna model.",
    )
    labels_parser.add_argument("--model-dir", default=str(MODEL_DIR))

    export_parser = subparsers.add_parser(
        "export-users",
        help="Iz test_images/ImeOsebe ustvari data/users/ime.npz za obstojeci detect-face.py login.",
    )
    export_parser.add_argument("--images-dir", default=str(TEST_IMAGES_DIR))
    export_parser.add_argument("--users-dir", default=str(DATA_DIR / "users"))
    export_parser.add_argument("--overwrite", action="store_true")

    preview_users_parser = subparsers.add_parser(
        "preview-users",
        help="Odpre kamero in prikaze ime/podobnost iz obstojecih data/users profilov.",
    )
    preview_users_parser.add_argument("--users-dir", default=str(DATA_DIR / "users"))
    preview_users_parser.add_argument("--camera", type=int, default=0)
    preview_users_parser.add_argument("--threshold", type=float, default=0.95)

    login_users_parser = subparsers.add_parser(
        "login-users",
        help="Web/backend face login: prikaze ime, ob SPACE vrne JSON rezultat.",
    )
    login_users_parser.add_argument("username")
    login_users_parser.add_argument("--users-dir", default=str(DATA_DIR / "users"))
    login_users_parser.add_argument("--camera", type=int, default=0)
    login_users_parser.add_argument("--threshold", type=float, default=0.95)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "train":
        train_from_test_images(
            images_dir=Path(args.images_dir),
            model_dir=Path(args.model_dir),
        )
    elif args.command == "preview":
        preview(
            model_dir=Path(args.model_dir),
            camera_index=args.camera,
            threshold=args.threshold,
        )
    elif args.command == "labels":
        print_labels(model_dir=Path(args.model_dir))
    elif args.command == "export-users":
        export_test_images_to_users(
            images_dir=Path(args.images_dir),
            users_dir=Path(args.users_dir),
            overwrite=args.overwrite,
        )
    elif args.command == "preview-users":
        preview_users(
            users_dir=Path(args.users_dir),
            camera_index=args.camera,
            threshold=args.threshold,
        )
    elif args.command == "login-users":
        result = login_users(
            username=args.username,
            users_dir=Path(args.users_dir),
            camera_index=args.camera,
            threshold=args.threshold,
        )
        print(json.dumps(result, ensure_ascii=False))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
