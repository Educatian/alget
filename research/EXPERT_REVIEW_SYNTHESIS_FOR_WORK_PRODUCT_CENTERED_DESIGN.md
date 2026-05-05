# Expert Review Synthesis for ALGET Work-Product-Centered Design

Date: 2026-05-05
Source: Google Drive expert review artifacts located on 2026-05-05
Project: ALGET

## Drive artifacts read

The Drive search recovered four substantive review artifacts plus supporting CW protocol documents. Templates and empty copies were excluded from the synthesis.

| Review artifact | Drive title | URL | Status |
|---|---|---|---|
| Expert reflection 1 | `08_Post_Evaluation_Reflection_YJ` | https://docs.google.com/document/d/1SYZgfO_e-hW70P5fwTj_NLtmTYQypKNWJU6kzDaCNJw | Completed reflection |
| Expert reflection 2 | `08_Post_Evaluation_Reflection_YK.docx` | https://drive.google.com/file/d/1SMm1To6y-_-GxEFIlGctz9bMk9lZUzeB | Completed reflection |
| Expert reflection 3 | `Copy of 08_Post_Evaluation_Reflection` | https://docs.google.com/document/d/1kNEt6bOHHcqQ1B-QBOKPTOEK0aCrUkK8YnFc8GaydXY | Completed reflection with detailed Korean comments |
| Expert walkthrough / SME review | `03_Expert_Step_Sheet.docx` | https://drive.google.com/file/d/1Mw38Pc7gzckhp3IrqzIDfXu6z-z3HF8r | Completed E3/domain-SME step sheet |
| Supporting protocol | `01_Methodology_Validation.docx`, `06_Expert_Briefing.docx`, `04_Task_Definitions.docx`, step-sheet templates | Multiple Drive files | Used only to interpret the review method |

## Highest-signal findings

The expert reviews are broadly positive about ALGET's potential, especially personalized/adaptive learning, diverse learning materials, self-regulated learning support, and metacognitive scaffolding. But the reviews do **not** yet support an A+ claim unless the system becomes less fragmented, less cognitively heavy, and more concrete in how learners act on AI feedback.

The recurring expert concerns are:

1. **Content and interface are cognitively heavy.**
   - Multiple reviewers described modules as lengthy, busy, or overwhelming.
   - One explicit immediate fix was to structure learning content and activities to reduce cognitive load.

2. **Navigation and progress continuity are underdeveloped.**
   - Reviewers wanted previous/next navigation, clearer progress indicators, and a check-in/resume function.
   - Returning to dashboard was reported as disruptive in the completed walkthrough, including a logout/re-entry issue.

3. **AI support is pedagogically promising but fragmented.**
   - Reviewers liked BigAL's Socratic prompting and the idea of not giving direct answers immediately.
   - However, AI features appeared split across different areas, reducing discoverability.
   - A unified AI-support surface was recommended.

4. **AI responses need stronger specificity and actionability.**
   - Domain-SME review reported vague, occasionally irrelevant responses.
   - The system was said to need more dynamic, tailored feedback to learner responses.
   - Practice quiz feedback and correctness were flagged as unstable in the older evaluated version.

5. **Diagnostic assessment needs broader coverage.**
   - A reviewer noted that a five-item diagnostic cannot adequately cover an eight-module curriculum.
   - At least one item per module, or a clear module-level sampling strategy, is needed.

6. **Open learner model / brain graph needs explanation.**
   - The brain graph was seen as useful but underexplained.
   - Learners need instructions on what it represents, how it is generated, and how to use it.

7. **Interactive panels should become higher-order learning tasks.**
   - Reviewers wanted beyond hover/click panels: drag-and-drop flow construction, concept-building interactions, and richer manipulation.

8. **Case studies need clearer learner instructions.**
   - Generated case studies were seen as useful, but students need explicit prompts about what to do with them.
   - Open-ended questions followed by theoretical framing were suggested.

9. **Instructor customization is a major long-term structural need.**
   - Reviewers recommended allowing instructors to arrange learning activities, upload external videos/PDFs, and compose modules from reusable activity blocks.

## Implications for "work-product-centered" ALGET

The reviews make the term "artifact-centered" less convincing by itself. Expert feedback points toward a clearer framing:

> ALGET should be a work-product-centered adaptive textbook where each reading segment, AI support, annotation, diagnostic, and interactive element helps the learner produce a concrete course deliverable.

The expert reviews imply that ALGET should not add more features loosely. It should **reorganize existing intelligence around student work products**.

## Required design translation

### 1. Turn each module into a work-product pathway

Each module should start with:

- target deliverable,
- rubric dimensions,
- checkpoints,
- evidence requirements,
- revision expectations.

Example:

| Course | Work product | Required trace |
|---|---|---|
| AIL606 | AI-supported lesson redesign | design claim, UDL rationale, AI-use policy, revision memo |
| CAT531 | Data story / analysis memo | visualization claim, evidence link, interpretation, limitation |
| CAT100 | Resume/portfolio evidence packet | competency claim, evidence, revision, career relevance |

### 2. Replace feature fragmentation with one "Work Product Studio"

The expert reviews consistently object to fragmented AI support. The right fix is not another chatbot. The right fix is a single studio surface:

- draft panel,
- evidence linker,
- BigAL Socratic critique,
- rubric checklist,
- AI suggestion judgment,
- revision rationale,
- next adaptive support.

### 3. Use expert CW criteria as interface gates

Every work-product task should pass these checks:

- **Goal:** Does the learner know what deliverable they are building?
- **Find:** Can the learner find the next action?
- **Understand:** Do they understand what the action will do?
- **Feedback:** Does the system clearly show progress?
- **LXD:** Is the learning objective visible, active, and not overloaded?
- **Intelligence:** Is adaptive support specific, transparent, metacognitive, and flow-preserving?

### 4. Redesign diagnostics around module/work-product readiness

The old five-item diagnostic is too shallow for the expanded course set. The new diagnostic should estimate readiness for each work-product pathway:

- concept readiness,
- evidence-use readiness,
- AI judgment readiness,
- domain-specific prerequisite readiness,
- confidence/calibration.

Minimum implementation standard:

- at least one diagnostic item per module;
- at least one item tied to the target work product;
- diagnostic result determines the first scaffold level in Work Product Studio.

### 5. Make AI feedback assessable by the learner

The expert reviews already value Socratic non-answering, but they also warn that vague guidance becomes unhelpful. Therefore each AI feedback event should require:

- a concrete suggestion,
- a reason,
- a linked rubric dimension,
- a learner judgment: accept, reject, modify, or defer,
- a revision outcome.

## Evaluation method implied by the expert reviews

The current CW method remains useful, but the task set should be updated for the work-product-centered claim.

### Updated expert walkthrough tasks

| Task | What expert evaluates | Success criterion |
|---|---|---|
| T1: Enter module | Learner understands target work product and pathway | Deliverable, rubric, progress state are visible |
| T2: Read and annotate | Learner links reading to artifact evidence | Annotation can be transferred into work product |
| T3: Build draft | Learner creates a partial course deliverable | Draft has claim, evidence, and rubric alignment |
| T4: Receive AI critique | Learner understands critique and next action | Feedback is specific, transparent, and actionable |
| T5: Judge AI feedback | Learner accepts/rejects/modifies suggestion | Judgment rationale is recorded |
| T6: Revise work product | Learner improves artifact quality | Before/after delta is visible and scored |
| T7: Resume/check progress | Learner returns later without losing place | Check-in and next-step state are clear |

### Quantitative outcomes

- expert severity ratings by task;
- time to find correct action;
- AI feedback specificity score;
- work-product rubric improvement;
- revision-depth score;
- diagnostic-to-scaffold alignment;
- progress/check-in success rate.

### Qualitative outcomes

- where learners experience cognitive overload;
- where AI support feels fragmented;
- whether learners understand why support was recommended;
- whether learners can explain how their artifact improved.

## A+ priority list from expert reviews

1. **P0: Reduce cognitive load by segmenting modules into work-product checkpoints.**
2. **P0: Add persistent progress/check-in/previous-next navigation.**
3. **P0: Unify AI support inside Work Product Studio rather than scattering tools.**
4. **P0: Make AI feedback more specific, rubric-linked, and judgment-gated.**
5. **P1: Expand diagnostic assessment to cover every module and work-product pathway.**
6. **P1: Explain the brain graph / learner model in actionable learner language.**
7. **P1: Upgrade interactive panels into constructive tasks, not just inspection widgets.**
8. **P2: Add instructor customization for activity blocks and external resources.**

## Bottom line

The expert reviews support ALGET's direction but also sharpen the design target. The system should not be presented as "many intelligent features." It should be presented as a coherent work-product-centered learning environment:

> ALGET helps learners produce better course deliverables by connecting reading, annotation, AI critique, learner judgment, revision, and adaptive support into one traceable workflow.

That phrasing directly addresses the expert concerns about fragmentation, cognitive load, vague AI help, and unclear progress.

## Implementation pass completed on 2026-05-05

The first design pass has been implemented in the ALGET codebase.

### Implemented changes

- Renamed the learner-facing artifact surface to **Work Product Studio**.
- Added a section-level **Work Product Pathway** card in the reading surface so the learner sees the target deliverable and the expected loop: read, annotate, draft, judge AI, revise.
- Added visible bottom previous/next navigation cards to reduce the "long scrolling / lost progress" issue found in the expert reviews.
- Expanded Work Product Studio trace capture from five fields to eight evidence fields:
  - initial draft,
  - artifact claim,
  - evidence,
  - accepted AI/support move,
  - rejected or modified suggestion,
  - AI feedback judgment rationale,
  - revised work product,
  - transfer constraint.
- Added an explicit **AI Feedback Judgment Gate** with accept, modify, reject, and defer options.
- Updated frontend adaptive telemetry so the trace completeness denominator is now 8, matching the revised work-product-centered evidence model.
- Updated backend artifact trace validation to recompute the new eight-part trace score and adjust support-move thresholds.
- Updated tests for the revised Work Product Studio contract.

### Verification

- `npm.cmd run test -- ArtifactStudio.test.jsx ReadingNarrative.test.jsx`: passed.
- `npm.cmd run test`: passed, 10 files / 16 tests.
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed.
- `python -m pytest backend`: passed, 23 passed / 5 skipped.
- `python research\run_quality_gate.py`: PASS.

### Remaining expert-review carryover

- Progress is visible, but the next pass should add a more explicit resume/check-in prompt when a learner returns after time away.
- Brain graph still needs learner-facing explanation and action prompts.
- Instructor customization of activity blocks remains a larger structural feature.
- AI response specificity still depends on the tutor/rail prompt layer; the new judgment gate records learner evaluation but does not yet guarantee better generation quality by itself.
