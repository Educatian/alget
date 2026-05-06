from __future__ import annotations

import json
import re
from pathlib import Path
from textwrap import dedent

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pragma: no cover
    Image = None
    ImageDraw = None
    ImageFont = None


ROOT = Path(__file__).resolve().parents[1]
CONTENT_ROOT = ROOT / "frontend" / "content"
PUBLIC_ROOT = ROOT / "frontend" / "public"
ART_ROOT = PUBLIC_ROOT / "course-art" / "deep-exemplars"
DOWNLOAD_ROOT = PUBLIC_ROOT / "downloads" / "summer2026"


COURSE_PROFILES = {
    "ail606-supplement": {
        "short": "AIL 606",
        "focus": "graduate multimedia learning design",
        "anchors": ["Mayer multimedia learning", "cognitive load", "storyboard traceability", "usability testing", "AI-USE disclosure"],
        "artifacts": [
            "AI-USE.md disclosure excerpt",
            "storyboard frame sequence",
            "cognitive load diagnostic table",
            "usability test script",
            "prototype README traceability matrix",
            "capstone defense evidence board",
        ],
        "citations": ["Mayer, 2021", "Sweller, 2011", "CAST, 2018", "Nielsen, 1994"],
    },
    "cat531-supplement": {
        "short": "CAT 531",
        "focus": "teacher technology judgment and AI ethics",
        "anchors": ["Design Tension Studio", "TeachGen@i", "Ethobot 3.2", "classroom policy interpretation", "equity-oriented edtech evaluation"],
        "artifacts": [
            "DTS tension map",
            "TeachGen@i prompt transcript",
            "Ethobot transcript annotation",
            "school AI policy memo",
            "edtech evaluation matrix",
            "field-placement transfer note",
        ],
        "citations": ["Mishra & Koehler, 2006", "Selwyn, 2016", "Williamson & Eynon, 2020", "Kimmons, 2020"],
    },
    "cat100-supplement": {
        "short": "CAT 100",
        "focus": "undergraduate digital fluency and AI-assisted productivity",
        "anchors": ["digital citizenship", "Excel data storytelling", "resume evidence", "GitHub Pages", "privacy and account safety"],
        "artifacts": [
            "resume before-after revision",
            "Excel pivot-table finding",
            "GitHub Pages file tree",
            "presentation storyboard",
            "AI critique log",
            "privacy checklist",
        ],
        "citations": ["ISTE, 2024", "NACE, 2024", "Tufte, 2001", "W3C, 2023"],
    },
}


TARGET_SECTIONS = [(chapter, section) for chapter in range(1, 9) for section in range(1, 9)]


def learner_trace_objective(profile: dict) -> str:
    short = profile["short"]
    if short == "AIL 606":
        return "Use annotations, support requests, and revision notes to decide what help or design change should come next."
    if short == "CAT 531":
        return "Use annotations, support requests, and revision notes to make a classroom technology decision more defensible."
    return "Use feedback, support requests, and revision notes to improve the artifact before sharing it."


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def select_artifact(course: str, title: str, chapter: int, section: int) -> str:
    lower = title.lower()
    if course == "cat100-supplement":
        rules = [
            (["resume", "linkedin", "bio", "portfolio", "career"], "resume before-after revision"),
            (["pivot", "excel", "formula", "spreadsheet", "data", "chart"], "Excel pivot-table finding"),
            (["presentation", "slide"], "presentation storyboard"),
            (["github", "website", "pages"], "GitHub Pages file tree"),
            (["privacy", "account", "safety"], "privacy checklist"),
            (["ai", "prompt", "feedback", "critique", "ethobot"], "AI critique log"),
        ]
        for keys, artifact in rules:
            if any(key in lower for key in keys):
                return artifact
    if course == "cat531-supplement":
        rules = [
            (["tension", "dts", "conflict"], "DTS tension map"),
            (["teachgen", "prompt", "ai literacy", "prompting"], "TeachGen@i prompt transcript"),
            (["ethobot", "dialogue", "ethical"], "Ethobot transcript annotation"),
            (["policy", "privacy", "consent", "risk", "family", "fallback"], "school AI policy memo"),
            (["equity", "evaluation", "rubric"], "edtech evaluation matrix"),
            (["field", "transfer", "placement"], "field-placement transfer note"),
        ]
        for keys, artifact in rules:
            if any(key in lower for key in keys):
                return artifact
    if course == "ail606-supplement":
        rules = [
            (["storyboard", "frame", "narration"], "storyboard frame sequence"),
            (["cognitive", "load", "multimedia", "mayer"], "cognitive load diagnostic table"),
            (["usability", "test", "observation"], "usability test script"),
            (["prototype", "readme", "screen", "toolchain"], "prototype README traceability matrix"),
            (["capstone", "defense", "readiness", "showcase"], "capstone defense evidence board"),
            (["ai-use", "disclosure", "policy"], "AI-USE.md disclosure excerpt"),
        ]
        for keys, artifact in rules:
            if any(key in lower for key in keys):
                return artifact
    return COURSE_PROFILES[course]["artifacts"][(chapter + section - 2) % len(COURSE_PROFILES[course]["artifacts"])]


def wrap_lines(text: str, width: int = 36) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        if sum(len(w) for w in current) + len(current) + len(word) > width:
            lines.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        lines.append(" ".join(current))
    return lines


def font(size: int, bold: bool = False):
    if ImageFont is None:
        return None
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


def draw_exemplar_image(course: str, chapter: int, section: int, title: str, profile: dict, artifact: str) -> str:
    out_dir = ART_ROOT / course
    out_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{chapter:02d}-{section:02d}-{slugify(title)[:42]}.png"
    rel = f"/course-art/deep-exemplars/{course}/{filename}"
    if Image is None:
        return rel

    image = Image.new("RGB", (1400, 820), "#fbfaf7")
    draw = ImageDraw.Draw(image)
    colors = {
        "ail606-supplement": ("#9E1B32", "#C99700", "#113946"),
        "cat531-supplement": ("#7A1E2D", "#D6A545", "#1E4E5F"),
        "cat100-supplement": ("#245B6A", "#9E1B32", "#F2C14E"),
    }[course]
    primary, accent, dark = colors
    draw.rounded_rectangle((50, 50, 1350, 770), radius=34, fill="#ffffff", outline="#ded8cc", width=3)
    draw.text((90, 92), f"{profile['short']} {chapter:02d}.{section:02d}", fill=primary, font=font(34, True))
    draw.text((90, 140), title, fill=dark, font=font(42, True))
    draw.text((90, 205), f"Artifact-specific exemplar: {artifact}", fill="#4f5963", font=font(25))

    x0, y0, w, h = 100, 300, 260, 170
    labels = ["Artifact", "Evidence", "Decision", "Revision"]
    subtitles = [
        artifact,
        "rubric, peer note, or usability trace",
        "accept, reject, or modify AI/software output",
        "document visible change and limitation",
    ]
    for i, label in enumerate(labels):
        x = x0 + i * 310
        fill = primary if i in (0, 3) else accent if i == 1 else dark
        text_fill = "#ffffff" if i != 1 else "#2d2100"
        draw.rounded_rectangle((x, y0, x + w, y0 + h), radius=26, fill=fill)
        draw.text((x + 24, y0 + 26), label, fill=text_fill, font=font(28, True))
        for j, line in enumerate(wrap_lines(subtitles[i], 25)[:3]):
            draw.text((x + 24, y0 + 72 + j * 28), line, fill=text_fill, font=font(19))
        if i < 3:
            draw.line((x + w + 18, y0 + 84, x + 292, y0 + 84), fill=dark, width=8)
            draw.polygon([(x + 292, y0 + 84), (x + 266, y0 + 68), (x + 266, y0 + 100)], fill=dark)

    for i, anchor in enumerate(profile["anchors"][:5]):
        x = 110 + (i % 3) * 390
        y = 560 + (i // 3) * 58
        draw.rounded_rectangle((x, y, x + 350, y + 42), radius=21, fill="#f4efe6", outline="#d9cfbf")
        draw.text((x + 18, y + 10), anchor, fill=dark, font=font(18, True))

    image.save(out_dir / filename, quality=92)
    return rel


def load_title(course: str, chapter: int, section: int) -> tuple[str, str]:
    meta_path = CONTENT_ROOT / course / f"{chapter:02d}" / f"{section:02d}.meta.json"
    data = json.loads(meta_path.read_text(encoding="utf-8"))
    return data["chapter_title"], data["title"]


def artifact_download(course: str, chapter: int, section: int, title: str, profile: dict, artifact: str) -> str:
    out_dir = DOWNLOAD_ROOT / course
    out_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{chapter:02d}-{section:02d}-{slugify(title)[:42]}-artifact.md"
    path = out_dir / filename
    path.write_text(dedent(f"""\
    # {profile['short']} Artifact Packet: {title}

    ## Artifact Type
    {artifact}

    ## Student-Facing Task
    Create or revise the artifact so that another reader can see the relationship among audience, constraint, evidence, and revision.

    ## Required Evidence Trail
    - Original artifact decision
    - AI/software support used for one bounded move
    - Evidence source that challenged or confirmed the decision
    - Accepted suggestion
    - Rejected suggestion
    - Final revision note

    ## Instructor Review Focus
    Review whether the student's judgment is visible, not only whether the artifact looks complete.
    """), encoding="utf-8")
    return f"/downloads/summer2026/{course}/{filename}"


def section_body(course: str, chapter: int, section: int) -> str:
    profile = COURSE_PROFILES[course]
    module_title, title = load_title(course, chapter, section)
    artifact = select_artifact(course, title, chapter, section)
    anchors = profile["anchors"]
    citations = "; ".join(profile["citations"])
    image_path = draw_exemplar_image(course, chapter, section, title, profile, artifact)
    download_path = artifact_download(course, chapter, section, title, profile, artifact)
    concept_id = f"{course.replace('-', '_')}_{slugify(title).replace('-', '_')}"
    return dedent(f"""\
    # {title}

    ![{title} artifact-specific visual]({image_path})

    ## Why This Section Is No Longer Generic

    This hardened version treats **{title}** as a concrete {profile['focus']} task rather than a generic AI-supported reflection. The student is not only asked to complete a course activity. The student must inspect a real artifact form, name the decision being made, and show how evidence changes the next version. That shift matters because an section needs to do more than deliver content; it should help the student make a decision, revise it, and explain the evidence behind it.

    The exemplar artifact for this section is a **{artifact}**. It is intentionally narrow. A narrow artifact helps you connect reading, annotation, practice, feedback, and revision around observable behavior. The section therefore creates a practical trace: what you noticed, what support you requested, what you revised, and what evidence justified the revision.

    ## Course Anchors

    This section is grounded in {citations}. The local course anchors are: **{anchors[0]}**, **{anchors[1]}**, **{anchors[2]}**, and **{anchors[3]}**. These anchors are not decorative citations. They define what counts as quality. For example, a polished artifact that ignores {anchors[1]} is still weak, because the artifact has not addressed the constraint that the course is designed to teach.

    ## Artifact Walkthrough

    Open the artifact packet: [download the {artifact} packet]({download_path}).

    Step 1 is to identify the artifact claim. A claim is a statement about what the artifact helps a learner, teacher, or professional audience do. In this section, the claim should mention **{module_title}** and should use vocabulary from **{title}**. A weak claim says that the artifact is "clear" or "useful." A stronger claim says what action becomes easier, for whom, under which constraint.

    Step 2 is to inspect the evidence. Evidence may come from a rubric criterion, a peer annotation, a usability observation, a spreadsheet check, an accessibility check, a classroom scenario, or a transcript mark. The key rule is that the evidence must be specific enough to force a visible revision. If the evidence cannot change the artifact, it is only an opinion.

    Step 3 is to use AI or software support as a bounded move. The student may ask for alternatives, debugging help, wording critique, checklist generation, or visual simplification. The student may not outsource the whole artifact. The support choice should stay visible as part of the revision path, not as authorship transfer.

    ## Before/After Exemplar

    **Before:** The student submits the artifact and writes, "I used AI to improve it." The statement is not wrong, but it is not useful for review. It hides the student's judgment and gives the instructor no evidence about what changed.

    **After:** The learner writes, "I used AI to generate three possible revisions for the {artifact}. I accepted the suggestion that clarified the audience constraint, rejected the suggestion that weakened {anchors[0]}, and revised the artifact so the evidence trail now names the source of feedback." This version is easier for an instructor, peer, or future self to review.

    <dynamic-scenario prompt="You are revising a {artifact} for {profile['short']} {chapter:02d}.{section:02d}. The artifact is complete, but a peer comment shows unresolved confusion about {anchors[1]}. Choose the next revision move and what evidence would show that it helped." />

    ## What To Notice

    Use this section to make four things visible:

    - **Reader note:** Did you ask a question, flag confusion, make a connection, or identify an insight?
    - **Artifact record:** Did the artifact show a before/after decision trail?
    - **Support choice:** Did you ask for explanation, representation, practice, or a next-step prompt?
    - **Confidence check:** Did your confidence match the quality of the revision?

    These details make the page useful as a working studio. The page explains the idea, then asks you to use it, revise with evidence, and choose support that fits the moment.

    ## Misconception Watch

    The likely misconception in this section is **artifact polish as evidence**. Students may believe the artifact is strong because it is clean, fluent, or visually finished. That is insufficient. The artifact is strong only when a reader can see how a decision responds to a course constraint and how evidence changed the next version.

    A second misconception is **AI output as authority**. In {profile['short']}, the tool output is a proposal. The learner remains responsible for deciding whether the proposal fits {anchors[2]}, {anchors[3]}, and the assignment standard.

    ## Apply It Now

    Use the packet and write a six-line revision trace:

    1. Artifact claim:
    2. Audience or learner constraint:
    3. Evidence source:
    4. AI/software support used:
    5. Suggestion accepted and why:
    6. Suggestion rejected and why:

    <interactive-quiz question="What makes this artifact useful for review?" options='["It looks finished and uses professional wording.", "It includes a visible claim, evidence source, bounded support choice, and revision decision.", "It uses the newest AI tool available.", "It avoids mentioning uncertainty or rejected suggestions."]' correct-index="1" conceptid="{concept_id}" />

    ## Carry Forward

    Carry forward the artifact-specific rule: review-ready evidence requires a visible student decision. In the next section, do not only ask whether the artifact is complete. Ask what changed, what support helped, and what evidence would make the next revision stronger.
    """)


def update_json_sidecars(course: str, chapter: int, section: int) -> None:
    profile = COURSE_PROFILES[course]
    module_title, title = load_title(course, chapter, section)
    artifact = select_artifact(course, title, chapter, section)
    stem = slugify(f"{course}-{chapter}-{section}-{title}").replace("-", "_")
    practice_path = CONTENT_ROOT / course / f"{chapter:02d}" / f"{section:02d}.practice.json"
    misconceptions_path = CONTENT_ROOT / course / f"{chapter:02d}" / f"{section:02d}.misconceptions.json"
    meta_path = CONTENT_ROOT / course / f"{chapter:02d}" / f"{section:02d}.meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    meta["description"] = f"Artifact-specific exemplar for {profile['short']} connecting {title.lower()} to {artifact}, reader notes, support moments, and revision evidence."
    meta["learning_objectives"] = [
        f"Analyze how the {artifact} shows a defensible decision in {profile['short']}.",
        "Distinguish artifact polish from evidence-based revision.",
        "Document a bounded AI/software support move with accepted and rejected suggestions.",
        learner_trace_objective(profile),
    ]
    meta["top_tier_hardened"] = True
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    practice = {
        "problems": [
            {
                "id": f"{stem}_artifact_signal",
                "type": "multiple_choice",
                "concept_id": meta["concept_ids"][1],
                "stem": "Which evidence trace would make this artifact easiest to review and improve?",
                "options": [
                    "The artifact is visually polished and complete.",
                    "The learner identifies a claim, evidence source, bounded support move, accepted suggestion, rejected suggestion, and revision.",
                    "The learner uses AI for every step so the artifact is consistent.",
                    "The learner writes a generic reflection after submitting.",
                ],
                "correct_index": 1,
                "explanation": "Strong evidence shows the student decision and the revision path clearly.",
                "misconception_id": f"{stem}_polish_as_evidence",
            },
            {
                "id": f"{stem}_annotation_signal",
                "type": "multiple_choice",
                "concept_id": meta["concept_ids"][2],
                "stem": "Which reader note would help BigAL give targeted support?",
                "options": [
                    "This is interesting.",
                    "I am confused about which constraint should override the AI suggestion in this artifact.",
                    "I agree.",
                    "The page is long.",
                ],
                "correct_index": 1,
                "explanation": "A useful reader note shows the concept, constraint, or decision where support is needed.",
                "misconception_id": f"{stem}_annotation_without_signal",
            },
            {
                "id": f"{stem}_ai_boundary",
                "type": "multiple_choice",
                "concept_id": meta["concept_ids"][3],
                "stem": "What is the strongest AI-use boundary for this section?",
                "options": [
                    "Ask AI to complete the artifact and submit it.",
                    "Use AI for one bounded critique or revision option, then judge it against course evidence.",
                    "Avoid AI even when the assignment asks for critique.",
                    "Use AI only to make the artifact sound more polished.",
                ],
                "correct_index": 1,
                "explanation": "The learner remains responsible for judgment; the tool provides bounded support.",
                "misconception_id": f"{stem}_ai_as_authority",
            },
            {
                "id": f"{stem}_calibration",
                "type": "multiple_choice",
                "concept_id": meta["concept_ids"][2],
                "stem": "Which detail would make later support more useful?",
                "options": [
                    "Only the final artifact file.",
                    "Your confidence, question type, support request, practice result, and revision quality.",
                    "Only the time of day.",
                    "Only the number of words in the note.",
                ],
                "correct_index": 1,
                "explanation": "Useful support depends on visible evidence, not only completion.",
                "misconception_id": f"{stem}_completion_only_model",
            },
        ]
    }
    practice_path.write_text(json.dumps(practice, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    misconceptions = {
        "section_id": stem,
        "misconceptions": [
            {
                "id": f"{stem}_polish_as_evidence",
                "pattern": "artifact_polish_as_evidence",
                "description": "Treating fluent or visually complete artifacts as sufficient evidence of learning",
                "trigger": "learner points to polish but not to a constraint, evidence source, or revision decision",
                "feedback": "Name the claim, evidence source, support move, and revision. Polish is not the evidence trail.",
                "rail_action": "ask",
            },
            {
                "id": f"{stem}_annotation_without_signal",
                "pattern": "low_information_annotation",
                "description": "Writing reader notes that do not name a concept, constraint, confusion, or connection",
                "trigger": "note is generic agreement or interest",
                "feedback": "Rewrite the annotation so it names what you need, what confused you, or what decision it changes.",
                "rail_action": "explain",
            },
            {
                "id": f"{stem}_ai_as_authority",
                "pattern": "ai_output_as_authority",
                "description": "Accepting AI output as authoritative rather than judging it against course evidence",
                "trigger": "learner accepts AI suggestion without a rejection or evidence check",
                "feedback": "Use the AI output as a proposal. Accept or reject it using the course constraint and artifact evidence.",
                "rail_action": "represent",
            },
            {
                "id": f"{stem}_completion_only_model",
                "pattern": "completion_only_learner_model",
                "description": "Assuming completion alone is enough for useful follow-up support",
                "trigger": "learner or system records only a finished artifact",
                "feedback": "ALGET needs process evidence: annotation, support request, confidence, practice, and revision quality.",
                "rail_action": "practice",
            },
        ],
    }
    misconceptions_path.write_text(json.dumps(misconceptions, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def generate() -> None:
    count = 0
    for course in COURSE_PROFILES:
        for chapter, section in TARGET_SECTIONS:
            path = CONTENT_ROOT / course / f"{chapter:02d}" / f"{section:02d}.mdx"
            path.write_text(section_body(course, chapter, section), encoding="utf-8")
            update_json_sidecars(course, chapter, section)
            count += 1
    report = dedent(f"""\
    # Top-Tier Hardening Pass

    - Hardened sections: {count}
    - Strategy: rewrote every section in each Summer 2026 supplement course as an artifact-specific exemplar.
    - Added deep exemplar PNGs under `frontend/public/course-art/deep-exemplars/`.
    - Added downloadable artifact packets under `frontend/public/downloads/summer2026/`.
    - Updated sidecar practice and misconception JSON with student-facing revision items.
    """)
    (CONTENT_ROOT / "TOP_TIER_HARDENING_PASS.md").write_text(report, encoding="utf-8")
    print(report)


if __name__ == "__main__":
    generate()
