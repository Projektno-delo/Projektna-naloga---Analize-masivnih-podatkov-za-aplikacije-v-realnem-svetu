import argparse
from collections import Counter
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
MIN_EFFECTIVE_THRESHOLD = 0.58
LOW_LIGHT_MEAN_THRESHOLD = 75.0
AUTO_LOGIN_FREEZE_MS = 1000

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)
eye_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_eye_tree_eyeglasses.xml"
)


def draw_night_mode_button(frame, enabled):
    height, width = frame.shape[:2]
    button_width = 158
    button_height = 38
    margin = 12
    x1 = max(margin, width - button_width - margin)
    y1 = margin
    x2 = min(width - margin, x1 + button_width)
    y2 = y1 + button_height

    fill = (45, 110, 60) if enabled else (35, 35, 35)
    border = (125, 210, 145) if enabled else (120, 120, 120)
    text = "Night mode ON" if enabled else "Night mode OFF"

    cv2.rectangle(frame, (x1, y1), (x2, y2), fill, -1)
    cv2.rectangle(frame, (x1, y1), (x2, y2), border, 2)
    cv2.putText(
        frame,
        text,
        (x1 + 10, y1 + 25),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (255, 255, 255),
        2,
    )
    return (x1, y1, x2, y2)


def make_night_mode_mouse_handler(state):
    def handle_mouse(event, x, y, flags, param):
        if event != cv2.EVENT_LBUTTONDOWN:
            return

        rect = state.get("rect")
        if rect is None:
            return

        x1, y1, x2, y2 = rect
        if x1 <= x <= x2 and y1 <= y <= y2:
            state["enabled"] = not state["enabled"]
            print(f"Night mode {'ON' if state['enabled'] else 'OFF'}")

    return handle_mouse


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


def binarna_segmentacija(slika: np.ndarray, invert_dark=True) -> np.ndarray:
    if slika.ndim == 3:
        slika = cv2.cvtColor(slika, cv2.COLOR_BGR2GRAY)
    else:
        slika = slika.copy()

    if slika.dtype != np.uint8:
        slika = np.clip(slika, 0, 1)
        slika = (slika * 255).astype(np.uint8)

    threshold = max(35, int(np.mean(slika) * 0.85))
    if invert_dark:
        maska = (slika < threshold).astype(np.uint8) * 255
    else:
        maska = (slika > threshold).astype(np.uint8) * 255

    kernel = np.ones((3, 3), np.uint8)
    return cv2.morphologyEx(maska, cv2.MORPH_OPEN, kernel)


def gamma_lighten_gray(gray, gamma=0.55):
    table = np.array([
        ((i / 255.0) ** gamma) * 255
        for i in range(256)
    ]).astype(np.uint8)
    return cv2.LUT(gray, table)


def clahe_gray(gray, clip_limit=2.0):
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(8, 8))
    return clahe.apply(gray)


def night_mode_variants(gray):
    brightened = gamma_lighten_gray(gray)
    contrast = clahe_gray(gray)
    bright_contrast = clahe_gray(brightened)
    return [bright_contrast, brightened, contrast]


def night_mode_frame(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    night_gray = night_mode_variants(gray)[0]
    return cv2.cvtColor(night_gray, cv2.COLOR_GRAY2BGR)


def blur_background_except_face(frame, box, padding=0.22):
    if box is None:
        return frame

    height, width = frame.shape[:2]
    x, y, w, h = box
    pad_x = int(w * padding)
    pad_y = int(h * padding)
    x1 = max(0, x - pad_x)
    y1 = max(0, y - pad_y)
    x2 = min(width, x + w + pad_x)
    y2 = min(height, y + h + pad_y)

    blurred = cv2.GaussianBlur(frame, (41, 41), 0)
    mask = np.zeros((height, width), dtype=np.uint8)
    cv2.rectangle(mask, (x1, y1), (x2, y2), 255, -1)
    mask = cv2.GaussianBlur(mask, (31, 31), 0).astype(np.float32) / 255.0
    mask = mask[:, :, np.newaxis]

    return (frame.astype(np.float32) * mask + blurred.astype(np.float32) * (1.0 - mask)).astype(np.uint8)


def has_open_eyes(gray, box, force_night_mode=False):
    if box is None or eye_cascade.empty():
        return False

    x, y, w, h = box
    upper_face = gray[y : y + int(h * 0.62), x : x + w]
    if upper_face.size == 0:
        return False

    candidates = [upper_face, cv2.equalizeHist(upper_face)]
    if force_night_mode or float(np.mean(upper_face)) < LOW_LIGHT_MEAN_THRESHOLD:
        candidates.extend(night_mode_variants(upper_face))

    min_eye_w = max(16, int(w * 0.12))
    min_eye_h = max(10, int(h * 0.08))

    for candidate in candidates:
        eyes = eye_cascade.detectMultiScale(
            candidate,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(min_eye_w, min_eye_h),
        )

        if len(eyes) < 2:
            continue

        centers = sorted(ex + ew / 2 for ex, _, ew, _ in eyes)
        for left, right in zip(centers, centers[1:]):
            if right - left >= w * 0.18:
                return True

    return False


def build_face_detection_images(gray, force_night_mode=False):
    normal_candidates = [gray, cv2.equalizeHist(gray)]

    if force_night_mode:
        return night_mode_variants(gray) + normal_candidates

    candidates = normal_candidates
    if float(np.mean(gray)) < LOW_LIGHT_MEAN_THRESHOLD:
        candidates.extend(night_mode_variants(gray))

    return candidates


def detect_largest_face(gray, force_night_mode=False):
    for candidate in build_face_detection_images(gray, force_night_mode=force_night_mode):
        faces = face_cascade.detectMultiScale(
            candidate,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(70, 70),
        )

        if len(faces) == 0:
            continue

        return max(faces, key=lambda face: face[2] * face[3])

    return None


def enhance_dark_face(face_crop, force_night_mode=False):
    if not force_night_mode and float(np.mean(face_crop)) >= LOW_LIGHT_MEAN_THRESHOLD:
        return face_crop

    return night_mode_variants(face_crop)[0]


def prepare_face(frame, force_night_mode=False):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    detected = detect_largest_face(gray, force_night_mode=force_night_mode)

    if detected is None:
        return None, None

    x, y, w, h = detected
    face_crop = gray[y : y + h, x : x + w]
    face_crop = enhance_dark_face(face_crop, force_night_mode=force_night_mode)
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

    print("[INFO] Izvoz v format, ki ga uporablja face_name_preview.py login-users ...")

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


def zscore(values):
    values = values.astype(np.float32).reshape(-1)
    std = float(np.std(values))

    if std < 1e-6:
        return values - float(np.mean(values))

    return (values - float(np.mean(values))) / std


def lbp_histogram(face, grid_size=8, bins=32):
    image = (np.clip(face, 0, 1) * 255).astype(np.uint8)
    center = image[1:-1, 1:-1]
    codes = np.zeros_like(center, dtype=np.uint8)

    neighbors = [
        image[:-2, :-2],
        image[:-2, 1:-1],
        image[:-2, 2:],
        image[1:-1, 2:],
        image[2:, 2:],
        image[2:, 1:-1],
        image[2:, :-2],
        image[1:-1, :-2],
    ]

    for bit, neighbor in enumerate(neighbors):
        codes |= ((neighbor >= center).astype(np.uint8) << bit)

    h, w = codes.shape
    cell_h = h // grid_size
    cell_w = w // grid_size
    features = []

    for row in range(grid_size):
        for col in range(grid_size):
            y1 = row * cell_h
            x1 = col * cell_w
            y2 = h if row == grid_size - 1 else y1 + cell_h
            x2 = w if col == grid_size - 1 else x1 + cell_w
            hist, _ = np.histogram(codes[y1:y2, x1:x2], bins=bins, range=(0, 256))
            hist = hist.astype(np.float32)
            total = float(np.sum(hist))
            if total > 0:
                hist /= total
            features.extend(hist)

    return np.array(features, dtype=np.float32)


def face_descriptor(face):
    low_res = cv2.resize(face.astype(np.float32), (32, 32), interpolation=cv2.INTER_AREA)
    pixel_features = zscore(low_res)
    texture_features = lbp_histogram(face)
    descriptor = np.concatenate([pixel_features * 0.35, texture_features * 0.65])
    norm = np.linalg.norm(descriptor)

    if norm > 0:
        descriptor = descriptor / norm

    return descriptor.astype(np.float32)


def profile_score(face_desc, samples):
    scores = [
        cosine_similarity(face_desc, face_descriptor(sample))
        for sample in samples
    ]

    if not scores:
        return 0.0

    top_scores = sorted(scores, reverse=True)[: min(3, len(scores))]
    return float(np.mean(top_scores))


def predict_from_user_profiles(face, profiles):
    face_desc = face_descriptor(face)
    best_name = None
    best_score = 0.0
    user_scores = {}

    for username, samples in profiles.items():
        score = profile_score(face_desc, samples)
        user_scores[username] = score

        if score > best_score:
            best_name = username
            best_score = score

    sorted_scores = sorted(user_scores.values(), reverse=True)
    second_score = sorted_scores[1] if len(sorted_scores) > 1 else 0.0
    margin = best_score - second_score

    return best_name or "neznan", best_score, margin, user_scores


def is_accepted_prediction(name, score, margin, expected_username, threshold, min_margin):
    effective_threshold = max(float(threshold), MIN_EFFECTIVE_THRESHOLD)

    return (
        name == expected_username
        and score >= effective_threshold
        and margin >= min_margin
    )


def verify_live_frames(
    cap,
    profiles,
    expected_username,
    threshold,
    frame_count=9,
    min_agreement=0.7,
    min_margin=0.08,
    force_night_mode=False,
):
    predictions = []
    attempts = 0
    max_attempts = max(frame_count * 3, frame_count)

    while len(predictions) < frame_count and attempts < max_attempts:
        attempts += 1
        ret, frame = cap.read()
        if not ret:
            break

        face, box = prepare_face(frame, force_night_mode=force_night_mode)
        if face is None:
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if not has_open_eyes(gray, box, force_night_mode=force_night_mode):
            continue

        name, score, margin, _ = predict_from_user_profiles(face, profiles)
        accepted = is_accepted_prediction(
            name,
            score,
            margin,
            expected_username,
            threshold,
            min_margin,
        )
        predictions.append({
            "name": name,
            "score": float(score),
            "margin": float(margin),
            "accepted": accepted,
        })

    if not predictions:
        return False, None, 0.0, 0.0, 0.0, []

    names = [prediction["name"] for prediction in predictions]
    recognized = Counter(names).most_common(1)[0][0]
    accepted_count = sum(1 for prediction in predictions if prediction["accepted"])
    agreement = accepted_count / len(predictions)
    expected_scores = [
        prediction["score"]
        for prediction in predictions
        if prediction["name"] == expected_username
    ]
    expected_margins = [
        prediction["margin"]
        for prediction in predictions
        if prediction["name"] == expected_username
    ]
    median_score = float(np.median(expected_scores)) if expected_scores else 0.0
    median_margin = float(np.median(expected_margins)) if expected_margins else 0.0
    success = (
        agreement >= min_agreement
        and median_score >= max(float(threshold), MIN_EFFECTIVE_THRESHOLD)
        and median_margin >= min_margin
    )

    return success, recognized, median_score, median_margin, agreement, predictions


def login_users(
    username,
    users_dir=DATA_DIR / "users",
    camera_index=0,
    threshold=0.95,
    frame_count=9,
    min_agreement=0.7,
    min_margin=0.08,
    force_night_mode=False,
):
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
    best_margin = 0.0
    agreement = 0.0
    predictions = []
    success = False
    focused = False
    night_state = {"enabled": bool(force_night_mode), "rect": None}

    print("Poglej v kamero. Pritisni SPACE za preverjanje, ali q za izhod.")
    print("Klikni Night mode v oknu ali pritisni n za preklop.")
    if night_state["enabled"]:
        print("Night mode je vklopljen.")
    print("Nalozeni profili:", ", ".join(profiles.keys()))
    print("Ko je zaznan pravi obraz z odprtimi ocmi, preverjanje stece samodejno.")

    cv2.namedWindow(LOGIN_WINDOW, cv2.WINDOW_NORMAL)
    cv2.setMouseCallback(LOGIN_WINDOW, make_night_mode_mouse_handler(night_state))

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        prikaz = night_mode_frame(frame) if night_state["enabled"] else frame.copy()

        face, box = prepare_face(frame, force_night_mode=night_state["enabled"])
        ready_to_verify = False
        current_prediction = None
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        eyes_open = has_open_eyes(gray, box, force_night_mode=night_state["enabled"])
        if not eyes_open:
            face = None
        prikaz = blur_background_except_face(prikaz, box)

        if face is not None and box is not None:
            best_name, best_score, best_margin, _ = predict_from_user_profiles(face, profiles)
            ready_to_verify = is_accepted_prediction(
                best_name,
                best_score,
                best_margin,
                expected_username,
                threshold,
                min_margin,
            )
            current_prediction = {
                "name": best_name,
                "score": float(best_score),
                "margin": float(best_margin),
                "accepted": bool(ready_to_verify),
            }
            draw_label(prikaz, box, best_name, best_score, threshold)

            x, y, _, h = box
            expected_text = f"Prijava kot: {expected_username}"
            cv2.putText(
                prikaz,
                expected_text,
                (x, y + h + 28),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                (255, 255, 255),
                2,
            )
        elif box is not None:
            cv2.putText(
                prikaz,
                "Odpri oci",
                (16, 32),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 165, 255),
                2,
            )
        else:
            cv2.putText(
                prikaz,
                "Obraz ni zaznan",
                (16, 32),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 0, 255),
                2,
            )

        night_state["rect"] = draw_night_mode_button(prikaz, night_state["enabled"])
        cv2.imshow(LOGIN_WINDOW, prikaz)

        if not focused:
            focus_window(LOGIN_WINDOW)
            focused = True

        if ready_to_verify:
            cv2.putText(
                prikaz,
                "Preverjam...",
                (16, 64),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (125, 210, 145),
                2,
            )
            night_state["rect"] = draw_night_mode_button(prikaz, night_state["enabled"])
            cv2.imshow(LOGIN_WINDOW, prikaz)
            cv2.waitKey(AUTO_LOGIN_FREEZE_MS)
            success = True
            agreement = 1.0
            predictions = [current_prediction] if current_prediction else []
            break

        key = cv2.waitKey(1) & 0xFF

        if key == ord(" "):
            success, best_name, best_score, best_margin, agreement, predictions = verify_live_frames(
                cap,
                profiles,
                expected_username,
                threshold,
                frame_count=frame_count,
                min_agreement=min_agreement,
                min_margin=min_margin,
                force_night_mode=night_state["enabled"],
            )
            break

        if key == ord("n"):
            night_state["enabled"] = not night_state["enabled"]
            print(f"Night mode {'ON' if night_state['enabled'] else 'OFF'}")
        elif key == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()

    return {
        "success": bool(success),
        "username": expected_username,
        "recognized": best_name,
        "score": round(float(best_score), 4),
        "margin": round(float(best_margin), 4),
        "agreement": round(float(agreement), 4),
        "frames_checked": len(predictions),
        "threshold": threshold,
        "effective_threshold": max(float(threshold), MIN_EFFECTIVE_THRESHOLD),
        "min_margin": min_margin,
        "night_mode": bool(night_state["enabled"]),
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
    print("[INFO] Klikni Night mode v oknu ali pritisni n. Pritisni q za izhod.")

    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise RuntimeError("Kamere ni mogoce odpreti.")

    last_printed = None
    focused = False
    night_state = {"enabled": False, "rect": None}

    cv2.namedWindow(PREVIEW_WINDOW, cv2.WINDOW_NORMAL)
    cv2.setMouseCallback(PREVIEW_WINDOW, make_night_mode_mouse_handler(night_state))

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        prikaz = night_mode_frame(frame) if night_state["enabled"] else frame.copy()

        face, box = prepare_face(frame, force_night_mode=night_state["enabled"])
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        eyes_open = has_open_eyes(gray, box, force_night_mode=night_state["enabled"])
        if not eyes_open:
            face = None
        prikaz = blur_background_except_face(prikaz, box)

        if face is not None and box is not None:
            name, confidence = predict_face(face, recognizer)
            draw_label(prikaz, box, name, confidence, threshold)

            printed = (name, round(confidence, 2))
            if printed != last_printed:
                print(f"[PREDICT] {name} ({confidence:.2f})")
                last_printed = printed
        elif box is not None:
            cv2.putText(
                prikaz,
                "Odpri oci",
                (16, 32),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 165, 255),
                2,
            )
        else:
            cv2.putText(
                prikaz,
                "Obraz ni zaznan",
                (16, 32),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 0, 255),
                2,
            )

        night_state["rect"] = draw_night_mode_button(prikaz, night_state["enabled"])
        cv2.imshow(PREVIEW_WINDOW, prikaz)

        if not focused:
            focus_window(PREVIEW_WINDOW)
            focused = True

        key = cv2.waitKey(1) & 0xFF
        if key == ord("n"):
            night_state["enabled"] = not night_state["enabled"]
            print(f"Night mode {'ON' if night_state['enabled'] else 'OFF'}")
        elif key == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


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

    export_parser = subparsers.add_parser(
        "export-users",
        help="Iz test_images/ImeOsebe ustvari data/users/ime.npz za login-users.",
    )
    export_parser.add_argument("--images-dir", default=str(TEST_IMAGES_DIR))
    export_parser.add_argument("--users-dir", default=str(DATA_DIR / "users"))
    export_parser.add_argument("--overwrite", action="store_true")

    login_users_parser = subparsers.add_parser(
        "login-users",
        help="Web/backend face login: prikaze ime, ob SPACE vrne JSON rezultat.",
    )
    login_users_parser.add_argument("username")
    login_users_parser.add_argument("--users-dir", default=str(DATA_DIR / "users"))
    login_users_parser.add_argument("--camera", type=int, default=0)
    login_users_parser.add_argument("--threshold", type=float, default=0.95)
    login_users_parser.add_argument("--frames", type=int, default=9)
    login_users_parser.add_argument("--min-agreement", type=float, default=0.7)
    login_users_parser.add_argument("--margin", type=float, default=0.08)
    login_users_parser.add_argument(
        "--night-mode",
        action="store_true",
        help="Vedno uporabi gamma/CLAHE low-light preprocessing za kamero.",
    )

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
    elif args.command == "export-users":
        export_test_images_to_users(
            images_dir=Path(args.images_dir),
            users_dir=Path(args.users_dir),
            overwrite=args.overwrite,
        )
    elif args.command == "login-users":
        result = login_users(
            username=args.username,
            users_dir=Path(args.users_dir),
            camera_index=args.camera,
            threshold=args.threshold,
            frame_count=args.frames,
            min_agreement=args.min_agreement,
            min_margin=args.margin,
            force_night_mode=args.night_mode,
        )
        print(json.dumps(result, ensure_ascii=False))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
