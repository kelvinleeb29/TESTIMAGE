#!/usr/bin/env python3
"""Extract searchable text from repository PDFs, using OCR for scanned pages."""
from pathlib import Path
import fitz
import pytesseract
from PIL import Image

ROOT = Path(".")
OUTPUT = ROOT / "pdf-extracted"
SKIP_PARTS = {".git", "pdf-extracted"}

def main():
    pdfs = [
        p for p in ROOT.rglob("*")
        if p.is_file() and p.suffix.lower() == ".pdf"
        and not any(part in SKIP_PARTS for part in p.parts)
    ]
    if not pdfs:
        print("No PDFs found.")
        return

    for pdf_path in pdfs:
        relative = pdf_path.relative_to(ROOT)
        output_path = OUTPUT / relative.with_suffix(".txt")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        sections = [f"Source PDF: {relative.as_posix()}\n"]

        with fitz.open(pdf_path) as doc:
            sections.append(f"Pages: {len(doc)}\n")
            for index, page in enumerate(doc, start=1):
                text = page.get_text("text").strip()
                method = "embedded text"
                if len(text) < 40:
                    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                    image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    text = pytesseract.image_to_string(image, lang="eng").strip()
                    method = "OCR"
                sections.append(
                    f"\n{'=' * 24}\nPAGE {index} ({method})\n{'=' * 24}\n{text or '[No text detected]'}\n"
                )

        output_path.write_text("\n".join(sections), encoding="utf-8")
        print(f"Extracted {relative} -> {output_path}")

if __name__ == "__main__":
    main()
