# Engineering Text Fidelity Rubric

## Scope

This rubric evaluates the current engineering-domain textbook set:

- `dynamics`
- `statics`
- `bio-inspired`

Scores use a 1 to 5 scale:

- `5` = excellent and consistently publication-ready
- `4` = strong with minor improvement opportunities
- `3` = usable but uneven
- `2` = materially weak
- `1` = not sufficient

## Rubric Dimensions

| Dimension | What It Checks |
| --- | --- |
| Conceptual Clarity | Definitions, explanations, and progression from idea to method |
| Quantitative Rigor | Equations, assumptions, units, worked steps, and numerical reasoning |
| Engineering Translation | How well science is converted into engineering decisions and use cases |
| Constraint Awareness | Trade-offs, failure modes, manufacturability, maintenance, and limits |
| Learning Scaffolding | Scenarios, quizzes, practice, misconceptions, and progression support |
| Stylistic Consistency | Tone, formatting, notation consistency, and absence of encoding or legacy artifacts |

## Course-Level Scores

| Course | Conceptual Clarity | Quantitative Rigor | Engineering Translation | Constraint Awareness | Learning Scaffolding | Stylistic Consistency | Overall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| dynamics | 5.0 | 4.5 | 4.5 | 4.0 | 5.0 | 4.5 | 4.6 |
| statics | 4.5 | 4.5 | 4.0 | 4.0 | 4.5 | 3.5 | 4.2 |
| bio-inspired | 4.5 | 3.5 | 4.5 | 3.5 | 4.5 | 4.5 | 4.2 |

## Evidence Notes

### Dynamics

- Strongest overall balance across explanation, workflow, and worked problem structure.
- Sections such as `02/01`, `02/02`, and `03/02` move cleanly from force model to coordinate choice to interpretation.
- Practice coverage is the deepest in the engineering set.
- Remaining gap is not sufficiency but sophistication: more explicit modeling assumptions and occasional design trade-off notes would make it even stronger.

### Statics

- Core analytical logic is strong and the sequence now has full practice and misconception support.
- Rigid-body and truss sections are serviceable and conceptually sound.
- The main drag on fidelity is uneven stylistic quality across earlier sections, especially legacy formatting and text-encoding artifacts in foundational pages.
- Some later sections are slightly shorter and more procedural than explanatory.

### Bio-Inspired

- Excellent narrative engagement and strong engineering relevance.
- Translation from biological mechanism to engineering analogy is usually compelling.
- The main weakness is quantitative depth. Several sections explain the mechanism well but stop short of design envelopes, scaling limits, tolerance issues, contamination, wear, or cost-maintenance trade-offs.
- This is the course with the clearest opportunity to become more "engineering textbook" and less "good technical feature article."

## Priority Decision

Based on the rubric, the next improvement priorities are:

### Priority 1: Statics Foundation Fidelity

Target sections:

- `statics/01/01`
- `statics/01/02`

Why:

- These sections define the learner's first impression of analytical rigor.
- Legacy encoding artifacts and older callout styling reduce perceived quality even where the concepts are correct.

### Priority 2: Bio-Inspired Engineering Rigor

Target sections:

- `bio-inspired/04/01`
- `bio-inspired/07/01`
- `bio-inspired/01/03`

Why:

- These sections are conceptually sound but need stronger engineering decision language.
- The missing layer is explicit constraint analysis: cycle life, contamination, tolerance, healing efficiency, repeated-use behavior, and manufacturability.

### Priority 3: Shorter Statics Analysis Sections

Target sections:

- `statics/02/03`
- `statics/03/02`
- `statics/03/03`

Why:

- These sections are not weak, but they are slightly leaner than the best dynamics sections.
- They would benefit from one additional design-interpretation or failure-mode layer each.

## Action Taken In This Pass

This pass should prioritize:

1. `statics/01/01` text cleanup and fidelity repair
2. `bio-inspired/04/01` quantitative and design-constraint expansion
3. `bio-inspired/07/01` engineering evaluation and life-cycle trade-off expansion

## Follow-On Pass Completed

The next priority bundle has also been completed:

- `statics/01/02` was fully rewritten to remove legacy encoding artifacts and align with the cleaner analytical tone established in `statics/01/01`.
- `bio-inspired/01/03` was expanded with explicit engineering constraints around preload, roughness, contamination, manufacturing tolerance, and durability.
- `statics/02/03`, `statics/03/02`, and `statics/03/03` were extended with design-interpretation and modeling-judgment sections so they read less like short procedures and more like engineering analysis guidance.

## Current Status

After these passes:

- the main `statics` foundation pages no longer carry the earlier style and encoding penalties,
- the most visible `bio-inspired` mechanism chapters now connect biological inspiration more clearly to engineering limits,
- and the shorter truss and rigid-body sections have a stronger design-decision layer.

The remaining opportunities are now incremental rather than corrective: stronger assumption callouts in selected `dynamics` pages, and occasional deeper quantitative trade-off framing in later `bio-inspired` sections.

## Dynamics Tone Upgrade Completed

A subsequent refinement pass has now addressed the main `dynamics` tone opportunity as well:

- `dynamics/01/01` now includes an explicit modeling-assumptions section and a simplicity-versus-fidelity trade-off frame.
- `dynamics/02/01` now makes the particle-model assumptions visible and explains when a lean force model is appropriate versus when higher-fidelity effects should be added.
- `dynamics/02/02` now clarifies what energy methods intentionally hide and when state-to-state analysis should be supplemented with force-history analysis.
- `dynamics/03/02` now states the limits of the rigid-body assumption and frames torque-versus-inertia as an engineering trade-off rather than a purely algebraic result.

At this point, the engineering set reads more like a disciplined textbook sequence than a collection of individually strong sections. Remaining improvement opportunities are now mostly depth extensions, not fidelity repairs.

## Advanced Enrichment Pass Completed

An additional enrichment pass has now strengthened the "research textbook" character of selected sections:

- `bio-inspired/04/01` now includes a comparative attachment benchmark and a mini experimental framing across competing surface-interaction strategies.
- `bio-inspired/07/01` now includes a comparative materials table and a clearer test protocol for evaluating healing quality beyond simple narrative claims.
- `dynamics/02/02` now includes a quantitative side-by-side design comparison showing how different non-conservative losses alter final speed.
- `dynamics/03/03` now includes a shape-based rolling comparison that makes inertia distribution visible as a measurable design variable.

The engineering courses are now stronger not only in explanation quality, but also in comparative reasoning and quantitative interpretation.

## Sensitivity And Assumption-Breakdown Pass Completed

The next pass pushed the content one step further toward research-textbook quality:

- `dynamics/02/01` now includes a friction sensitivity table and an explicit breakdown case for when constant-friction modeling stops being trustworthy.
- `dynamics/03/03` now includes a loss-sensitivity comparison and a rolling-without-slipping breakdown case that makes the traction boundary explicit.
- `bio-inspired/04/01` now includes a surface-condition sensitivity table and a clearer breakdown analysis for the clean-contact assumption behind dry adhesion.
- `bio-inspired/07/01` now includes a healing-window sensitivity table and a breakdown case showing why repeated or distributed damage complicates simple self-healing narratives.

At this stage, the strongest sections do more than explain mechanisms and compare options. They also show which assumptions carry the model, how sensitive the result is to parameter changes, and when the design conclusion might reverse.
