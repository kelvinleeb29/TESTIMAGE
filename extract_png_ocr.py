#!/usr/bin/env python3
"""
Download a PNG from GitHub (or read a local image) and extract its text with OCR.

Install Python packages:
    py -m pip install pillow pytesseract requests

Also install the Tesseract OCR engine:
    Windows: https://github.com/UB-Mannheim/tesseract/wiki
    Ubuntu/Debian: sudo apt install tesseract-ocr
    macOS: brew install tesseract

Example:
    py extract_png_ocr.py
    py extract_png_ocr.py "https://raw.githubusercontent.com/OWNER/REPO/main/image.png"
    py extract_png_ocr.py .\image.png --output .\image.txt
"""

from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path
from urllib.parse import urlparse

import requests
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter, ImageOps


DEFAULT_IMAGE_URL = (
    "https://raw.githubusercontent.com/kelvinleeb29/TESTIMAGE/main/"
    "2026-10-21_111339.png"
)


def load_image(source: str, timeout: int) -> Image.Image:
    """Load an image from a local path or an HTTP(S) URL."""
    parsed = urlparse(source)
    if parsed.scheme in ("http", "https"):
        response = requests.get(
            source,
            timeout=timeout,
            headers={"User-Agent": "png-ocr-extractor/1.0"},
        )
        response.raise_for_status()
        return Image.open(io.BytesIO(response.content))
    return Image.open(Path(source).expanduser())


def preprocess(image: Image.Image, scale: int = 2) -> Image.Image:
    """Prepare screenshots for OCR by enlarging and improving contrast."""
    image = ImageOps.exif_transpose(image).convert("RGB")
    if scale > 1:
        image = image.resize(
            (image.width * scale, image.height * scale),
            Image.Resampling.LANCZOS,
        )
    image = ImageOps.grayscale(image)
    image = ImageEnhance.Contrast(image).enhance(1.8)
    image = image.filter(ImageFilter.SHARPEN)
    return image


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extract text from a PNG/JPEG screenshot using Tesseract OCR."
    )
    parser.add_argument(
        "source",
        nargs="?",
        default=DEFAULT_IMAGE_URL,
        help="Local image path or HTTP(S) image URL (default: target GitHub PNG).",
    )
    parser.add_argument(
        "-o", "--output",
        default=None,
        help="Text output path (default: <image-name>.txt in the current directory).",
    )
    parser.add_argument(
        "-l", "--lang",
        default="eng",
        help="Tesseract language code, e.g. eng or eng+msa (default: eng).",
    )
    parser.add_argument(
        "--psm",
        type=int,
        default=3,
        help="Tesseract page segmentation mode (default: 3; try 6 for one text block).",
    )
    parser.add_argument(
        "--tesseract-cmd",
        default=None,
        help="Optional full path to tesseract.exe if it is not on PATH.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=60,
        help="Download timeout in seconds (default: 60).",
    )
    args = parser.parse_args()

    if args.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = args.tesseract_cmd

    try:
        with load_image(args.source, args.timeout) as original:
            image = preprocess(original)
            config = f"--oem 3 --psm {args.psm}"
            text = pytesseract.image_to_string(image, lang=args.lang, config=config)

        if args.output:
            output_path = Path(args.output).expanduser()
        elif urlparse(args.source).scheme in ("http", "https"):
            image_name = Path(urlparse(args.source).path).stem or "ocr_output"
            output_path = Path.cwd() / f"{image_name}.txt"
        else:
            output_path = Path(args.source).expanduser().with_suffix(".txt")

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(text, encoding="utf-8")
        print(f"OCR complete. Text saved to: {output_path.resolve()}")
        print("\n----- OCR TEXT PREVIEW -----\n")
        print(text[:12000] if text else "[No text detected]")
        if len(text) > 12000:
            print("\n[Preview truncated; see the output file for the full text.]")
        return 0

    except requests.RequestException as exc:
        print(f"Download failed: {exc}", file=sys.stderr)
        return 1
    except pytesseract.TesseractNotFoundError:
        print(
            "Tesseract was not found. Install the Tesseract OCR engine and add it "
            "to PATH, or pass --tesseract-cmd with the full path to tesseract.exe.",
            file=sys.stderr,
        )
        return 2
    except pytesseract.TesseractError as exc:
        print(
            f"Tesseract OCR failed: {exc}\n"
            "Check that the requested language data is installed.",
            file=sys.stderr,
        )
        return 3
    except Exception as exc:
        print(f"Could not process image: {exc}", file=sys.stderr)
        return 4


if __name__ == "__main__":
    raise SystemExit(main())
