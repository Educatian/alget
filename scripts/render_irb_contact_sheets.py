"""Render the current ALGET IRB PDFs into compact visual-QA contact sheets."""
from __future__ import annotations

import argparse
from pathlib import Path

import fitz
from PIL import Image, ImageOps


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    for pdf in sorted(args.source.glob("*.pdf")):
        document = fitz.open(pdf)
        thumbnails = []
        for page in document:
            pixmap = page.get_pixmap(matrix=fitz.Matrix(0.75, 0.75), alpha=False)
            image = Image.frombytes("RGB", [pixmap.width, pixmap.height], pixmap.samples)
            thumbnails.append(ImageOps.expand(image, border=2, fill="gray"))

        width = max(image.width for image in thumbnails)
        height = max(image.height for image in thumbnails)
        columns = 2
        rows = (len(thumbnails) + columns - 1) // columns
        sheet = Image.new("RGB", (columns * width, rows * height), (235, 235, 235))
        for index, image in enumerate(thumbnails):
            sheet.paste(image, ((index % columns) * width, (index // columns) * height))

        target = args.output / f"{pdf.stem}_contact.png"
        sheet.save(target)
        print(f"{pdf.name}: {len(document)} pages -> {target}")


if __name__ == "__main__":
    main()
