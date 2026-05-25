import argparse
import contextlib
import importlib.util
import json
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DETECT_FACE_PATH = BASE_DIR / "detect-face.py"
LOGIN_LOG = BASE_DIR / "data" / "login-attempts.jsonl"


def load_detect_face_module():
    spec = importlib.util.spec_from_file_location("detect_face", DETECT_FACE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def latest_attempt_for(username):
    if not LOGIN_LOG.exists():
        return None

    for line in reversed(LOGIN_LOG.read_text(encoding="utf-8").splitlines()):
        try:
            attempt = json.loads(line)
        except json.JSONDecodeError:
            continue

        if attempt.get("username") == username:
            return attempt

    return None


def main():
    parser = argparse.ArgumentParser(description="Bridge za vracanje ORV face-login rezultata spletni aplikaciji.")
    parser.add_argument("username")
    parser.add_argument("--threshold", type=float, default=0.95)
    parser.add_argument("--camera", type=int, default=0)
    args = parser.parse_args()

    try:
        detect_face = load_detect_face_module()

        with contextlib.redirect_stdout(sys.stderr):
            success = detect_face.login_user(
                args.username,
                threshold=args.threshold,
                camera_index=args.camera,
            )

        attempt = latest_attempt_for(args.username) or {}
        result = {
            "success": bool(success),
            "username": args.username,
            "score": attempt.get("score"),
            "threshold": args.threshold,
            "method": "orv-face-login",
        }
    except Exception as error:
        result = {
            "success": False,
            "username": args.username,
            "threshold": args.threshold,
            "method": "orv-face-login",
            "error": str(error),
        }

    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["success"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
