"""Create course-specific visual anchors for sections without inline figures.

The visuals are intentionally lightweight SVGs: they are original, accessible,
and generated from each section's learning objectives and concept registry. The
same visual grammar keeps the corpus coherent while the labels stay section
specific rather than becoming generic filler.
"""

from __future__ import annotations

import html
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTENT_ROOT = ROOT / "frontend" / "content"
PUBLIC_ROOT = ROOT / "frontend" / "public"

PALETTE = {
    "ai-ethics": ("#0f5167", "#e4a12f", "#eaf3f4", "#102a35"),
    "bio-inspired": ("#1f624c", "#c78a35", "#edf3ec", "#17382e"),
    "dynamics": ("#245b6a", "#d18b36", "#edf4f5", "#18323b"),
    "inst-design": ("#7a1e2d", "#c99700", "#f8f1e8", "#33222a"),
    "statics": ("#245b6a", "#9e1b32", "#f2f6f5", "#192f39"),
}


def trim(value: str, length: int = 52) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    if len(value) <= length:
        return value
    return value[: length - 1].rstrip() + "…"


def esc(value: str) -> str:
    return html.escape(value, quote=True)


def svg_for(meta: dict, course: str, chapter: str, section: str) -> str:
    primary, accent, soft, ink = PALETTE.get(course, ("#1f624c", "#c78a35", "#edf3ec", "#17382e"))
    title = trim(meta.get("title", f"Section {chapter}.{section}"), 54)
    objectives = meta.get("learning_objectives", [])
    objective_text = [
        trim(item if isinstance(item, str) else item.get("statement", ""), 44)
        for item in objectives[:3]
    ]
    while len(objective_text) < 3:
        objective_text.append("Use evidence to make the next design move")
    concepts = [trim(str(item).replace("_", " "), 24) for item in meta.get("concept_ids", [])[:3]]
    while len(concepts) < 3:
        concepts.append("course concept")
    labels = ["Name the principle", "Test the evidence", "Transfer the decision"]
    cards = []
    for index, (label, objective, concept) in enumerate(zip(labels, objective_text, concepts)):
        x = 110 + index * 490
        fill = primary if index == 0 else accent if index == 1 else ink
        text_fill = "#ffffff" if index != 1 else "#231d12"
        cards.append(
            f'''<g>
  <rect x="{x}" y="385" width="390" height="250" rx="28" fill="{fill}"/>
  <text x="{x + 28}" y="430" font-family="IBM Plex Sans, Arial" font-size="18" font-weight="700" letter-spacing="2" fill="{text_fill}">{esc(label.upper())}</text>
  <text x="{x + 28}" y="478" font-family="Fraunces, Georgia" font-size="27" font-weight="700" fill="{text_fill}">{esc(concept)}</text>
  <text x="{x + 28}" y="525" font-family="IBM Plex Sans, Arial" font-size="18" fill="{text_fill}">{esc(objective)}</text>
  <text x="{x + 28}" y="565" font-family="IBM Plex Sans, Arial" font-size="16" fill="{text_fill}" opacity="0.82">Evidence trace → revision</text>
</g>'''
        )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-labelledby="title desc">
  <title id="title">{esc(title)} learning map</title>
  <desc id="desc">A three-step learning map connecting the section principle, evidence check, and transfer decision.</desc>
  <rect width="1600" height="900" fill="{soft}"/>
  <rect x="48" y="48" width="1504" height="804" rx="42" fill="#ffffff" stroke="#d8e3df" stroke-width="4"/>
  <circle cx="1450" cy="120" r="130" fill="{accent}" opacity="0.18"/>
  <circle cx="120" cy="800" r="180" fill="{primary}" opacity="0.08"/>
  <text x="110" y="145" font-family="IBM Plex Sans, Arial" font-size="22" font-weight="700" letter-spacing="3" fill="{primary}">{esc(course.upper().replace('-', ' '))} · SECTION {esc(chapter)}.{esc(section)}</text>
  <text x="110" y="220" font-family="Fraunces, Georgia" font-size="54" font-weight="700" fill="{ink}">{esc(title)}</text>
  <text x="110" y="275" font-family="IBM Plex Sans, Arial" font-size="22" fill="#52645e">A visual anchor for reading, practice, and transfer.</text>
  <path d="M 500 510 C 535 510, 550 510, 590 510" stroke="#ffffff" stroke-width="10" opacity="0.9"/>
  <path d="M 990 510 C 1025 510, 1040 510, 1080 510" stroke="#ffffff" stroke-width="10" opacity="0.9"/>
  {''.join(cards)}
  <text x="110" y="765" font-family="IBM Plex Sans, Arial" font-size="18" font-weight="600" fill="#52645e">ALGET original instructional visual · generated from section objectives and concepts</text>
</svg>
'''


def main() -> None:
    created = 0
    injected = 0
    for mdx in sorted(CONTENT_ROOT.glob("*/*/*.mdx")):
        text = mdx.read_text(encoding="utf-8")
        if "<img" in text.lower():
            continue
        course, chapter, filename = mdx.relative_to(CONTENT_ROOT).parts
        section = filename.split(".", 1)[0]
        meta_path = mdx.with_name(f"{section}.meta.json")
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        out = PUBLIC_ROOT / "course-art" / "section-anchors" / course / f"{chapter}-{section}.svg"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(svg_for(meta, course, chapter, section), encoding="utf-8")
        created += 1
        marker = f"section-anchor-{course}-{chapter}-{section}"
        if marker in text:
            continue
        title = meta.get("title", f"Section {chapter}.{section}")
        concepts = ", ".join(str(value).replace("_", " ") for value in meta.get("concept_ids", [])[:3])
        block = f'''\n<figure-block id="{marker}" caption="Learning map for {title}: principle, evidence, and transfer." purpose="organizational" source="ALGET original instructional diagram" license="Project-authored; repository license">\n  <img src="/course-art/section-anchors/{course}/{chapter}-{section}.svg" alt="Learning map for {title}, connecting {concepts or 'the section concepts'} to evidence and transfer." loading="lazy" decoding="async" />\n</figure-block>\n'''
        heading = re.search(r"^# .+$", text, flags=re.MULTILINE)
        if heading:
            end = heading.end()
            text = text[:end] + "\n" + block + text[end:]
        else:
            text = block + text
        mdx.write_text(text, encoding="utf-8")
        injected += 1
    print(f"created_visuals={created}")
    print(f"injected_figure_blocks={injected}")


if __name__ == "__main__":
    main()
