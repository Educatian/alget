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
    artifact_phrase = clean_phrase(artifact)
    packet = dedent(f"""\
    # {profile['short']} Artifact Studio Packet: {title}

    ## Purpose
    This packet turns **{title}** into a concrete artifact studio task. The goal is not to make a polished submission on the first pass. The goal is to make the learner's judgment visible enough that ALGET can adapt support, an instructor can review the decision, and a researcher can code the trace.

    ## Artifact
    **{artifact_phrase}**

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

    Strong trace: "I asked for three alternatives for the {artifact_phrase}. I accepted the alternative that made the audience constraint explicit, rejected the alternative that removed the evidence source, and revised the artifact so the reader can see how {anchor_names[0]} shaped the final decision. The remaining limitation is that the trace has not yet been tested with a second reader."

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


def sentence_join(items: list[str]) -> str:
    cleaned = [str(item).strip().rstrip(".") for item in items if str(item).strip()]
    if not cleaned:
        return ""
    if len(cleaned) == 1:
        return cleaned[0]
    if len(cleaned) == 2:
        return f"{cleaned[0]} and {cleaned[1]}"
    return f"{', '.join(cleaned[:-1])}, and {cleaned[-1]}"


def clean_phrase(value: str) -> str:
    cleaned = re.sub(r"\ba ([AEIOUaeiou])", r"an \1", value)
    cleaned = re.sub(r"\bA ([AEIOUaeiou])", r"An \1", cleaned)
    return cleaned


def section_context_sentence(profile: dict, title: str, module_title: str, artifact: str) -> str:
    short = profile["short"]
    if short == "AIL 606":
        return (
            f"This module treats {title} as a design problem: the learner must connect theory, media choices, "
            f"and prototype evidence before deciding whether the {artifact} is ready for revision."
        )
    if short == "CAT 531":
        return (
            f"This module treats {title} as a professional judgment problem: the learner must connect pedagogy, "
            f"classroom constraints, and ethics before defending the {artifact}."
        )
    return (
        f"This module treats {title} as a practical digital fluency problem: the learner must connect audience, "
        f"evidence, and tool use before publishing or submitting the {artifact}."
    )


def learner_role(profile: dict) -> str:
    short = profile["short"]
    if short == "AIL 606":
        return "a learning designer"
    if short == "CAT 531":
        return "a teacher making a defensible technology decision"
    return "a student building practical digital evidence"


def course_example(profile: dict, title: str, artifact: str, anchors: list[str]) -> str:
    short = profile["short"]
    if short == "AIL 606":
        return (
            f"Imagine a designer reviewing a prototype screen for {title}. The screen may look clean, "
            f"but the design decision is not yet defensible until the designer can explain which learner action "
            f"the screen supports, which source of cognitive demand it reduces, and how the {artifact} records that reasoning."
        )
    if short == "CAT 531":
        return (
            f"Imagine a teacher choosing whether to use a classroom technology for {title}. The important question is "
            f"not whether the tool is exciting; it is whether the teacher can name the instructional purpose, the equity "
            f"risk, the student-data boundary, and the evidence that makes the {artifact} a professional judgment rather than a preference."
        )
    return (
        f"Imagine a student preparing a digital artifact for {title}. The artifact should be useful outside this course: "
        f"a resume line, spreadsheet claim, presentation slide, AI critique, or website element that another reader can verify. "
        f"The {artifact} is the place where that verification becomes visible."
    )


def decision_rule(profile: dict, artifact: str, anchors: list[str]) -> str:
    short = profile["short"]
    if short == "AIL 606":
        return (
            f"Use the learning goal first, the media choice second, and the software feature last. "
            f"A feature is justified only when it reduces unnecessary processing, strengthens useful processing, or makes learner action easier to observe."
        )
    if short == "CAT 531":
        return (
            f"Use the classroom value conflict first, the technology affordance second, and the policy boundary third. "
            f"A tool choice is justified only when it protects students while improving a specific learning activity."
        )
    return (
        f"Use the audience first, the evidence second, and the tool third. "
        f"A digital product is justified only when another person can see what changed, why it changed, and what evidence supports the change."
    )


def write_section(course: str, chapter: int, section: int) -> None:
    profile = COURSES[course]
    meta = load_meta(course, chapter, section)
    title = meta["title"]
    module_title = meta["chapter_title"]
    learning_objectives = meta.get("learning_objectives") or []
    artifact = select_artifact(profile, title, chapter, section)
    move = SECTION_MOVES[(chapter * 3 + section) % len(SECTION_MOVES)]
    download = write_packet(course, chapter, section, title, module_title, artifact, profile)
    image = f"/course-art/deep-exemplars/{course}/{chapter:02d}-{section:02d}-{slugify(title)[:42]}.png"
    refs = "\n".join(f"- {name}. {url}" for name, url in profile["anchors"])
    anchor_names = [anchor for anchor, _ in profile["anchors"]]
    options, correct_index = option_json(move["correct"], chapter + section)
    concept_ids = meta.get("concept_ids") or []
    concept_id = concept_ids[1] if len(concept_ids) > 1 else concept_ids[0] if concept_ids else f"{course.replace('-', '_')}_{slugify(title).replace('-', '_')}"
    objectives_block = "\n".join(f"- {clean_phrase(objective)}" for objective in learning_objectives[:4])
    if not objectives_block:
        objectives_block = f"- Explain how {title} changes the learner's artifact decision."
    objective_sentence = clean_phrase(sentence_join(learning_objectives[:2]) or f"explain and apply {title.lower()}")
    role = learner_role(profile)
    artifact_phrase = clean_phrase(artifact)
    example = course_example(profile, title, artifact_phrase, anchor_names)
    rule = decision_rule(profile, artifact_phrase, anchor_names)
    context_sentence = section_context_sentence(profile, title, module_title, artifact_phrase)
    prompt_move = clean_phrase(move["heading"].lower())

    body = dedent(f"""\
# {title}

![{title} textbook visual]({image})

## Why This Section Matters

{title} sits inside **{module_title}**. In this part of {profile['short']}, you are learning to work as {role}: someone who can read a messy situation, identify the constraint that matters, and make a justified artifact decision. {context_sentence}

The section is not asking you to memorize a definition and move on. It is asking you to connect an idea to a decision that can be inspected. By the end of the page, you should be able to {objective_sentence}. The visible evidence for that learning is a **{artifact_phrase}**.

## Learning Targets

{objectives_block}

## Opening Case

{example}

This is the difference between a completed activity and a textbook-quality learning trace. A completed activity tells the instructor that something was submitted. A learning trace shows the reasoning that produced the submission. In an intelligent textbook, that distinction matters because the system can only adapt well when the learner's decision is visible.

## Core Concept

The core idea in this section is that **{title}** should be treated as a relationship among purpose, constraint, evidence, and revision. Purpose names what the learner or audience needs to accomplish. Constraint names what limits the decision. Evidence names the source that makes the decision defensible. Revision shows what changed after the evidence was considered.

Three course anchors shape the reasoning here:

- **{anchor_names[0]}** helps you decide what counts as a meaningful learning or performance demand.
- **{anchor_names[1]}** helps you notice when a design or technology choice creates risk, burden, or unsupported assumptions.
- **{anchor_names[2]}** helps you check whether the artifact works for varied learners, audiences, or use contexts.

Do not treat these anchors as citations to paste into a reflection. Treat them as lenses. A lens is useful only if it changes what you notice and what you revise.

## Worked Example

Start with a weak artifact claim:

> I made the {artifact_phrase} clearer.

That claim is too thin because "clearer" does not identify the audience, the problem, or the evidence. A stronger claim would read:

> I revised the {artifact_phrase} so that the intended audience can see the decision, the constraint, and the evidence source. The revision is justified by **{anchor_names[1]}**, and I can point to the exact part of the artifact that changed.

The improved version does three things. First, it names the artifact as a tool for communication, not just a finished product. Second, it identifies the course idea that shaped the revision. Third, it leaves a trail that another person can audit.

## Decision Rule

{rule}

Use this three-step check before you submit:

1. **Purpose check:** What should the audience be able to do after reading or using the artifact?
2. **Evidence check:** Which exact source, observation, annotation, rubric line, data pattern, or policy boundary justifies the revision?
3. **Revision check:** What changed in the artifact, and what suggestion did you reject or modify?

If you cannot answer all three questions, the artifact may be complete, but it is not yet ready as evidence of learning.

## Common Misreadings

One common mistake is to equate polish with quality. A polished artifact can still hide weak reasoning. Another mistake is to let AI or software produce the artifact without making the learner's judgment visible. A third mistake is to write a reflection after the fact that describes the final product but not the decision process.

In this course, quality means that the decision can be traced. The artifact should make it possible to see what you believed at first, what evidence challenged or refined that belief, what support you requested, what you accepted, what you rejected, and what limitation remains.

## Artifact Studio

Open the studio packet: [download the {artifact_phrase} packet]({download}).

<artifact-studio artifact="{html_attr(artifact_phrase)}" course="{profile['short']}" section="{chapter:02d}.{section:02d}" />

Use the studio to create a before/after trace. The first version should show your starting interpretation. The revised version should show one meaningful change. The trace should explain why the change happened and why at least one possible suggestion was not accepted.

## Adaptive Support

ALGET uses your annotations and artifact trace to choose support:

- If your annotation is a **question**, ask for a concise explanation tied to **{anchor_names[0]}**.
- If your annotation is **confusion**, compare a weak and strong version of the {artifact_phrase}.
- If your annotation is an **insight**, transfer the same decision rule to a new audience or setting.
- If your annotation is a **connection**, show where the connection changes the artifact.

<dynamic-scenario prompt="A learner submits the {artifact_phrase} for {profile['short']} {chapter:02d}.{section:02d}. The annotation thread shows {prompt_move} issue connected to {anchor_names[1]}. Recommend the first adaptive support action and the evidence that would show whether it worked." />

## Check Your Understanding

Before moving on, answer the embedded check. The point is not whether you remember the heading; it is whether you can distinguish surface completion from an auditable learning decision.

<interactive-quiz question="{move['quiz']}" options='{options}' correct-index="{correct_index}" conceptid="{concept_id}" />

## Research Trace

This section contributes to the learner model only when the trace includes the artifact claim, evidence source, annotation type, requested support action, accepted suggestion, rejected or modified suggestion, confidence before and after revision, and instructor artifact-quality score. Those signals help separate genuine learning progress from simple page completion.

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
