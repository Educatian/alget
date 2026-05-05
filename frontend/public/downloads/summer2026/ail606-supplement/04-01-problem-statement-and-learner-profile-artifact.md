# AIL 606 Artifact Studio Packet: Problem Statement and Learner Profile

## Purpose
This packet turns **Problem Statement and Learner Profile** into a concrete artifact studio task. The goal is not to make a polished submission on the first pass. The goal is to make the learner's judgment visible enough that ALGET can adapt support, an instructor can review the decision, and a researcher can code the trace.

## Artifact
**prototype README traceability matrix connecting theory to screen changes**

## Course Context
Module: **Design Draft and Theory-to-Prototype Alignment**  
Course focus: **graduate multimedia learning design**

## Required Submission
Submit one artifact file or screenshot plus a revision trace. The trace must contain:

1. **Initial claim:** What the artifact is supposed to help the audience do.
2. **Constraint:** Which course idea limits or shapes the decision. Use at least one of: Mayer multimedia learning, cognitive load theory, UDL learner variability, usability heuristics.
3. **Evidence source:** Identify the exact rubric line, peer annotation, transcript segment, data check, usability observation, accessibility check, or policy clause that influenced the revision.
4. **AI/software support move:** Name the tool and the bounded request. The request should ask for critique, alternatives, simplification, debugging, or comparison, not full artifact authorship.
5. **Accepted suggestion:** State what changed and why it improved the artifact.
6. **Rejected or modified suggestion:** State what you did not accept and why.
7. **Final limitation:** Name one remaining uncertainty or condition where the artifact may fail.

## Worked Mini-Example
Weak trace: "I used AI and made it clearer."

Strong trace: "I asked for three alternatives for the prototype README traceability matrix connecting theory to screen changes. I accepted the alternative that made the audience constraint explicit, rejected the alternative that removed the evidence source, and revised the artifact so the reader can see how Mayer multimedia learning shaped the final decision. The remaining limitation is that the trace has not yet been tested with a second reader."

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
