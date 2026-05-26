import argparse
import json
from pathlib import Path

import cv2
import numpy as np


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT_DIR = BASE_DIR / "data" / "test_images"
DEFAULT_OUTPUT_DIR = BASE_DIR / "data" / "augmented"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def read_image(path):
    image = cv2.imread(str(path))
    if image is None:
        raise ValueError(f"Slike ni mogoce prebrati: {path}")

    return image


def write_image(path, image):
    path.parent.mkdir(parents=True, exist_ok=True)
    ok = cv2.imwrite(str(path), image)
    if not ok:
        raise ValueError(f"Slike ni mogoce shraniti: {path}")


def safe_stem(path):
    return path.stem.replace(" ", "_")


def iter_images(input_dir):
    for path in sorted(input_dir.rglob("*")):
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
            yield path


def relative_output_dir(image_path, input_dir, output_dir):
    relative_parent = image_path.parent.relative_to(input_dir)
    return output_dir / relative_parent


def rotate_image(image, angle):
    h, w = image.shape[:2]
    center = (w / 2, h / 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)

    return cv2.warpAffine(
        image,
        matrix,
        (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REFLECT_101,
    )


def adjust_brightness(image, alpha=1.0, beta=0):
    return cv2.convertScaleAbs(image, alpha=alpha, beta=beta)


def horizontal_flip(image):
    return cv2.flip(image, 1)


def gaussian_blur(image):
    return cv2.GaussianBlur(image, (5, 5), 0)


def add_noise(image, sigma=12):
    noise = np.random.normal(0, sigma, image.shape).astype(np.float32)
    noisy = image.astype(np.float32) + noise
    return np.clip(noisy, 0, 255).astype(np.uint8)


def crop_zoom(image, zoom=0.9):
    h, w = image.shape[:2]
    crop_w = max(1, int(w * zoom))
    crop_h = max(1, int(h * zoom))
    x1 = (w - crop_w) // 2
    y1 = (h - crop_h) // 2
    cropped = image[y1 : y1 + crop_h, x1 : x1 + crop_w]
    return cv2.resize(cropped, (w, h), interpolation=cv2.INTER_LINEAR)


def brightness_stats(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return {
        "mean": float(np.mean(gray)),
        "median": float(np.median(gray)),
        "p10": float(np.percentile(gray, 10)),
    }


def is_low_light(image, threshold):
    stats = brightness_stats(image)
    return stats["mean"] < threshold or stats["p10"] < threshold * 0.45, stats


def gamma_lighten(image, gamma=0.55):
    table = np.array([
        ((i / 255.0) ** gamma) * 255
        for i in range(256)
    ]).astype("uint8")
    return cv2.LUT(image, table)


def clahe_lab(image):
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced_l = clahe.apply(l_channel)
    enhanced_lab = cv2.merge((enhanced_l, a_channel, b_channel))
    return cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)


def inverse_contrast(image):
    inverted = cv2.bitwise_not(image)
    return cv2.addWeighted(image, 0.35, inverted, 0.65, 0)


def build_augmentations(image, low_light=False):
    augmentations = [
        ("rot_m8", rotate_image(image, -8)),
        ("rot_p8", rotate_image(image, 8)),
        ("bright_down", adjust_brightness(image, alpha=0.82, beta=-8)),
        ("bright_up", adjust_brightness(image, alpha=1.18, beta=18)),
        ("flip", horizontal_flip(image)),
        ("blur", gaussian_blur(image)),
        ("noise", add_noise(image)),
        ("zoom", crop_zoom(image, zoom=0.9)),
    ]

    if low_light:
        gamma = gamma_lighten(image)
        clahe = clahe_lab(image)
        inverse = inverse_contrast(image)
        augmentations.extend([
            ("lowlight_gamma", gamma),
            ("lowlight_clahe", clahe),
            ("lowlight_inverse", inverse),
            ("lowlight_gamma_clahe", clahe_lab(gamma)),
        ])

    return augmentations


def augment_dataset(input_dir, output_dir, low_light_threshold=85, limit=0):
    input_dir = Path(input_dir)
    output_dir = Path(output_dir)

    if not input_dir.exists():
        raise FileNotFoundError(f"Vhodna mapa ne obstaja: {input_dir}")

    report = {
        "input_dir": str(input_dir),
        "output_dir": str(output_dir),
        "low_light_threshold": low_light_threshold,
        "source_images": 0,
        "augmented_images": 0,
        "low_light_images": 0,
        "skipped": [],
        "images": [],
    }

    for index, image_path in enumerate(iter_images(input_dir), start=1):
        if limit and index > limit:
            break

        try:
            image = read_image(image_path)
        except ValueError as error:
            report["skipped"].append({
                "image": str(image_path),
                "reason": str(error),
            })
            continue

        low_light, stats = is_low_light(image, low_light_threshold)
        if low_light:
            report["low_light_images"] += 1

        out_dir = relative_output_dir(image_path, input_dir, output_dir)
        stem = safe_stem(image_path)
        generated = []

        for aug_name, aug_image in build_augmentations(image, low_light=low_light):
            out_path = out_dir / f"{stem}__{aug_name}.jpg"
            write_image(out_path, aug_image)
            generated.append(str(out_path.relative_to(output_dir)))

        report["source_images"] += 1
        report["augmented_images"] += len(generated)
        report["images"].append({
            "source": str(image_path.relative_to(input_dir)),
            "low_light": low_light,
            "brightness": {
                "mean": round(stats["mean"], 2),
                "median": round(stats["median"], 2),
                "p10": round(stats["p10"], 2),
            },
            "generated_count": len(generated),
            "generated": generated,
        })

    report_path = output_dir / "augmentation_report.json"
    output_dir.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    return report, report_path


def build_parser():
    parser = argparse.ArgumentParser(
        description="Ustvari augmentirane slike za ORV face-login dataset."
    )
    parser.add_argument("--input", default=str(DEFAULT_INPUT_DIR))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--low-light-threshold", type=float, default=85)
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Za testiranje obdela samo prvih N slik. 0 pomeni vse slike.",
    )
    return parser


def main():
    args = build_parser().parse_args()

    report, report_path = augment_dataset(
        input_dir=Path(args.input),
        output_dir=Path(args.output),
        low_light_threshold=args.low_light_threshold,
        limit=args.limit,
    )

    print("[OK] Augmentacija koncana.")
    print(f"[OK] Izvorne slike: {report['source_images']}")
    print(f"[OK] Ustvarjene slike: {report['augmented_images']}")
    print(f"[OK] Slike s slabo svetlobo: {report['low_light_images']}")
    print(f"[OK] Porocilo: {report_path}")


if __name__ == "__main__":
    main()
