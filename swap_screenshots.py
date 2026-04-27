"""Replace SVG mockups with real PNG screenshots in the two HTML guides."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# (aria-label substring → screenshot filename + alt text). Skipped entries
# keep the SVG (conceptual diagrams or surfaces we didn't capture).
LEARNER = {
    "Course chooser at /learn":
        ("screenshots/02_course_chooser.png", "Course chooser at /learn"),
    "Brain network mastery graph":
        ("screenshots/06_student_dashboard.png",
         "Student dashboard with mastery panels"),
    "Intelligence rail with four tabs":
        ("screenshots/04_intel_rail_open.png",
         "Reader with the BigAL Support Rail open"),
    "Floating tutor chat (BigAL)":
        ("screenshots/05_chat_widget.png", "BigAL floating tutor chat"),
}
INSTRUCTOR = {
    "Textbook reader layout: TOC, reading pane, intelligence rail":
        ("screenshots/04_intel_rail_open.png",
         "Reader at /book/<course>/<chapter>/<section>"),
    "Instructor cohort dashboard with three panels":
        ("screenshots/07_instructor_dashboard.png",
         "Instructor dashboard at /instructor"),
}

SVG_BLOCK = re.compile(
    r'<svg[^>]*?aria-label="([^"]*)"[^>]*?>.*?</svg>',
    re.DOTALL,
)


def swap(path, mapping):
    src = path.read_text(encoding="utf-8")

    def repl(m):
        label = m.group(1)
        for key, (img, alt) in mapping.items():
            if key in label:
                return f'<img src="{img}" alt="{alt}" loading="lazy">'
        return m.group(0)  # keep SVG

    out = SVG_BLOCK.sub(repl, src)
    n_before = len(SVG_BLOCK.findall(src))
    n_after = len(SVG_BLOCK.findall(out))
    n_swapped = n_before - n_after
    path.write_text(out, encoding="utf-8")
    print(f"{path.name}: swapped {n_swapped} of {n_before} svgs")


swap(ROOT / "LEARNER_GUIDE.html", LEARNER)
swap(ROOT / "INSTRUCTOR_GUIDE.html", INSTRUCTOR)
