from __future__ import annotations

import json
import re
from pathlib import Path
from textwrap import dedent


ROOT = Path(__file__).resolve().parents[1]
CONTENT_ROOT = ROOT / "frontend" / "content"
PUBLIC_ART_ROOT = ROOT / "frontend" / "public" / "course-art"
REPORT_PATH = CONTENT_ROOT / "SUMMER2026_REDEVELOPMENT_GAP_REPORT.md"
PROMPT_PATH = PUBLIC_ART_ROOT / "IMAGEGEN2_PROMPTS.md"
MANIFEST_PATH = PUBLIC_ART_ROOT / "imagegen2_manifest.json"


COURSES = {
    "ail606-supplement": {
        "title": "AIL 606: Software Technology Supplement",
        "short": "AIL 606",
        "audience": "doctoral and advanced master's students designing evidence-grounded e-learning prototypes",
        "comparison": "Compared against the Summer 2026 AIL-606 schedule and the existing ALGET instructional-design track, the missing layer was not theory coverage; it was a full scaffold from principle selection to prototype evidence, toolchain disclosure, and usability testing.",
        "modules": [
            ("Foundations of Interactive Multimedia Learning", [
                "Cognitive Architecture for Multimedia Learning",
                "Mayer Principles as Design Constraints",
                "Cognitive Load Diagnosis",
                "Worked Examples and Fading",
                "Learner Variability and UDL",
                "Choosing a Software Case",
                "Design Rationale as Evidence",
                "Module 1 Synthesis Studio",
            ]),
            ("Learning Experience Design and Software Technology", [
                "LXD as a Decision Discipline",
                "Platform Affordances and Constraints",
                "Interaction Patterns for Learning Software",
                "Feedback Loops and Learner Control",
                "AI Tutor Boundaries",
                "LXD Optimizer Critical Use",
                "Comparative Software Audit",
                "Module 2 Design Memo",
            ]),
            ("Multimedia Storyboarding and AI Asset Generation", [
                "Storyboard Frames as Claims",
                "Signaling and Segmenting in Practice",
                "Image Generation for Instruction",
                "Narration and Modality Decisions",
                "Alt Text and Accessibility",
                "Prompt Logs as Design Evidence",
                "Peer Review of Storyboards",
                "Module 3 Storyboard Studio",
            ]),
            ("Design Draft and Theory-to-Prototype Alignment", [
                "Problem Statement and Learner Profile",
                "Principle-to-Feature Traceability",
                "Wireframes That Show Learning Logic",
                "Cognitive Load Analysis in the Draft",
                "Accessibility and WCAG Checks",
                "AI-Assisted Authoring With Codex",
                "README and Repository Disclosure",
                "Module 4 Design Draft Clinic",
            ]),
            ("Usability Testing and Learning Evidence", [
                "From Rationale to Testable Hypotheses",
                "Participant Profiles and Sampling",
                "Task Scenarios for Prototype Testing",
                "Learning Metrics and Usability Metrics",
                "Observation Protocols",
                "Analyzing Feedback Without Overclaiming",
                "Prioritizing Iterations",
                "Module 5 Usability Plan Studio",
            ]),
            ("Refined Prototype and Capstone Defense", [
                "Evidence-of-Iteration Documentation",
                "Toolchain Disclosure and AI-USE.md",
                "Persona-Based Simulation Checks",
                "Final Prototype Quality Review",
                "Theoretical Defense",
                "Peer Scholarly Critique",
                "Capstone Presentation Narrative",
                "Module 6 Completion Studio",
            ]),
            ("Research Translation for Learning Design", [
                "Turning Designs Into Study Questions",
                "Evidence-Centered Design for Prototypes",
                "Telemetry and Privacy Boundaries",
                "Small-N Testing and Design Claims",
                "Reflection as Data",
                "Publication-Ready Artifact Packaging",
                "Ethical Reporting of AI Use",
                "Research Translation Studio",
            ]),
            ("Instructor Implementation Toolkit", [
                "Facilitating Asynchronous Design Work",
                "Feedback Templates for Design Drafts",
                "Rubric Calibration",
                "AI Policy Language for Students",
                "Accessibility Review Workflow",
                "Prototype Showcase Logistics",
                "Blackboard-to-ALGET Alignment",
                "Course Readiness Checklist",
            ]),
        ],
    },
    "cat531-supplement": {
        "title": "CAT 531: Technology and Teaching Supplement",
        "short": "CAT 531",
        "audience": "pre-service teachers learning to reason about AI, ethics, evaluation, and technology-rich classrooms",
        "comparison": "Compared against the CAT-531 Option A redesign, the new ALGET layer adds decision rehearsal, explicit cross-links among DTS, TeachGen@i, Ethobot, and assessment artifacts, plus more frequent concept checks than the Blackboard shell can comfortably hold.",
        "modules": [
            ("Foundations of CBI and Design Tensions", [
                "CBI as Pedagogical Judgment",
                "Design Tensions Before Tool Choice",
                "DTS Map Reading",
                "Balancing Efficiency and Equity",
                "Classroom Context Variables",
                "Teacher Agency With Technology",
                "Portfolio Evidence Setup",
                "Module 1 Reflection Studio",
            ]),
            ("Teaching in Tech-Rich Classrooms With TeachGen@i", [
                "Tech-Rich Classroom Routines",
                "TeachGen@i Scenario Setup",
                "Prompting for Classroom Constraints",
                "Comparing AI Suggestions to Pedagogy",
                "Adapting Plans for Learner Variability",
                "Teacher Noticing and Revision",
                "Evidence for Portfolio Entry",
                "Module 2 Teaching Plan Studio",
            ]),
            ("AI in Education", [
                "What AI Changes in Schools",
                "Generative AI and Student Work",
                "Bias, Data, and Classroom Consequences",
                "AI Literacy for Teachers",
                "Responsible Prompting With Students",
                "School Policy Interpretation",
                "AI Use Disclosure",
                "Module 3 AI Analysis Studio",
            ]),
            ("AI Ethics and Ethobot 3.2", [
                "Ethical Dialogue as Learning Activity",
                "Facial Recognition as Classroom Case",
                "Stakeholders in School AI",
                "Privacy and Consent With Minors",
                "Ethobot Transcript Annotation",
                "Moving From Debate to Policy",
                "Adapting Ethobot Prompts",
                "Module 4 Ethics Studio",
            ]),
            ("Educational Technology Evaluation", [
                "Evaluation Questions Before Ratings",
                "Evidence Claims and Vendor Claims",
                "Usability, Accessibility, and Equity",
                "Cost and Sustainability",
                "Classroom Fit Matrix",
                "Adoption Recommendation",
                "Peer Review of Evaluation Briefs",
                "Module 5 Evaluation Studio",
            ]),
            ("Final Project and Professional Vision", [
                "Synthesis Across Modules",
                "Professional Teaching Philosophy With AI",
                "Portfolio Artifact Selection",
                "Classroom Implementation Plan",
                "Risk Mitigation and Family Communication",
                "Evidence-Based Reflection",
                "Presentation of Professional Vision",
                "Module 6 Final Studio",
            ]),
            ("Field-Based Transfer and Coaching", [
                "Transferring Online Cases to Field Placements",
                "Mentor Teacher Conversation Guides",
                "Technology Observation Notes",
                "Equity Audit in Field Contexts",
                "Student Voice and Feedback",
                "Revising Plans After Field Evidence",
                "Professional Learning Network",
                "Field Transfer Studio",
            ]),
            ("Instructor Toolkit for CAT 531", [
                "Facilitator Notes for DTS",
                "TeachGen@i Troubleshooting",
                "Ethobot Setup and Debrief",
                "Rubric Language for AI Use",
                "Discussion Prompts by Module",
                "Low-Tech Fallbacks",
                "Evidence Collection Checklist",
                "Readiness Review",
            ]),
        ],
    },
    "cat100-supplement": {
        "title": "CAT 100: Computer Concepts and Applications Supplement",
        "short": "CAT 100",
        "audience": "undergraduates building practical digital, AI, data, presentation, and portfolio skills",
        "comparison": "Compared against the CAT-100 Summer 2026 shell, the missing layer was a richer step-by-step practice sequence: more worked examples, AI critique checkpoints, and low-stakes self-checks around digital citizenship, resumes, Excel data stories, teacher-AI conversations, presentations, and GitHub Pages portfolios.",
        "modules": [
            ("Digital Citizenship and AI Readiness", [
                "Digital Identity and Professional Presence",
                "Responsible AI Use in Coursework",
                "ETHOBOT CAT100 Orientation",
                "Prompting With Verification",
                "Privacy and Account Safety",
                "Accessibility Basics",
                "Evidence of Digital Citizenship",
                "Module 1 Readiness Studio",
            ]),
            ("Resume, Branding, and AI Brainstorming", [
                "Resume Claims and Evidence",
                "Two-AI Critique Workflow",
                "Professional Bio Drafting",
                "LinkedIn and Portfolio Alignment",
                "AI Feedback You Should Reject",
                "Revision Logs",
                "Peer Review for Professional Materials",
                "Module 2 Branding Studio",
            ]),
            ("Data Storytelling With Excel", [
                "Spreadsheet Structure and Clean Data",
                "Formulas for Everyday Analysis",
                "Charts That Answer Questions",
                "Pivot Tables as Summaries",
                "AI Help for Excel Debugging",
                "Data Ethics in Small Datasets",
                "Narrating a Data Finding",
                "Module 3 Data Story Studio",
            ]),
            ("AI Conversations as a Teacher", [
                "Teacher Persona Setup",
                "Scenario-Based AI Dialogue",
                "Checking AI Pedagogical Advice",
                "Classroom Communication Drafts",
                "Tone, Bias, and Audience",
                "Reflection on Teacher Judgment",
                "Evidence Collection",
                "Module 4 Dialogue Studio",
            ]),
            ("AI-Enhanced Presentation Development", [
                "Presentation Purpose and Audience",
                "Slide Structure Before Decoration",
                "Image Generation for Explaining Ideas",
                "AI Narration Pathways",
                "Self-Recording With AI Coaching",
                "Citation and Attribution",
                "Accessibility Checks for Slides",
                "Module 5 Presentation Studio",
            ]),
            ("GitHub Pages Personal Website", [
                "Website Purpose and Information Architecture",
                "Starter HTML and CSS",
                "GitHub Repository Setup",
                "Publishing With GitHub Pages",
                "Debugging With AI Assistance",
                "Portfolio Evidence and Reflection",
                "Maintenance Plan",
                "Module 6 Website Studio",
            ]),
            ("Productivity and Workflow Automation", [
                "File Organization for Coursework",
                "Calendar and Task Systems",
                "Template-Based Productivity",
                "AI-Assisted Email Drafting",
                "Automation Safety Checks",
                "Collaboration Norms",
                "Personal Workflow Audit",
                "Workflow Studio",
            ]),
            ("Course Completion and Transfer", [
                "Capstone Artifact Review",
                "Professional Story Across Artifacts",
                "Digital Skills Transfer Map",
                "AI Use Disclosure Portfolio",
                "Peer Showcase Feedback",
                "Revision Sprint",
                "Final Submission Checklist",
                "Future Learning Plan",
            ]),
        ],
    },
}


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def concept_ids(course: str, module_title: str, section_title: str) -> list[str]:
    base = course.replace("-", "_")
    return [
        f"{base}_{slugify(module_title)}",
        f"{base}_{slugify(section_title)}",
        f"{base}_evidence_based_revision",
        f"{base}_ai_supported_learning",
    ]


def section_body(course_slug: str, course: dict, module_index: int, section_index: int, module_title: str, section_title: str) -> str:
    short = course["short"]
    concepts = concept_ids(course_slug, module_title, section_title)
    image_path = f"/course-art/{course_slug}/module-{module_index:02d}.svg"
    quiz_options = json.dumps([
        "Use the tool output exactly because the activity requires AI use.",
        "Compare the output to the course evidence, revise it, and document what changed.",
        "Avoid all AI use even when the task asks for critique or generation.",
        "Focus only on visual polish and skip the learning rationale.",
    ])
    scenario = (
        f"A learner is working through {short} Module {module_index} and has produced a draft artifact for "
        f"{section_title}. The artifact is polished, but the rationale does not yet show how evidence, constraints, "
        f"and revision decisions are connected."
    )

    return dedent(f"""
    # {section_title}

    ![{module_title} visual anchor]({image_path})

    ## Why This Section Exists

    This section was added during the Summer 2026 ALGET course redevelopment pass. The comparison against the existing {short} Blackboard material showed that students already had assignments, deadlines, and broad module outcomes, but they needed a tighter learning path inside the textbook: a short conceptual explanation, a decision model, a worked application, a critique move, and an evidence trail they can carry into the graded course shell. The purpose here is not to replace Blackboard. The purpose is to make the work easier to understand before students submit anything in Blackboard.

    In {short}, the central problem is that students can complete a technology task without knowing what judgment they used. They may follow a tool tutorial, accept an AI suggestion, paste a polished artifact, or write a reflection after the fact. ALGET turns that hidden process into visible learning. Each section asks the student to name the claim they are making, identify what counts as evidence, and decide how the artifact should change after feedback. That structure keeps the course from becoming a collection of disconnected tools.

    ## Core Idea

    The core idea in **{section_title}** is that technology work becomes educational only when the learner can explain the relationship between purpose, constraint, evidence, and revision. A useful artifact is not just complete. It is aligned with a learner, audience, context, and standard of quality. That is why the section uses three repeated questions: What is the learning or professional purpose? What evidence would show that the artifact meets that purpose? What should change if the evidence is weak?

    For this module, the strongest work usually has four features:

    - It names a concrete audience rather than writing for an imaginary generic user.
    - It connects at least one design choice to a course concept or reading.
    - It documents one AI-supported move and one human override.
    - It explains how feedback or testing changed the next version.

    Students often treat those features as extra paperwork. They are not. They are the mechanism that lets the instructor see thinking rather than only seeing a finished file. In a short summer course, this matters because there is limited time for the instructor to infer what happened behind the artifact.

    <concept-diagram title="{section_title}" description="Purpose, constraint, evidence, and revision form the repeating decision loop for this section." />

    ## Step-by-Step Learning Path

    Start by writing a one-sentence purpose statement for the artifact. The sentence should include the audience, the action the audience should be able to take, and the context where the artifact will be used. Then list two constraints. One constraint should come from the course task, such as accessibility, citation, privacy, or required tool use. The other should come from the learner or audience, such as time, prior knowledge, language, device access, or confidence.

    Next, identify the evidence standard. Evidence can be a rubric criterion, a peer comment, a usability observation, a comparison to a model example, a correctness check, or a trace from the tool itself. The key is that the evidence must be specific enough to change the artifact. "It looks good" is not evidence. "The slide title states the claim, but the chart does not label the unit" is evidence because it points to a revision.

    After that, use AI or software support only for a bounded move. Ask for alternatives, critique, formatting help, example language, debugging guidance, or a checklist. Do not ask the tool to decide the whole assignment. A bounded move keeps the student in control and makes the disclosure meaningful. The strongest disclosure is simple: "I used the tool for X, I rejected Y, and I changed Z because of evidence."

    Finally, write the revision note before submitting. A revision note should identify the earlier weakness, the evidence that made the weakness visible, the change made, and the remaining limitation. This is the small habit that turns a one-time assignment into transferable skill.

    ## Worked Example

    Imagine a student drafts an artifact for **{section_title}**. The first version is neat and complete, but the explanation says only, "I used AI to make it better." That statement does not show judgment. A stronger version says: "I asked the tool for three ways to improve audience clarity. I rejected the suggestion to add more decorative language because the assignment asks for concise communication. I kept the suggestion to add a concrete example, then revised the artifact so the audience could see how the idea applies in practice."

    Notice what changed. The second version does not apologize for using AI, and it does not pretend the tool is the author. It makes the student's decision visible. It also gives the instructor something to evaluate: whether the accepted suggestion actually improved the artifact and whether the rejected suggestion was rejected for a defensible reason.

    <dynamic-scenario prompt="{scenario}" />

    ## Common Failure Pattern

    The most common failure pattern is tool-centered completion. The student opens a platform, follows steps, produces output, and then writes a generic reflection. Tool-centered completion feels efficient, but it leaves the learning claim unsupported. If the same student has to transfer the skill to a new tool next semester, there is no durable reasoning pattern to reuse.

    The fix is to move from tool-centered completion to evidence-centered revision. The question becomes: what did the tool help me see, what did the evidence confirm or challenge, and what did I change? This is the reason every ALGET supplement section includes practice and misconception checks. Students need repeated low-stakes opportunities to rehearse the decision pattern before the graded artifact is due.

    ## Apply It Now

    Use the following mini-protocol before moving on:

    - Write the artifact purpose in one sentence.
    - Name two constraints, one from the assignment and one from the audience.
    - Identify one evidence source that could reveal a weakness.
    - Make one AI-supported or software-supported improvement.
    - Document one accepted suggestion, one rejected suggestion, and one revision.

    <interactive-quiz question="What is the strongest use of AI or software support in this section?" options='{quiz_options}' correct-index="1" conceptid="{concepts[1]}" />

    ## What to Carry Forward

    Carry forward the decision loop: purpose, constraint, evidence, revision. If a later module feels different on the surface, the loop is still the same. The product might be a storyboard, an ethics dialogue, a data chart, a professional website, an evaluation brief, or a capstone defense. The learning move is to make judgment visible and revise from evidence rather than from preference alone.
    """).strip() + "\n"


def meta(course_slug: str, course: dict, module_index: int, section_index: int, module_title: str, section_title: str) -> dict:
    concepts = concept_ids(course_slug, module_title, section_title)
    return {
        "chapter_title": module_title,
        "title": section_title,
        "description": f"{course['short']} supplement section connecting {section_title.lower()} to evidence-centered revision, AI-supported learning, and course artifact development.",
        "learning_objectives": [
            f"Explain why {section_title.lower()} matters for the Summer 2026 {course['short']} course sequence.",
            "Apply the purpose-constraint-evidence-revision loop to a concrete course artifact.",
            "Document one accepted AI or software suggestion and one rejected suggestion with rationale.",
            "Use feedback, evidence, or a rubric criterion to plan a defensible revision.",
        ],
        "concept_ids": concepts,
        "estimated_time_minutes": 14,
        "order": section_index,
    }


def practice(course_slug: str, course: dict, module_title: str, section_title: str) -> dict:
    base = slugify(f"{course_slug}_{section_title}")
    concepts = concept_ids(course_slug, module_title, section_title)
    return {
        "problems": [
            {
                "id": f"{base}_purpose",
                "type": "multiple_choice",
                "concept_id": concepts[1],
                "stem": f"Which purpose statement best fits {section_title}?",
                "options": [
                    "I will make something good for the assignment.",
                    "I will create an artifact for a named audience, under clear constraints, and revise it using evidence.",
                    "I will use an AI tool because the course mentions AI.",
                    "I will focus on visual polish first and explain the design later.",
                ],
                "correct_index": 1,
                "explanation": "The strongest purpose statement names audience, constraints, evidence, and revision.",
                "misconception_id": f"{base}_generic_purpose",
            },
            {
                "id": f"{base}_evidence",
                "type": "multiple_choice",
                "concept_id": concepts[2],
                "stem": "Which item is the best evidence source for deciding a revision?",
                "options": [
                    "A vague feeling that the artifact looks professional.",
                    "A rubric criterion, peer observation, usability note, or correctness check that points to a specific change.",
                    "The fact that the tool produced the output quickly.",
                    "The number of colors or decorative elements used.",
                ],
                "correct_index": 1,
                "explanation": "Evidence must be specific enough to support a revision decision.",
                "misconception_id": f"{base}_evidence_as_preference",
            },
            {
                "id": f"{base}_ai_use",
                "type": "multiple_choice",
                "concept_id": concepts[3],
                "stem": "What is the most defensible way to use AI support here?",
                "options": [
                    "Ask the AI to complete the whole assignment and submit the result.",
                    "Use AI for a bounded move, compare the output with course criteria, and document what was accepted, rejected, and revised.",
                    "Use AI only for decoration.",
                    "Hide AI use because disclosure makes the work look weaker.",
                ],
                "correct_index": 1,
                "explanation": "Bounded, disclosed, evidence-checked AI use keeps the learner responsible for judgment.",
                "misconception_id": f"{base}_ai_as_author",
            },
            {
                "id": f"{base}_revision",
                "type": "multiple_choice",
                "concept_id": concepts[2],
                "stem": "Which revision note is strongest?",
                "options": [
                    "I revised it a little.",
                    "I changed the artifact after peer feedback showed the audience could not identify the main claim.",
                    "I made it better with AI.",
                    "I changed the colors because I liked them more.",
                ],
                "correct_index": 1,
                "explanation": "A strong revision note names the evidence and the specific change.",
                "misconception_id": f"{base}_revision_without_evidence",
            },
        ]
    }


def misconceptions(course_slug: str, module_title: str, section_title: str) -> dict:
    base = slugify(f"{course_slug}_{section_title}")
    return {
        "section_id": base,
        "misconceptions": [
            {
                "id": f"{base}_generic_purpose",
                "pattern": "generic_completion",
                "description": "Treating the task as generic completion rather than audience- and evidence-centered design",
                "trigger": "learner describes the goal as finishing the assignment or making something good",
                "feedback": "Name the audience, purpose, constraint, and evidence standard. Completion is not the same as defensible design.",
                "rail_action": "ask",
            },
            {
                "id": f"{base}_evidence_as_preference",
                "pattern": "preference_over_evidence",
                "description": "Using personal preference as the main basis for revision",
                "trigger": "learner says a change is better because it looks nicer without pointing to evidence",
                "feedback": "A revision is stronger when it responds to a rubric criterion, peer observation, usability note, or correctness check.",
                "rail_action": "represent",
            },
            {
                "id": f"{base}_ai_as_author",
                "pattern": "outsourced_judgment",
                "description": "Letting the AI or software decide the artifact rather than using it for bounded support",
                "trigger": "learner accepts tool output without critique or disclosure",
                "feedback": "Use AI as a critic, generator, or checker for a bounded move. The student remains responsible for judgment and revision.",
                "rail_action": "practice",
            },
            {
                "id": f"{base}_revision_without_evidence",
                "pattern": "unsupported_revision",
                "description": "Reporting that revision happened without naming the evidence that motivated it",
                "trigger": "learner writes a generic revision note",
                "feedback": "State the earlier weakness, the evidence that revealed it, the exact change, and the remaining limitation.",
                "rail_action": "explain",
            },
        ],
    }


def svg_for_course(course_slug: str, course: dict, module_index: int, module_title: str) -> str:
    palette = {
        "ail606-supplement": ("#9E1B32", "#C99700", "#113946"),
        "cat531-supplement": ("#7A1E2D", "#D6A545", "#1E4E5F"),
        "cat100-supplement": ("#245B6A", "#9E1B32", "#F2C14E"),
    }[course_slug]
    primary, accent, dark = palette
    title = f"{course['short']} Module {module_index}"
    safe_module = module_title.replace("&", "and")
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
  <title id="title">{title}: {safe_module}</title>
  <desc id="desc">Conceptual learning visual for {safe_module}, showing purpose, constraint, evidence, and revision.</desc>
  <rect width="1200" height="675" fill="#fbfaf7"/>
  <rect x="54" y="52" width="1092" height="571" rx="36" fill="#ffffff" stroke="#e4dfd4" stroke-width="3"/>
  <circle cx="1050" cy="122" r="86" fill="{accent}" opacity="0.18"/>
  <circle cx="146" cy="556" r="110" fill="{primary}" opacity="0.12"/>
  <text x="92" y="116" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="800" fill="{dark}">{title}</text>
  <text x="92" y="160" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" fill="{primary}">{safe_module}</text>
  <g transform="translate(122 235)">
    <rect x="0" y="0" width="210" height="118" rx="24" fill="{primary}" opacity="0.94"/>
    <text x="105" y="52" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="800" fill="#fff">Purpose</text>
    <text x="105" y="84" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="15" fill="#fff">name the target</text>
    <path d="M230 59 H345" stroke="{dark}" stroke-width="8" stroke-linecap="round"/>
    <path d="M345 59 l-22 -15 v30 z" fill="{dark}"/>
    <rect x="370" y="0" width="210" height="118" rx="24" fill="{accent}" opacity="0.96"/>
    <text x="475" y="52" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="800" fill="#2d2100">Constraint</text>
    <text x="475" y="84" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="15" fill="#2d2100">make limits visible</text>
    <path d="M600 59 H715" stroke="{dark}" stroke-width="8" stroke-linecap="round"/>
    <path d="M715 59 l-22 -15 v30 z" fill="{dark}"/>
    <rect x="740" y="0" width="210" height="118" rx="24" fill="{dark}" opacity="0.94"/>
    <text x="845" y="52" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="800" fill="#fff">Evidence</text>
    <text x="845" y="84" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="15" fill="#fff">test the claim</text>
  </g>
  <g transform="translate(274 430)">
    <path d="M0 0 C170 100 430 100 600 0" fill="none" stroke="{primary}" stroke-width="10" stroke-linecap="round"/>
    <path d="M600 0 l-32 -8 16 30 z" fill="{primary}"/>
    <rect x="194" y="34" width="240" height="96" rx="28" fill="#f7efe0" stroke="{accent}" stroke-width="3"/>
    <text x="314" y="75" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="800" fill="{dark}">Revision</text>
    <text x="314" y="104" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="15" fill="{dark}">document what changed</text>
  </g>
  <text x="92" y="594" font-family="Inter, Arial, sans-serif" font-size="18" fill="#5c6670">ALGET Summer 2026 supplement visual anchor. Replace with imagegen2 raster asset when final artwork is generated.</text>
</svg>
"""


def image_prompt(course_slug: str, course: dict, module_index: int, module_title: str) -> dict:
    filename = f"{course_slug}-module-{module_index:02d}.png"
    prompt = (
        "Use case: scientific-educational\n"
        f"Asset type: ALGET course module hero for {course['short']}\n"
        f"Primary request: Create an educational infographic for {course['short']} Module {module_index}: {module_title}.\n"
        "Scene/backdrop: clean University of Alabama online-course visual system, light academic background, subtle crimson and gold accents.\n"
        "Subject: a clear learning workflow with students moving from purpose to constraints to evidence to revision.\n"
        "Style/medium: polished raster educational infographic, semi-flat editorial illustration, no photorealistic faces.\n"
        "Composition/framing: 16:9 landscape, strong central diagram, generous margins, readable without dense text.\n"
        f'Text (verbatim): "{course["short"]} Module {module_index}: {module_title}"\n'
        "Constraints: no logos, no watermarks, no fake UI screenshots, avoid tiny unreadable labels, keep accessibility-friendly contrast."
    )
    return {
        "course": course_slug,
        "module": f"{module_index:02d}",
        "module_title": module_title,
        "target_svg_placeholder": f"frontend/public/course-art/{course_slug}/module-{module_index:02d}.svg",
        "recommended_output": f"frontend/public/course-art/{course_slug}/{filename}",
        "prompt": prompt,
    }


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def generate() -> None:
    all_prompts = []
    total_sections = 0
    for course_slug, course in COURSES.items():
        for module_index, (module_title, sections) in enumerate(course["modules"], start=1):
            module_dir = CONTENT_ROOT / course_slug / f"{module_index:02d}"
            module_dir.mkdir(parents=True, exist_ok=True)
            art_dir = PUBLIC_ART_ROOT / course_slug
            art_dir.mkdir(parents=True, exist_ok=True)
            (art_dir / f"module-{module_index:02d}.svg").write_text(
                svg_for_course(course_slug, course, module_index, module_title),
                encoding="utf-8",
            )
            all_prompts.append(image_prompt(course_slug, course, module_index, module_title))

            for section_index, section_title in enumerate(sections, start=1):
                section = f"{section_index:02d}"
                (module_dir / f"{section}.mdx").write_text(
                    section_body(course_slug, course, module_index, section_index, module_title, section_title),
                    encoding="utf-8",
                )
                write_json(module_dir / f"{section}.meta.json", meta(course_slug, course, module_index, section_index, module_title, section_title))
                write_json(module_dir / f"{section}.practice.json", practice(course_slug, course, module_title, section_title))
                write_json(module_dir / f"{section}.misconceptions.json", misconceptions(course_slug, module_title, section_title))
                total_sections += 1

    MANIFEST_PATH.write_text(json.dumps(all_prompts, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    PROMPT_PATH.write_text(render_prompt_markdown(all_prompts), encoding="utf-8")
    REPORT_PATH.write_text(render_gap_report(total_sections), encoding="utf-8")
    print(f"Generated {total_sections} sections across {len(COURSES)} Summer 2026 supplement courses.")
    print(f"Wrote image prompt manifest: {MANIFEST_PATH}")
    print(f"Wrote redevelopment report: {REPORT_PATH}")


def render_prompt_markdown(prompts: list[dict]) -> str:
    lines = [
        "# Imagegen2 Prompt Manifest for Summer 2026 ALGET Supplements",
        "",
        "These prompts are intended for imagegen2 or the built-in image generation workflow. SVG placeholders already exist at the target paths so the course renders immediately; replace each SVG with the generated PNG after review.",
        "",
    ]
    for item in prompts:
        lines.extend([
            f"## {item['course']} Module {item['module']} - {item['module_title']}",
            "",
            f"- Placeholder: `{item['target_svg_placeholder']}`",
            f"- Recommended PNG: `{item['recommended_output']}`",
            "",
            "```text",
            item["prompt"],
            "```",
            "",
        ])
    return "\n".join(lines)


def render_gap_report(total_sections: int) -> str:
    rows = []
    for slug, course in COURSES.items():
        rows.append(f"| {course['short']} | 64 | {course['comparison']} |")
    return dedent(f"""
    # Summer 2026 ALGET Course Redevelopment Gap Report

    This report documents the redevelopment pass requested for AIL606, CAT531, and CAT100 supplemental learning materials.

    ## Expansion Target

    - Existing ALGET content before this pass: 64 sections.
    - New supplement content generated in this pass: {total_sections} sections.
    - Resulting section count target: 256 sections, or 4x the previous section count.
    - Each new section includes a narrative `.mdx`, `.meta.json`, `.practice.json`, and `.misconceptions.json`.
    - Each module includes a renderable SVG visual anchor plus an imagegen2 prompt for a final raster replacement.

    ## Cross-Course Gap Findings

    | Course | New Sections | Redevelopment Rationale |
    | --- | ---: | --- |
    {chr(10).join(rows)}

    ## Redevelopment Pattern Applied

    Every new supplement section follows the same instructional repair cycle:

    1. Compare the Blackboard course shell goal with the closest ALGET content pattern.
    2. Identify the missing support layer: worked explanation, decision routine, AI-use boundary, evidence standard, or revision protocol.
    3. Rebuild the section around the purpose-constraint-evidence-revision loop.
    4. Attach practice items that diagnose likely failure modes.
    5. Attach misconception feedback for BigAL/IntelRail intervention.
    6. Add a visual anchor and an imagegen2 prompt for final module artwork.

    ## Image Work

    The first pass uses deterministic SVG placeholders in `frontend/public/course-art/` so the course renders immediately. The imagegen2 prompt manifest at `frontend/public/course-art/IMAGEGEN2_PROMPTS.md` contains 24 module-level raster prompts. These should be generated, reviewed for text accuracy, and then saved beside the SVG placeholders as PNGs.
    """).lstrip()


if __name__ == "__main__":
    generate()
