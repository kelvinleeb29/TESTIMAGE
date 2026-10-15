#!/usr/bin/env python3
"""Render every PDF in the repository to PNG pages."""
from pathlib import Path
import fitz

ROOT = Path(".")
OUTPUT = ROOT / "pdf-images"
SKIP_PARTS = {".git", "pdf-images", "pdf-extracted"}

def main():
    pdfs = [
        p for p in ROOT.rglob("*")
        if p.is_file()
        and p.suffix.lower() == ".pdf"
        and not any(part in SKIP_PARTS for part in p.parts)
    ]

    if not pdfs:
        print("No PDFs found.")
        return

    for pdf_path in pdfs:
        relative = pdf_path.relative_to(ROOT)
        # Keep folder structure and use the PDF filename (without extension)
        # as the directory containing its rendered pages.
        page_dir = OUTPUT / relative.parent / relative.stem
        page_dir.mkdir(parents=True, exist_ok=True)

        with fitz.open(pdf_path) as doc:
            print(f"Rendering {relative} ({len(doc)} pages)")
            for page_number, page in enumerate(doc, start=1):
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                image_path = page_dir / f"page-{page_number:03d}.png"
                pix.save(image_path)
                print(f"  -> {image_path}")

if __name__ == "__main__":
    main()
