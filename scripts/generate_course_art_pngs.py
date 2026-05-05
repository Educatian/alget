from __future__ import annotations

import json
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ART_ROOT = ROOT / "frontend" / "public" / "course-art"
CONTENT_ROOT = ROOT / "frontend" / "content"
MANIFEST = ART_ROOT / "imagegen2_manifest.json"


PALETTES = {
    "ail606-supplement": ("#9E1B32", "#C99700", "#113946", "#F8F3EA"),
    "cat531-supplement": ("#7A1E2D", "#D6A545", "#1E4E5F", "#FAF4EA"),
    "cat100-supplement": ("#245B6A", "#9E1B32", "#F2C14E", "#F5F8F6"),
}


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def rounded(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, fill: str, outline: str | None = None, width: int = 1) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_centered(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, fill: str, fnt: ImageFont.ImageFont, max_width: int) -> None:
    lines: list[str] = []
    for paragraph in text.splitlines():
        current = ""
        for word in paragraph.split():
            probe = f"{current} {word}".strip()
            if draw.textbbox((0, 0), probe, font=fnt)[2] <= max_width:
                current = probe
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)

    line_height = int(fnt.size * 1.22) if hasattr(fnt, "size") else 24
    total_height = line_height * len(lines)
    y = xy[1] - total_height // 2
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=fnt)
        x = xy[0] - (bbox[2] - bbox[0]) // 2
        draw.text((x, y), line, fill=fill, font=fnt)
        y += line_height


def make_png(item: dict) -> Path:
    course = item["course"]
    module = item["module"]
    module_title = item["module_title"]
    primary, accent, dark, bg = PALETTES[course]
    out = ART_ROOT / course / f"module-{module}.png"
    out.parent.mkdir(parents=True, exist_ok=True)

    img = Image.new("RGB", (1600, 900), bg)
    draw = ImageDraw.Draw(img)

    rounded(draw, (70, 62, 1530, 838), 48, "#FFFFFF", "#E5DED1", 4)
    draw.ellipse((1320, 60, 1560, 300), fill=accent)
    draw.ellipse((1320, 60, 1560, 300), fill=accent)
    draw.ellipse((70, 642, 340, 912), fill=primary)
    overlay = Image.new("RGBA", img.size, (255, 255, 255, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse((1320, 60, 1560, 300), fill=accent + "33")
    od.ellipse((70, 642, 340, 912), fill=primary + "22")
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(img)

    draw.text((125, 125), f"{course.split('-')[0].upper()} Module {int(module)}", fill=dark, font=font(44, True))
    wrapped = textwrap.fill(module_title, width=46)
    draw.text((125, 185), wrapped, fill=primary, font=font(34, True), spacing=8)

    steps = [
        ("Purpose", "name the target"),
        ("Constraint", "make limits visible"),
        ("Evidence", "test the claim"),
        ("Revision", "document the change"),
    ]
    boxes = [(150, 360, 400, 510), (500, 360, 750, 510), (850, 360, 1100, 510), (590, 610, 1010, 745)]
    fills = [primary, accent, dark, "#F7EFE0"]
    text_fills = ["#FFFFFF", "#2E2300", "#FFFFFF", dark]

    for idx, ((title, subtitle), box, fill, text_fill) in enumerate(zip(steps, boxes, fills, text_fills)):
        rounded(draw, box, 34, fill, None, 0)
        cx = (box[0] + box[2]) // 2
        draw_centered(draw, (cx, box[1] + 58), title, text_fill, font(32, True), box[2] - box[0] - 36)
        draw_centered(draw, (cx, box[1] + 104), subtitle, text_fill, font(19), box[2] - box[0] - 28)
        if idx < 2:
            y = (box[1] + box[3]) // 2
            draw.line((box[2] + 26, y, box[2] + 88, y), fill=dark, width=9)
            draw.polygon([(box[2] + 88, y), (box[2] + 60, y - 18), (box[2] + 60, y + 18)], fill=dark)

    draw.arc((420, 470, 1160, 720), 20, 160, fill=primary, width=10)
    draw.polygon([(455, 593), (490, 578), (478, 618)], fill=primary)
    draw.arc((420, 470, 1160, 720), 200, 340, fill=primary, width=10)
    draw.polygon([(1125, 593), (1090, 578), (1102, 618)], fill=primary)

    draw.text((125, 795), "ALGET Summer 2026 supplement visual anchor", fill="#5B6470", font=font(23, True))
    draw.text((125, 826), "Generated locally as a project PNG; imagegen2 prompt remains available for later replacement.", fill="#6C7480", font=font(18))

    img.save(out, "PNG", optimize=True)
    return out


def update_section_references() -> int:
    count = 0
    for course_dir in ["ail606-supplement", "cat531-supplement", "cat100-supplement"]:
        for path in (CONTENT_ROOT / course_dir).glob("*/*.mdx"):
            text = path.read_text(encoding="utf-8")
            updated = text.replace(f"/course-art/{course_dir}/module-{path.parent.name}.svg", f"/course-art/{course_dir}/module-{path.parent.name}.png")
            if updated != text:
                path.write_text(updated, encoding="utf-8")
                count += 1
    return count


def main() -> None:
    items = json.loads(MANIFEST.read_text(encoding="utf-8"))
    outputs = [make_png(item) for item in items]
    changed = update_section_references()
    print(f"Generated {len(outputs)} PNG visual assets.")
    print(f"Updated {changed} section references from SVG to PNG.")


if __name__ == "__main__":
    main()
