import argparse
import json
import glob
import time
from pathlib import Path
import cv2
import numpy as np

IMG_SIZE = (128, 128)
DEFAULT_THRESHOLD = 0.95

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

def data_path(*parts):
    return Path(__file__).resolve().parent / "data" / Path(*parts)


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


def prepare_face(frame, img_size=IMG_SIZE):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    detected = detect_largest_face(gray)

    if detected is None:
        return None, None

    x, y, w, h = detected
    face_crop = gray[y : y + h, x : x + w]
    face_resized = cv2.resize(face_crop, img_size)
    face_equalized = cv2.equalizeHist(face_resized)
    face_normalized = face_equalized.astype(np.float32) / 255.0

    return face_normalized, detected


def cosine_similarity(a, b):
    a_flat = a.reshape(-1)
    b_flat = b.reshape(-1)
    denominator = np.linalg.norm(a_flat) * np.linalg.norm(b_flat)
    if denominator == 0:
        return 0.0

    return float(np.dot(a_flat, b_flat) / denominator)


def compare_face(face, known_faces):
    scores = [cosine_similarity(face, known_face) for known_face in known_faces]
    return max(scores) if scores else 0.0


def user_file(username):
    safe_username = "".join(ch for ch in username if ch.isalnum() or ch in ("-", "_"))
    if not safe_username:
        raise ValueError("Uporabnisko ime mora vsebovati vsaj eno crko ali stevilko.")

    return data_path("users", f"{safe_username}.npz")


def save_login_attempt(username, success, score, threshold):
    login_log = data_path("login-attempts.jsonl")
    login_log.parent.mkdir(parents=True, exist_ok=True)
    attempt = {
        "username": username,
        "success": bool(success),
        "score": round(float(score), 4),
        "threshold": float(threshold),
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    with login_log.open("a", encoding="utf-8") as log_file:
        log_file.write(json.dumps(attempt, ensure_ascii=False) + "\n")


def preprocess_images(input_dir=None, output_dir=None, img_size=IMG_SIZE):
    input_dir = Path(input_dir) if input_dir else data_path("raw")
    output_dir = Path(output_dir) if output_dir else data_path("processed")
    output_dir.mkdir(parents=True, exist_ok=True)
    image_paths = glob.glob(str(input_dir / "*.jpg")) + glob.glob(str(input_dir / "*.png"))

    if not image_paths:
        print(f"Ni slik za obdelavo v mapi: {input_dir}")
        return

    for path in image_paths:
        img = cv2.imread(path)
        if img is None:
            print(f"Preskoceno, slike ni mogoce prebrati: {path}")
            continue

        face, _ = prepare_face(img, img_size)
        if face is None:
            print(f"Na sliki ni bilo zaznanega obraza: {path}")
            continue

        face_to_save = (face * 255).astype(np.uint8)
        filename = Path(path).name
        save_path = output_dir / f"proc_{filename}"
        cv2.imwrite(str(save_path), face_to_save)
        print(f"Obdelano in shranjeno: {save_path}")


def capture_face_samples(sample_count=8, camera_index=0, show_preview=True):
    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise RuntimeError("Kamere ni mogoce odpreti.")

    samples = []
    print("Pritisni SPACE za zajem obraza, ali 'q' za izhod.")

    while len(samples) < sample_count:
        ret, frame = cap.read()
        if not ret:
            break

        face, detected = prepare_face(frame)
        preview = frame.copy()

        if detected is not None:
            x, y, w, h = detected
            cv2.rectangle(preview, (x, y), (x + w, y + h), (0, 180, 0), 2)

        cv2.putText(
            preview,
            f"Vzorec {len(samples)}/{sample_count}",
            (16, 32),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 180, 0),
            2,
        )

        if show_preview:
            cv2.imshow("Face login - zajem", preview)
            key = cv2.waitKey(1) & 0xFF
        else:
            key = ord(" ")

        if key == ord(" ") and face is not None:
            samples.append(face)
            print(f"Zajet vzorec {len(samples)}/{sample_count}.")
        elif key == ord(" "):
            print("Obraz ni zaznan. Poskusi znova pri boljsi svetlobi.")
        elif key == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
    return samples


def register_user(username, sample_count=8, camera_index=0):
    samples = capture_face_samples(sample_count=sample_count, camera_index=camera_index)
    if len(samples) < 3:
        print("Registracija ni uspela. Potrebni so vsaj 3 zajeti obrazi.")
        return False

    profile_path = user_file(username)
    profile_path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        profile_path,
        samples=np.array(samples, dtype=np.float32),
        username=username,
        created_at=time.strftime("%Y-%m-%d %H:%M:%S"),
    )
    print(f"Uporabnik '{username}' je registriran: {profile_path}")
    return True


def load_user_faces(username):
    profile_path = user_file(username)
    if not profile_path.exists():
        raise FileNotFoundError(f"Uporabnik '{username}' se ni registriran.")

    data = np.load(profile_path, allow_pickle=False)
    return data["samples"]


def login_user(username, threshold=DEFAULT_THRESHOLD, camera_index=0):
    known_faces = load_user_faces(username)
    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise RuntimeError("Kamere ni mogoce odpreti.")

    print("Poglej v kamero. Pritisni SPACE za preverjanje, ali 'q' za izhod.")
    best_score = 0.0
    success = False

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        face, detected = prepare_face(frame)
        preview = frame.copy()

        if detected is not None:
            x, y, w, h = detected
            best_score = compare_face(face, known_faces)
            color = (0, 180, 0) if best_score >= threshold else (0, 0, 255)
            cv2.rectangle(preview, (x, y), (x + w, y + h), color, 2)
            cv2.putText(
                preview,
                f"Ujemanje: {best_score:.2f}",
                (x, max(24, y - 10)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                color,
                2,
            )

        cv2.imshow("Face login", preview)
        key = cv2.waitKey(1) & 0xFF

        if key == ord(" "):
            success = face is not None and best_score >= threshold
            break
        if key == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
    save_login_attempt(username, success, best_score, threshold)

    if success:
        print(f"LOGIN DOVOLJEN za '{username}' (ujemanje: {best_score:.2f}).")
    else:
        print(f"LOGIN ZAVRNJEN za '{username}' (ujemanje: {best_score:.2f}).")

    return success


def verify_image(username, image_path, threshold=DEFAULT_THRESHOLD):
    known_faces = load_user_faces(username)
    image = cv2.imread(str(image_path))
    if image is None:
        raise FileNotFoundError(f"Slike ni mogoce prebrati: {image_path}")

    face, _ = prepare_face(image)
    score = compare_face(face, known_faces) if face is not None else 0.0
    success = face is not None and score >= threshold
    save_login_attempt(username, success, score, threshold)

    print(f"Rezultat za '{username}': {score:.2f}")
    print("LOGIN DOVOLJEN" if success else "LOGIN ZAVRNJEN")
    return success


def build_parser():
    parser = argparse.ArgumentParser(
        description="Preprost face-recognition prototip za dodatno preverjanje prijave."
    )
    subparsers = parser.add_subparsers(dest="command")

    subparsers.add_parser("preprocess", help="Obdelaj slike iz data/raw v data/processed.")

    register_parser = subparsers.add_parser("register", help="Registriraj obraz uporabnika.")
    register_parser.add_argument("username")
    register_parser.add_argument("--samples", type=int, default=8)
    register_parser.add_argument("--camera", type=int, default=0)

    login_parser = subparsers.add_parser("login", help="Preveri prijavo s kamero.")
    login_parser.add_argument("username")
    login_parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    login_parser.add_argument("--camera", type=int, default=0)

    verify_parser = subparsers.add_parser("verify-image", help="Preveri prijavo iz slike.")
    verify_parser.add_argument("username")
    verify_parser.add_argument("image_path")
    verify_parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "preprocess":
        preprocess_images()
    elif args.command == "register":
        register_user(args.username, args.samples, args.camera)
    elif args.command == "login":
        login_user(args.username, args.threshold, args.camera)
    elif args.command == "verify-image":
        verify_image(args.username, args.image_path, args.threshold)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
