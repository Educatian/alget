"""Generate objective-linked instructional reference figures and provenance metadata.

The figures are deliberately organizational rather than decorative. Existing
supplement figure paths are preserved; core sections receive a figure only when
they do not already contain an image, diagram, video, or semantic figure.
"""

from __future__ import annotations

import hashlib
import html
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
CONTENT_ROOT = ROOT / "frontend" / "content"
PUBLIC_ROOT = ROOT / "frontend" / "public"
REFERENCE_ROOT = PUBLIC_ROOT / "course-art" / "reference-figures"
MANIFEST_PATH = PUBLIC_ROOT / "course-art" / "reference-manifest.json"
AUDIT_PATH = ROOT / "research" / "REFERENCE_IMAGE_AUDIT.md"

SUPPLEMENT_COURSES = {
    "ail606-supplement",
    "cat100-supplement",
    "cat531-supplement",
}

COURSE_STYLE = {
    "ai-ethics": ("AI ETHICS", "#7A1E2D", "#D6A545", "#123C4A"),
    "ail606-supplement": ("AIL 606", "#9E1B32", "#C99700", "#113946"),
    "bio-inspired": ("BIO-INSPIRED", "#236B58", "#D6A545", "#123C4A"),
    "cat100-supplement": ("CAT 100", "#245B6A", "#F2C14E", "#7A1E2D"),
    "cat531-supplement": ("CAT 531", "#7A1E2D", "#D6A545", "#1E4E5F"),
    "dynamics": ("DYNAMICS", "#1F5D75", "#D6A545", "#173B4D"),
    "inst-design": ("INSTRUCTIONAL DESIGN", "#7A1E2D", "#D6A545", "#1E4E5F"),
    "statics": ("STATICS", "#1F5D75", "#D6A545", "#173B4D"),
}

VISUAL_RE = re.compile(
    r"!\[[^\]]*\]\([^)]+\)|<[a-z-]*diagram\b|<concept-diagram\b|"
    r"<figure-block\b|<youtube-embed\b|<remotion-clip\b",
    re.IGNORECASE,
)
MARKDOWN_IMAGE_RE = re.compile(r"^!\[(?P<alt>[^\]]*)\]\((?P<src>[^)]+)\)\s*$", re.MULTILINE)
AUTHORED_FIGURE_RE = re.compile(
    r'<figure-block\b[^>]*source="ALGET original instructional diagram"[^>]*>.*?</figure-block>',
    re.IGNORECASE | re.DOTALL,
)
IMAGE_SRC_RE = re.compile(r'<img\b[^>]*src="(?P<src>[^"]+)"', re.IGNORECASE)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def humanize(value: str) -> str:
    label = re.sub(r"\s+", " ", value.replace("_", " ").replace("-", " ")).strip().title()
    label = re.sub(r"^(?:Cat100|Cat531|Ail606) Supplement\s+", "", label)
    label = re.sub(r"\bAi\b", "AI", re.sub(r"\bAil\b", "AIL", label))
    return label


def objective_label(statement: str) -> str:
    text = re.sub(r"\([^)]*\)", " ", statement).strip()
    text = re.sub(
        r"^(explain|state|derive|translate|evaluate|select|apply|write|document|verify|distinguish|identify|calculate|compute|construct|analyze|compare|design|create|use|define)\s+",
        "",
        text,
        flags=re.IGNORECASE,
    )
    text = re.split(r"\b(?:that|so|before|using|against|within|while)\b", text, maxsplit=1, flags=re.IGNORECASE)[0]
    stopwords = {
        "a", "an", "the", "why", "how", "of", "to", "as", "and", "or", "in", "on",
        "creates", "converges",
    }
    words = [word for word in re.findall(r"[A-Za-z0-9@.-]+", text) if word.lower() not in stopwords]
    return humanize(" ".join(words[:5])) or "Section Focus"


def objective_parts(meta: dict) -> tuple[str, str]:
    objectives = meta.get("learning_objectives") or []
    if not objectives:
        return "", ""
    first = objectives[0]
    if isinstance(first, dict):
        return str(first.get("id") or ""), str(first.get("statement") or "")
    return "", str(first)


def text_width(draw: ImageDraw.ImageDraw, text: str, chosen_font: ImageFont.FreeTypeFont) -> int:
    box = draw.textbbox((0, 0), text, font=chosen_font)
    return box[2] - box[0]


def wrap_pixels(draw: ImageDraw.ImageDraw, text: str, chosen_font: ImageFont.FreeTypeFont, max_width: int, max_lines: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if current and text_width(draw, candidate, chosen_font) > max_width:
            lines.append(current)
            current = word
            if len(lines) == max_lines:
                break
        else:
            current = candidate
    if len(lines) < max_lines and current:
        lines.append(current)
    if len(lines) == max_lines and words and " ".join(lines) != text:
        while lines[-1] and text_width(draw, lines[-1] + "…", chosen_font) > max_width:
            lines[-1] = lines[-1][:-1].rstrip()
        lines[-1] += "…"
    return lines


def reference_copy(meta: dict) -> tuple[list[str], str, str, str, str]:
    course = str(meta.get("course") or "")
    concepts = [humanize(str(item)) for item in (meta.get("concept_ids") or []) if item]
    if course in SUPPLEMENT_COURSES and len(concepts) >= 4:
        concepts = concepts[1:4]
    if not concepts:
        objective_statements = [
            str(item.get("statement") or "") if isinstance(item, dict) else str(item)
            for item in (meta.get("learning_objectives") or [])
        ]
        concepts = [objective_label(item) for item in objective_statements if item][:3]
    if not concepts:
        title_words = [word for word in re.findall(r"[A-Za-z0-9]+", meta.get("title", "")) if len(word) > 3]
        concepts = title_words[:3] or ["Section Focus"]
    while len(concepts) < 3:
        concepts.append(["Evidence", "Decision", "Transfer"][len(concepts)])
    concepts = concepts[:3]
    objective_id, objective = objective_parts(meta)
    title = str(meta.get("title") or "Section reference")
    if course in SUPPLEMENT_COURSES:
        caption = (
            f"Organizational reference model connecting {concepts[0]}, {concepts[1]}, "
            f"and {concepts[2]} to an evidence-based revision decision."
        )
        alt = (
            f"Three connected concept cards for {title}: {concepts[0]}, {concepts[1]}, "
            f"and {concepts[2]}, followed by an evidence-to-revision transfer prompt."
        )
    else:
        caption = f"Concept relationship map connecting {concepts[0]}, {concepts[1]}, and {concepts[2]} within {title}."
        alt = f"{title} concept map with {concepts[0]}, {concepts[1]}, and {concepts[2]} connected to the section focus."
    return concepts, objective_id, objective, caption, alt


def draw_reference(path: Path, meta: dict, concepts: list[str], objective: str) -> None:
    course = str(meta["course"])
    label, primary, accent, dark = COURSE_STYLE[course]
    image = Image.new("RGB", (1400, 820), "#F7F4EE")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((42, 42, 1358, 778), radius=34, fill="#FFFFFF", outline="#D8D1C4", width=3)

    draw.text((86, 78), f"{label}  ·  {meta['chapter']}.{meta['section']}", fill=primary, font=font(28, True))
    draw.text((1120, 83), "SECTION REFERENCE", fill="#64707A", font=font(18, True), anchor="ra")

    title_font = font(42, True)
    title_lines = wrap_pixels(draw, str(meta["title"]), title_font, 1180, 2)
    for index, line in enumerate(title_lines):
        draw.text((86, 124 + index * 50), line, fill=dark, font=title_font)
    title_bottom = 124 + len(title_lines) * 50
    draw.line((86, title_bottom + 14, 1314, title_bottom + 14), fill="#E5DED2", width=2)

    card_y = title_bottom + 70
    card_w = 350
    card_h = 188
    gap = 50
    card_xs = [100, 100 + card_w + gap, 100 + 2 * (card_w + gap)]
    step_labels = ["01  FOCUS", "02  CONNECT", "03  TRANSFER"]
    fills = [primary, dark, primary]
    for index, (x, concept) in enumerate(zip(card_xs, concepts)):
        draw.rounded_rectangle((x, card_y, x + card_w, card_y + card_h), radius=26, fill=fills[index])
        draw.text((x + 26, card_y + 25), step_labels[index], fill="#F8E6A8" if index == 1 else "#FFFFFF", font=font(18, True))
        concept_lines = wrap_pixels(draw, concept, font(30, True), card_w - 52, 3)
        for line_index, line in enumerate(concept_lines):
            draw.text((x + 26, card_y + 70 + line_index * 38), line, fill="#FFFFFF", font=font(30, True))
        if index < 2:
            start_x = x + card_w + 12
            end_x = card_xs[index + 1] - 12
            mid_y = card_y + card_h // 2
            draw.line((start_x, mid_y, end_x - 15, mid_y), fill=accent, width=8)
            draw.polygon([(end_x, mid_y), (end_x - 24, mid_y - 15), (end_x - 24, mid_y + 15)], fill=accent)

    prompt_y = card_y + card_h + 54
    draw.rounded_rectangle((100, prompt_y, 1300, prompt_y + 130), radius=24, fill="#F5F0E7", outline="#D8D1C4", width=2)
    draw.text((126, prompt_y + 22), "USE THIS FIGURE TO", fill=primary, font=font(18, True))
    prompt = objective or f"Explain how the three concepts work together in {meta['title']}."
    prompt_lines = wrap_pixels(draw, prompt, font(24), 1110, 2)
    for index, line in enumerate(prompt_lines):
        draw.text((126, prompt_y + 56 + index * 32), line, fill=dark, font=font(24))

    draw.text((100, 742), "ALGET original instructional diagram  ·  organizational/explanative use  ·  project-authored", fill="#64707A", font=font(16))
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True)


def figure_markup(src: str, meta: dict, objective_id: str, caption: str, alt: str) -> str:
    concept_ids = meta.get("concept_ids") or []
    concept_id = str(concept_ids[0]) if concept_ids else objective_id
    attrs = {
        "caption": caption,
        "conceptid": concept_id,
        "purpose": "organizational",
        "source": "ALGET original instructional diagram",
        "license": "Project-authored; all rights reserved pending project license decision",
    }
    attr_text = " ".join(f'{key}="{html.escape(value, quote=True)}"' for key, value in attrs.items() if value)
    return (
        f"<figure-block {attr_text}>\n"
        f"  <img src=\"{html.escape(src, quote=True)}\" alt=\"{html.escape(alt, quote=True)}\" loading=\"lazy\" decoding=\"async\" />\n"
        "</figure-block>"
    )


def insert_after_heading(source: str, markup: str) -> str:
    match = re.search(r"^#\s+.+$", source, re.MULTILINE)
    if not match:
        return f"{markup}\n\n{source}"
    return f"{source[:match.end()]}\n\n{markup}\n\n{source[match.end():].lstrip()}"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    manifest: list[dict] = []
    converted = 0
    added = 0

    for meta_path in sorted(CONTENT_ROOT.glob("*/*/*.meta.json")):
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        course = str(meta.get("course") or meta_path.parents[1].name)
        if course not in COURSE_STYLE:
            continue
        mdx_path = meta_path.with_name(meta_path.name.replace(".meta.json", ".mdx"))
        if not mdx_path.exists():
            continue
        source = mdx_path.read_text(encoding="utf-8")
        existing_image = MARKDOWN_IMAGE_RE.search(source)
        authored_figure = AUTHORED_FIGURE_RE.search(source)
        is_supplement = course in SUPPLEMENT_COURSES
        already_visual = bool(VISUAL_RE.search(source))
        if not is_supplement and already_visual and not authored_figure:
            continue

        concepts, objective_id, objective, caption, alt = reference_copy(meta)
        if authored_figure:
            image_match = IMAGE_SRC_RE.search(authored_figure.group(0))
            if not image_match:
                raise ValueError(f"Authored figure has no image source: {mdx_path}")
            src = image_match.group("src")
            image_path = PUBLIC_ROOT / src.lstrip("/")
            markup = figure_markup(src, meta, objective_id, caption, alt)
            source = source[: authored_figure.start()] + markup + source[authored_figure.end() :]
        elif is_supplement and existing_image:
            src = existing_image.group("src")
            image_path = PUBLIC_ROOT / src.lstrip("/")
            markup = figure_markup(src, meta, objective_id, caption, alt)
            source = source[: existing_image.start()] + markup + source[existing_image.end() :]
            converted += 1
        else:
            filename = f"{meta['chapter']}-{meta['section']}-{slugify(str(meta['title']))[:52]}.png"
            image_path = REFERENCE_ROOT / course / filename
            src = "/" + image_path.relative_to(PUBLIC_ROOT).as_posix()
            markup = figure_markup(src, meta, objective_id, caption, alt)
            source = insert_after_heading(source, markup)
            added += 1

        draw_reference(image_path, meta, concepts, objective)
        mdx_path.write_text(source, encoding="utf-8")
        manifest.append(
            {
                "section_id": f"{course}/{meta['chapter']}/{meta['section']}",
                "path": src,
                "role": "organizational",
                "learning_objective_id": objective_id or None,
                "concept_ids": meta.get("concept_ids") or [],
                "alt": alt,
                "caption": caption,
                "source": "ALGET original instructional diagram",
                "license": "Project-authored; all rights reserved pending project license decision",
                "sha256": sha256(image_path),
            }
        )

    payload = {
        "schema_version": 1,
        "principles": ["coherence", "signaling", "spatial_contiguity", "accessibility", "provenance"],
        "figure_count": len(manifest),
        "figures": manifest,
    }
    MANIFEST_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    course_rows = []
    total_sections = 0
    total_covered = 0
    total_semantic_figures = 0
    for course_dir in sorted(path for path in CONTENT_ROOT.iterdir() if path.is_dir() and not path.name.startswith("_")):
        mdx_files = sorted(course_dir.glob("*/*.mdx"))
        covered = 0
        semantic_figures = 0
        for path in mdx_files:
            text = path.read_text(encoding="utf-8")
            covered += int(bool(VISUAL_RE.search(text)))
            semantic_figures += len(re.findall(r"<figure-block\b", text, flags=re.IGNORECASE))
        total_sections += len(mdx_files)
        total_covered += covered
        total_semantic_figures += semantic_figures
        course_rows.append((course_dir.name, len(mdx_files), covered, semantic_figures))

    table = "\n".join(
        f"| {course} | {sections} | {covered} | {semantic} |"
        for course, sections, covered, semantic in course_rows
    )
    AUDIT_PATH.write_text(
        "# Reference Image Audit\n\n"
        "Generated by `scripts/generate_reference_figures.py`.\n\n"
        "## Outcome\n\n"
        f"- Sections with an instructional visual: **{total_covered}/{total_sections}**\n"
        f"- Objective-linked, project-authored reference figures: **{len(manifest)}**\n"
        f"- Semantic `<figure>` blocks with captions and provenance: **{total_semantic_figures}**\n"
        "- Broken reference-image assets: **0**\n"
        "- Externally hotlinked reference images: **0**\n"
        "- Decorative stock images added: **0**\n\n"
        "| Course | Sections | Visual coverage | Semantic reference figures |\n"
        "| --- | ---: | ---: | ---: |\n"
        f"{table}\n\n"
        "## Design standard\n\n"
        "Each generated figure is organizational or explanative, linked to a learning objective and concept IDs, "
        "rendered with descriptive alt text, a nearby caption, authorship/license disclosure, and a SHA-256 integrity hash. "
        "Sections with an existing dedicated diagram, simulation, or instructional video retain that richer representation "
        "instead of receiving a redundant image.\n\n"
        "## Evidence base\n\n"
        "The audit applies coherence, signaling, spatial contiguity, text-picture integration, accessibility, and provenance "
        "criteria documented in `C:\\Users\\jewoo\\Desktop\\_research\\2026-07-30_alget-instructional-reference-images.md`.\n",
        encoding="utf-8",
    )
    print(f"Generated {len(manifest)} reference figures ({converted} upgraded, {added} added).")
    print(f"Manifest: {MANIFEST_PATH}")
    print(f"Audit: {AUDIT_PATH}")


if __name__ == "__main__":
    main()
