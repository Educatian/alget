# Artifact-Centered Adaptive: Theoretical Grounding for ALGET

Date: 2026-05-05
Project: ALGET
Status: theoretical grounding memo for top-tier intelligent textbook positioning

## Working definition

**Artifact-centered adaptive** means that the system adapts around the learner's evolving work product, not only around page progress, quiz correctness, or chat turns.

In ALGET, the primary unit of learning evidence is an **artifact revision episode**:

1. The learner reads and annotates source material.
2. The learner makes an artifact claim.
3. The learner attaches evidence from the text, data, rubric, or design context.
4. The system or peer layer critiques the artifact.
5. The learner accepts, rejects, or revises suggestions.
6. The artifact changes.
7. The system records the trace and adapts the next support move.

This differs from conventional adaptive courseware. Traditional systems adapt mainly from item responses, estimated mastery, or content path behavior. ALGET should adapt from the learner's **judgment-in-action**: what they produce, what evidence they cite, what critique they accept or reject, and how the artifact improves.

## One-sentence theoretical claim

ALGET extends the adaptive textbook tradition by shifting the locus of adaptivity from **response correctness** to **artifact-mediated learning evidence**, where authentic learner work becomes the object of diagnosis, feedback, revision, and research-grade trace analysis.

## Historical lineage since the 1950s

### 1950s: programmed instruction and immediate feedback

Skinner's teaching-machine work established the core idea that instructional systems can sequence material, elicit learner responses, and provide immediate feedback. This is the ancestor of adaptive instructional technology: the machine observes a response and changes the next instructional move.

**What ALGET inherits:** immediate feedback, fine-grained learner-system interaction, and the idea that instruction can be dynamically organized.

**What ALGET rejects as insufficient:** correctness on small responses is not enough for university-level engineering, instructional design, or AI-era learning. Learners must develop judgment about complex products, not merely select or type correct answers.

### 1960s: time, aptitude, and mastery learning

Carroll's model of school learning framed achievement as a function of time needed, time allowed, perseverance, opportunity, and instructional quality. Bloom's mastery learning then made the instructional implication explicit: students should receive formative checks and corrective support until mastery is reached.

**What ALGET inherits:** adaptation should be grounded in formative evidence and should support learners before failure becomes final.

**What ALGET adds:** mastery is not only mastery of objectives. In artifact-centered learning, mastery is visible in the improving quality of a design, explanation, analysis, policy judgment, dataset story, prototype trace, or professional artifact.

### 1970s-1980s: cognitive models and intelligent tutoring systems

Intelligent tutoring systems moved beyond generic sequencing toward models of cognitive skill, problem solving, and learner state. Anderson, Boyle, and Reiser's work on ACT-based tutors and later knowledge tracing demonstrated that tutoring systems can infer procedural knowledge from step-level behavior.

**What ALGET inherits:** learner modeling, step-level trace data, diagnosis of partial knowledge, and adaptive tutoring decisions.

**What ALGET extends:** classic ITS works best in well-structured domains with known steps and correct answers. ALGET targets semi-structured and ill-structured academic artifacts, where the learner must justify, revise, and defend quality rather than merely execute a known procedure.

### Late 1980s-1990s: situated cognition and cognitive apprenticeship

Situated cognition argued that knowledge is partly a product of the activity, context, and culture in which it is learned. Cognitive apprenticeship made the pedagogical implication clear: learners need modeling, coaching, scaffolding, articulation, reflection, and fading inside authentic practice.

**This is the strongest theoretical root for "artifact-centered."** The artifact is not decoration. It is the situated object through which learners participate in a disciplinary practice.

For ALGET, a storyboard, data explanation, resume evidence map, AI policy judgment, or prototype trace is a site of learning. The system should not merely explain concepts near the artifact; it should help learners improve the artifact through disciplinary standards.

### 1990s: authentic assessment and performance evidence

Authentic assessment challenged the dominance of decontextualized tests by asking whether learners can perform meaningful tasks under realistic constraints. This line of work grounds the idea that a learner's product can be valid evidence of understanding.

**What ALGET inherits:** assessment should ask learners to produce and justify meaningful work.

**What ALGET adds:** authentic assessment becomes adaptive and instrumented. The system does not wait until the final artifact is submitted; it treats intermediate claims, evidence choices, feedback uptake, and revision deltas as formative evidence.

### 1990s-2000s: evidence-centered design

Evidence-centered design formalized assessment as an evidentiary argument: what claims do we want to make about the learner, what evidence would support those claims, and what tasks can elicit that evidence?

ALGET maps cleanly onto this architecture:

- **Student model:** learner's current capability, misconceptions, evidence use, artifact quality, annotation behavior, and AI-critique judgment.
- **Evidence model:** annotation types, claim-evidence alignment, rubric scores, artifact revision quality, accept/reject decisions, confidence, and reflection.
- **Task model:** course reading, annotation prompt, artifact-studio task, critique move, revision request, diagnostic item, and instructor review.

This is the key validity argument. ALGET should not say "we logged many interactions." It should say: "We designed tasks that elicit evidence for specific claims about artifact judgment, and the adaptive system uses those evidence variables to select support."

### 2000s-2010s: social annotation, CSCL, and learning analytics

Computer-supported collaborative learning and social annotation shifted attention from solitary reading to socially visible interpretation, questioning, and sensemaking. Learning analytics then supplied the infrastructure for collecting and analyzing trace data at scale.

**What ALGET inherits:** annotation is not marginal comment behavior. It can reveal confusion, connection-making, question quality, peer uptake, and interpretive friction.

**What ALGET adds:** annotation evidence should not stay in a separate Perusall-like layer. It should feed the artifact loop. If a learner's annotations show confusion about evidence, the artifact studio should adapt its scaffold toward evidence selection. If annotations show strong critique behavior, the artifact task should shift toward synthesis, transfer, or peer-review responsibility.

### 2020s: generative AI, epistemic agency, and human-AI judgment

Generative AI changes the learning problem. Learners no longer only need content access; they need to judge AI suggestions, inspect evidence, detect hallucination or shallow reasoning, and revise authentic work without outsourcing their thinking.

This is where ALGET's artifact-centered adaptive design becomes timely. A generic AI tutor can answer questions. A generic adaptive textbook can route content. A generic annotation tool can capture discussion. ALGET's stronger claim is that it can train and measure **AI-mediated artifact judgment**:

- Did the learner accept weak AI feedback or reject it?
- Did the learner improve the artifact after critique?
- Did the learner cite stronger evidence after annotation friction?
- Did the learner move from surface compliance to defensible revision?
- Can the system explain why it adapted support based on artifact evidence?

## Theoretical synthesis

Artifact-centered adaptive learning combines seven traditions:

| Tradition | Core contribution | ALGET translation |
|---|---|---|
| Programmed instruction | Immediate feedback and sequenced response | Fast formative feedback, but not limited to small item correctness |
| Mastery learning | Formative assessment and corrective support | Corrective support for artifact quality and evidence use |
| Intelligent tutoring systems | Learner modeling and adaptive tutoring | Learner state includes artifact trace, annotation evidence, and revision behavior |
| Situated cognition | Knowledge is tied to authentic activity | The artifact is the authentic activity context |
| Cognitive apprenticeship | Modeling, coaching, scaffolding, fading | Studio-like artifact critique and scaffold release |
| Authentic assessment | Performance products as evidence | Artifacts become validity-bearing evidence |
| Evidence-centered design | Claims, evidence, and tasks | Server-validated traces connect artifact behavior to learner claims |
| Learning analytics | Trace capture and analysis | Research-grade logs support explanation, instructor dashboards, and studies |
| GenAI literacy | Human judgment over AI output | Accept/reject/revise traces become central learning evidence |

## Why this matters for ALGET's novelty

Most intelligent textbooks optimize one of four surfaces:

1. **Interactive content**: animation, embedded questions, coding widgets, simulations.
2. **Adaptive sequencing**: diagnose knowledge gaps and route practice.
3. **Social reading**: annotation, discussion, and engagement analytics.
4. **AI tutoring**: conversational explanation and help.

ALGET should claim a fifth surface:

**Artifact-centered adaptive revision**: the textbook helps learners build, critique, revise, and defend authentic course artifacts while the system adapts from the evidence generated by that process.

This is the strongest "why this must exist" argument. It is not another textbook interface. It is a traceable studio for learning through artifacts.

## Design principles for ALGET

1. **The artifact is the unit of adaptation.**
   - Do not adapt only from quiz correctness.
   - Adapt from artifact claims, evidence quality, rubric dimensions, annotation friction, and revision deltas.

2. **Every adaptive move needs an evidence explanation.**
   - The system should say, in instructor-usable terms, why a support move was selected.
   - Example: "Evidence scaffold assigned because annotation questions clustered around source reliability and the artifact claim had weak citation alignment."

3. **AI feedback must be judgeable, not merely helpful.**
   - The learner should accept, reject, revise, or contest AI/support suggestions.
   - These decisions should be logged as evidence of epistemic agency.

4. **Revision quality is more important than first-draft quality.**
   - ALGET's outcome should not be "student produced a good artifact once."
   - The stronger claim is "student improved artifact quality through evidence-based critique and revision."

5. **Instructor dashboards should surface artifact patterns, not only engagement.**
   - High-value analytics include weak evidence links, shallow revision, over-acceptance of AI feedback, annotation confusion clusters, and rubric-level bottlenecks.

## Empirical claim structure for a top-tier paper

### System claim

ALGET operationalizes an artifact-centered adaptive textbook architecture by integrating reading, annotation, artifact construction, critique, revision, adaptive support, and validated research traces.

### Learning claim

Learners using artifact-centered adaptive support will show stronger evidence-based revision, better transfer to authentic course tasks, and more calibrated AI-feedback judgment than learners using conventional adaptive reading or generic AI tutoring alone.

### Mechanism claim

The benefit should be mediated by:

- increased quality of claim-evidence alignment,
- more productive annotation-to-artifact transfer,
- better rejection or modification of weak AI suggestions,
- higher revision depth,
- more targeted adaptive support.

### Validity claim

Artifact traces are interpretable because they are designed under an evidence-centered framework: learner claims, evidence variables, and task features are explicitly aligned.

## Current implementation implications

ALGET already has the right direction:

- Perusall-style annotation layer;
- ArtifactStudio with artifact-type modes;
- adaptive signal logging for annotation and artifact traces;
- backend validation for research traces;
- recommender evidence snapshots;
- supplement courses with artifact-studio blocks.

To make the theoretical claim defensible, the next A+ development step should be:

1. Add **before/after artifact capture** for every ArtifactStudio submission.
2. Add **rubric-dimension scoring** tied to each artifact type.
3. Add **revision-delta analytics**: what changed, whether evidence improved, whether claim clarity improved.
4. Add **AI suggestion uptake coding**: accept, reject, modify, defer, with rationale.
5. Add **instructor-facing evidence explanations** for each adaptive recommendation.
6. Run a pilot comparing:
   - adaptive reading only,
   - annotation only,
   - artifact-centered adaptive revision.

## Bottom line

"Artifact-centered adaptive" means ALGET's intelligence is not just in choosing the next page, quiz, or explanation. Its intelligence is in reading the learner's developing artifact as evidence of thinking, then adapting support to improve the learner's judgment, evidence use, and revision quality.

That is the theoretical bridge from 1950s teaching machines to a 2026 intelligent textbook: from **machine-sequenced responses** to **AI-supported, evidence-centered artifact revision**.

## Anchor references

- Anderson, J. R., Boyle, C. F., & Reiser, B. J. (1985). Intelligent tutoring systems. *Science, 228*(4698), 456-462. https://doi.org/10.1126/science.228.4698.456
- Bloom, B. S. (1968). Learning for mastery. *Evaluation Comment, 1*, 1-12.
- Brown, J. S., Collins, A., & Duguid, P. (1989). Situated cognition and the culture of learning. *Educational Researcher, 18*(1), 32-42. https://doi.org/10.3102/0013189X018001032
- Carroll, J. B. (1963). A model of school learning. *Teachers College Record, 64*(8), 1-9. https://doi.org/10.1177/016146816306400801
- Corbett, A. T., & Anderson, J. R. (1995). Knowledge tracing: Modeling the acquisition of procedural knowledge. *User Modeling and User-Adapted Interaction, 4*, 253-278.
- Doignon, J.-P., & Falmagne, J.-C. (1985). Spaces for the assessment of knowledge. *International Journal of Man-Machine Studies, 23*(2), 175-196.
- Mislevy, R. J., Almond, R. G., & Lukas, J. F. (2003). *A brief introduction to evidence-centered design*. ETS Research Report RR-03-16. https://www.ets.org/research/policy_research_reports/publications/report/2003/hsgs.html
- Mislevy, R. J., Steinberg, L. S., & Almond, R. G. (2003). On the structure of educational assessments. *Measurement: Interdisciplinary Research and Perspectives, 1*(1), 3-62. https://doi.org/10.1207/S15366359MEA0101_02
- Siemens, G. (2013). Learning analytics: The emergence of a discipline. *American Behavioral Scientist, 57*(10), 1380-1400. https://doi.org/10.1177/0002764213498851
- Skinner, B. F. (1958). Teaching machines. *Science, 128*(3330), 969-977. https://doi.org/10.1126/science.128.3330.969
- Wiggins, G. (1990). The case for authentic assessment. *Practical Assessment, Research, and Evaluation, 2*(1), Article 2. https://doi.org/10.7275/ffb1-mm19
