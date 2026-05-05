from __future__ import annotations

import json
import re
from pathlib import Path
from textwrap import dedent


ROOT = Path(__file__).resolve().parents[1]
CONTENT_ROOT = ROOT / "frontend" / "content"
PUBLIC_ROOT = ROOT / "frontend" / "public"
DOWNLOAD_ROOT = PUBLIC_ROOT / "downloads" / "summer2026"
MEASURE_PATH = ROOT / "research" / "measures" / "pre_post_item_bank.json"


COURSES = {
    "ail606-supplement": {
        "short": "AIL 606",
        "field": "graduate multimedia learning design",
        "signature_tools": ["storyboard evidence studio", "prototype traceability matrix"],
        "anchors": [
            ("Mayer multimedia learning", "https://doi.org/10.1017/CBO9781139164603"),
            ("cognitive load theory", "https://doi.org/10.1016/j.learninstruc.2009.12.009"),
            ("UDL learner variability", "https://udlguidelines.cast.org/"),
            ("usability heuristics", "https://www.nngroup.com/articles/ten-usability-heuristics/"),
        ],
        "artifact_rules": [
            ("storyboard", "storyboard frame sequence with narration, signaling, and learner-action notes"),
            ("cognitive", "cognitive load diagnosis table with intrinsic/extraneous/germane load evidence"),
            ("usability", "moderated usability test script with observation-to-revision trace"),
            ("prototype", "prototype README traceability matrix connecting theory to screen changes"),
            ("capstone", "capstone defense evidence board with limitations and transfer claims"),
            ("ai", "AI-USE disclosure excerpt tied to one bounded design-support decision"),
        ],
    },
    "cat531-supplement": {
        "short": "CAT 531",
        "field": "teacher technology judgment and AI ethics",
        "signature_tools": ["Design Tension Studio map", "Ethobot/TeachGen transcript critique"],
        "anchors": [
            ("TPACK", "https://doi.org/10.1111/j.1467-9620.2006.00684.x"),
            ("critical edtech studies", "https://doi.org/10.4324/9781315670160"),
            ("AI and education datafication", "https://doi.org/10.1080/17439884.2020.1686017"),
            ("teacher professional judgment", "https://doi.org/10.1177/002205741319300304"),
        ],
        "artifact_rules": [
            ("tension", "Design Tension Studio map naming a classroom value conflict and negotiated decision"),
            ("policy", "school AI policy memo with privacy, equity, consent, and learning-purpose checks"),
            ("ethobot", "Ethobot transcript annotation showing where ethical reasoning changed"),
            ("teachgen", "TeachGen@i prompt transcript with teacher edits and rejected suggestions"),
            ("equity", "equity-oriented edtech evaluation matrix with context-specific risk notes"),
            ("field", "field-placement transfer note connecting tool choice to classroom constraints"),
        ],
    },
    "cat100-supplement": {
        "short": "CAT 100",
        "field": "undergraduate digital fluency and AI-assisted productivity",
        "signature_tools": ["resume evidence checker", "spreadsheet data-story studio"],
        "anchors": [
            ("NACE career readiness", "https://www.naceweb.org/career-readiness/competencies/career-readiness-defined"),
            ("ISTE digital citizenship", "https://iste.org/standards/students"),
            ("data-ink and visual evidence", "https://www.edwardtufte.com/tufte/books_vdqi"),
            ("WCAG accessibility", "https://www.w3.org/TR/WCAG22/"),
        ],
        "artifact_rules": [
            ("resume", "resume before-after revision with truthful evidence, role fit, and AI-use note"),
            ("excel", "Excel pivot-table finding with unit labels, source note, and claim-first chart title"),
            ("presentation", "presentation storyboard with audience constraint and slide-level evidence"),
            ("github", "GitHub Pages file tree with accessibility, privacy, and publishing checks"),
            ("privacy", "privacy checklist for accounts, data sharing, and AI tool boundaries"),
            ("ai", "AI critique log showing accepted, modified, and rejected suggestions"),
        ],
    },
}


SECTION_MOVES = [
    {
        "heading": "Interface Move",
        "frame": "This section should behave like a small studio, not a page of notes. The learner reads a compact explanation, inspects an artifact, makes one visible revision, and receives support that is justified by the trace they produced.",
        "quiz": "Which interface behavior would make this section more intelligent than a static textbook page?",
        "correct": "It asks for a visible artifact decision, records the evidence source, and adapts the next support move.",
    },
    {
        "heading": "Adaptive Move",
        "frame": "The intelligent step is the connection between evidence and support. A learner who flags confusion should not receive the same prompt as a learner who posts a strong critique or a completed revision trace.",
        "quiz": "Which adaptive signal should change the next support action?",
        "correct": "The combination of annotation type, artifact evidence, confidence, and revision quality.",
    },
    {
        "heading": "Research Move",
        "frame": "For a publishable intelligent textbook claim, the interface must leave analyzable traces. The section therefore asks for a claim, evidence source, bounded support move, accepted suggestion, rejected suggestion, and final revision note.",
        "quiz": "Which trace is most useful for publication-quality analysis?",
        "correct": "A before-after artifact record linked to a learner decision and evidence source.",
    },
    {
        "heading": "Transfer Move",
        "frame": "The section is designed so the learner can move the same judgment pattern to a new tool, audience, or classroom setting. Transfer is visible only when the learner names the constraint that changes across contexts.",
        "quiz": "What best shows transfer rather than completion?",
        "correct": "The learner explains how the same decision rule changes under a new audience or constraint.",
    },
]


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def load_meta(course: str, chapter: int, section: int) -> dict:
    return json.loads((CONTENT_ROOT / course / f"{chapter:02d}" / f"{section:02d}.meta.json").read_text(encoding="utf-8"))


def select_artifact(profile: dict, title: str, chapter: int, section: int) -> str:
    lower = title.lower()
    for key, artifact in profile["artifact_rules"]:
        if key in lower:
            return artifact
    return profile["artifact_rules"][(chapter + section - 2) % len(profile["artifact_rules"])][1]


def packet_path(course: str, chapter: int, section: int, title: str) -> Path:
    out_dir = DOWNLOAD_ROOT / course
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir / f"{chapter:02d}-{section:02d}-{slugify(title)[:42]}-artifact.md"


def write_packet(course: str, chapter: int, section: int, title: str, module_title: str, artifact: str, profile: dict) -> str:
    path = packet_path(course, chapter, section, title)
    anchor_names = [anchor for anchor, _ in profile["anchors"]]
    packet = dedent(f"""\
    # {profile['short']} Artifact Studio Packet: {title}

    ## Purpose
    This packet turns **{title}** into a concrete artifact studio task. The goal is not to make a polished submission on the first pass. The goal is to make the learner's judgment visible enough that ALGET can adapt support, an instructor can review the decision, and a researcher can code the trace.

    ## Artifact
    **{artifact}**

    ## Course Context
    Module: **{module_title}**  
    Course focus: **{profile['field']}**

    ## Required Submission
    Submit one artifact file or screenshot plus a revision trace. The trace must contain:

    1. **Initial claim:** What the artifact is supposed to help the audience do.
    2. **Constraint:** Which course idea limits or shapes the decision. Use at least one of: {", ".join(anchor_names)}.
    3. **Evidence source:** Identify the exact rubric line, peer annotation, transcript segment, data check, usability observation, accessibility check, or policy clause that influenced the revision.
    4. **AI/software support move:** Name the tool and the bounded request. The request should ask for critique, alternatives, simplification, debugging, or comparison, not full artifact authorship.
    5. **Accepted suggestion:** State what changed and why it improved the artifact.
    6. **Rejected or modified suggestion:** State what you did not accept and why.
    7. **Final limitation:** Name one remaining uncertainty or condition where the artifact may fail.

    ## Worked Mini-Example
    Weak trace: "I used AI and made it clearer."

    Strong trace: "I asked for three alternatives for the {artifact}. I accepted the alternative that made the audience constraint explicit, rejected the alternative that removed the evidence source, and revised the artifact so the reader can see how {anchor_names[0]} shaped the final decision. The remaining limitation is that the trace has not yet been tested with a second reader."

    ## Instructor Rubric
    Score each row 0, 1, or 2.

    | Criterion | 0 | 1 | 2 |
    |---|---|---|---|
    | Claim visibility | No claim | Generic claim | Audience-specific claim |
    | Evidence specificity | Opinion only | Evidence named | Evidence linked to revision |
    | AI/software boundary | Tool authors whole artifact | Tool use partially bounded | Tool use is narrow and auditable |
    | Revision quality | Cosmetic change | Some conceptual change | Decision visibly improves artifact |
    | Rejection rationale | None | Vague | Explains why a suggestion was rejected or modified |
    | Transfer note | None | Mentions transfer | Names changed constraint in a new context |

    ## ALGET Logging Targets
    - `artifact_claim_visible`
    - `evidence_source_type`
    - `support_action_requested`
    - `accepted_suggestion_reason`
    - `rejected_suggestion_reason`
    - `revision_quality_score`
    - `confidence_before_revision`
    - `confidence_after_revision`

    ## Research Use
    This packet supports item-level and artifact-level analysis because the learner's decision is separable from the surface quality of the artifact. In the dataset, the strongest evidence is not the final artifact alone; it is the relationship among claim, constraint, evidence, support, and revision.
    """)
    path.write_text(packet, encoding="utf-8")
    return f"/downloads/summer2026/{course}/{path.name}"


def option_json(correct_text: str, variant: int) -> str:
    distractors = [
        "The section gives a longer explanation and a more polished visual.",
        "The AI tool generates the artifact without requiring learner revision.",
        "The learner completes the page and receives a generic score.",
    ]
    options = distractors[:]
    index = variant % 4
    options.insert(index, correct_text)
    return json.dumps(options), index


def html_attr(value: str) -> str:
    return value.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")


def write_section(course: str, chapter: int, section: int) -> None:
    profile = COURSES[course]
    meta = load_meta(course, chapter, section)
    title = meta["title"]
    module_title = meta["chapter_title"]
    artifact = select_artifact(profile, title, chapter, section)
    move = SECTION_MOVES[(chapter * 3 + section) % len(SECTION_MOVES)]
    download = write_packet(course, chapter, section, title, module_title, artifact, profile)
    image = f"/course-art/deep-exemplars/{course}/{chapter:02d}-{section:02d}-{slugify(title)[:42]}.png"
    refs = "\n".join(f"- {name}. {url}" for name, url in profile["anchors"])
    anchor_names = [anchor for anchor, _ in profile["anchors"]]
    options, correct_index = option_json(move["correct"], chapter + section)
    concept_id = f"{course.replace('-', '_')}_{slugify(title).replace('-', '_')}"

    body = dedent(f"""\
    # {title}

    ![{title} artifact studio visual]({image})

    ## {move['heading']}

    **{profile['short']} context.** {title} belongs to **{module_title}**, where learners work on {profile['field']}. The section uses a concrete artifact instead of a generic reflection prompt: **{artifact}**.

    {move['frame']}

    The learner's first task is to decide what the artifact claims. The claim must name an audience, a constraint, and a reason the artifact matters. For this section, the relevant constraints come from **{anchor_names[0]}**, **{anchor_names[1]}**, and **{anchor_names[2]}**. A polished artifact that does not expose those constraints is not yet high-quality intelligent textbook evidence.

    ## Artifact Studio

    Open the studio packet: [download the {artifact} packet]({download}).

    <artifact-studio artifact="{html_attr(artifact)}" course="{profile['short']}" section="{chapter:02d}.{section:02d}" />

    The packet asks for a before/after artifact and a seven-part trace. This is the core quality upgrade. It gives ALGET something to adapt from: not just whether the learner clicked through the reading, but what evidence they used, what support they requested, what they accepted, what they rejected, and where they still lack confidence.

    A strong submission includes one visible decision that another person can audit. For example, the learner might revise a label, prompt, chart title, policy statement, transcript annotation, storyboard frame, or README entry. The revision is strong only if the evidence source is specific enough to explain why the change happened.

    ## Intelligent Textbook Comparison

    Existing intelligent textbooks already offer adaptive pathways, embedded checks, or social annotation. This section must therefore do something more specific: it must connect a course artifact to adaptive support. Compared with a static textbook, the page asks for action. Compared with a generic quiz engine, it keeps the artifact trace. Compared with a social annotation tool, it can use the annotation type and quote location to select the next support action.

    ## Adaptive Support Rule

    ALGET should use the following decision rule for this section:

    - If the annotation is a **question**, offer a focused explanation tied to **{anchor_names[0]}**.
    - If the annotation is **confusion**, offer a worked contrast between a weak and strong {artifact}.
    - If the annotation is an **insight**, ask the learner to transfer the decision to a new audience.
    - If the annotation is a **connection**, ask for evidence that the connection changed the artifact.

    ## Before and After

    **Weak before trace:** "I improved the {artifact} and made it clearer."

    **Stronger after trace:** "I revised the {artifact} after checking {anchor_names[1]}. I accepted a support suggestion that clarified the audience constraint, rejected a suggestion that removed the evidence source, and left a limitation note about where the artifact still needs review."

    <dynamic-scenario prompt="A learner submits a {artifact} for {profile['short']} {chapter:02d}.{section:02d}. The annotation thread shows a {move['heading'].lower()} issue connected to {anchor_names[1]}. Recommend the first adaptive support action and the evidence that would show whether it worked." />

    ## Research Trace

    This section should persist the following research signals:

    - artifact claim
    - evidence source type
    - annotation type and quote hash
    - requested support action
    - accepted suggestion
    - rejected or modified suggestion
    - confidence before and after revision
    - instructor artifact-quality score

    <interactive-quiz question="{move['quiz']}" options='{options}' correct-index="{correct_index}" conceptid="{concept_id}" />

    ## References

    {refs}
    """)
    (CONTENT_ROOT / course / f"{chapter:02d}" / f"{section:02d}.mdx").write_text(body, encoding="utf-8")


def build_item(course: str, idx: int, construct: str, correct_index: int) -> dict:
    profile = COURSES[course]
    short = profile["short"].lower().replace(" ", "")
    correct_answers = [
        "It links a learner decision to a named evidence source and a visible revision.",
        "It separates the total treatment effect from post-treatment mechanism variables.",
        "It records item-level responses, confidence, latency, and misconception labels.",
        "It uses annotation type and quote location to select a bounded support action.",
    ]
    distractors = [
        "It makes the final artifact look more polished without explaining the decision.",
        "It lets the AI system complete the whole artifact for the learner.",
        "It reports only a final percentage score with no item-level trace.",
        "It gives every learner the same next page regardless of annotation evidence.",
    ]
    correct = correct_answers[idx % len(correct_answers)]
    options = distractors[:3]
    options.insert(correct_index, correct)
    return {
        "id": f"{short}_novelty_{idx:02d}",
        "course_id": course,
        "concept_id": f"{course.replace('-', '_')}_intelligent_textbook_quality_{idx:02d}",
        "construct": construct,
        "form": "pre_post_retention_parallel",
        "difficulty": ["low", "medium", "high"][idx % 3],
        "stem": f"In {profile['short']}, which response best supports a defensible intelligent-textbook quality claim for {construct}?",
        "options": options,
        "correct_index": correct_index,
        "rationale": correct,
        "distractor_rationales": {
            str(i): "Distractor targets surface polish, automation, summary-only scoring, or non-adaptive sequencing."
            for i in range(4)
            if i != correct_index
        },
    }


def write_item_bank() -> None:
    constructs = [
        "artifact-centered learning",
        "annotation-informed adaptivity",
        "research trace reproducibility",
        "learner-model calibration",
        "ethical AI support",
        "transfer and retention",
        "instructor evidence review",
        "interface novelty",
        "measurement validity",
        "social learning quality",
        "accessibility and inclusion",
        "course-specific artifact judgment",
    ]
    items = []
    for course in COURSES:
        for idx, construct in enumerate(constructs, start=1):
            items.append(build_item(course, idx, construct, idx % 4))
    MEASURE_PATH.write_text(json.dumps({
        "instrument": "ALGET Summer 2026 Pre/Post/Retention Item Bank",
        "version": "2026-05-05-quality-upgrade",
        "description": "Thirty-six course-balanced items with varied answer positions, rationales, difficulty tags, and parallel-form metadata.",
        "items": items,
    }, indent=2), encoding="utf-8")


def main() -> None:
    for course in COURSES:
        for chapter in range(1, 9):
            for section in range(1, 9):
                write_section(course, chapter, section)
    write_item_bank()
    print("Upgraded 192 sections, 192 artifact packets, and 36 measurement items.")


if __name__ == "__main__":
    main()
