# ALGET Artifact Definition and Submission Taxonomy

Date: 2026-05-05
Status: canonical working definition for Work Product Studio and validation exports

## Definition

An ALGET artifact is a concrete learner work product that can be inspected, critiqued, revised, and defended with evidence.

It is not merely a quiz answer, completion signal, reflection paragraph, chat transcript, or AI-generated polished output. It must have an inspectable form and a revision trace.

## Minimum Submission Contract

Every artifact submission should include:

1. Initial draft or current artifact state.
2. Artifact claim: what the artifact is intended to do, for whom, and under what constraint.
3. Evidence source: concept, annotation, rubric line, data source, observation, transcript segment, or policy constraint.
4. Accepted AI/peer/system suggestion.
5. Rejected or modified suggestion.
6. Judgment rationale.
7. Revised artifact state.
8. Transfer constraint or limitation.

## Artifact Families

| Family | Typical courses | Acceptable submissions | Not enough |
| --- | --- | --- | --- |
| Instructional Design Artifact | AIL 606 | storyboard, slide/frame sequence, narration and learner-action table | polished slides with no learner action or evidence |
| Learning Analysis Artifact | AIL 606 | cognitive load diagnosis table, principle-to-problem matrix | generic list of Mayer principles |
| Prototype Evidence Artifact | AIL 606 | README traceability matrix, prototype change log, AI-use disclosure | final screenshot only |
| Ethical Judgment Artifact | CAT 531 | design tension map, policy memo, transcript annotation, stakeholder risk matrix | generic pro/con list |
| Data/Spreadsheet Artifact | CAT 100 | claim-first chart, spreadsheet analysis memo, pivot-table interpretation | chart without a claim or limitation |
| Professional Evidence Artifact | CAT 100 | resume bullet with evidence, portfolio evidence map, GitHub Pages rationale | generic AI-polished resume language |
| Evaluation Artifact | AIL 606/CAT 531 | usability script, observation-to-revision memo, iteration priority table | satisfaction comment only |

## Concrete File and Content Specification

Every Work Product Studio instance now carries `artifact-submission-spec-v1`. The learner-facing rule is: submit an inspectable product file plus a revision trace unless the course-specific artifact family below requires a more specific pair.

| Artifact family | Required files | Accepted formats | Required content sections |
| --- | --- | --- | --- |
| Instructional Design Artifact | `storyboard.(pptx\|pdf\|png)` + `revision-trace.md` | `.pptx`, `.pdf`, `.png`, `.md`, `.docx` | frame id; screen/slide content; narration; learner action; design principle; accessibility note; before/after change |
| Learning Analysis Artifact | `load-diagnosis.(md\|docx\|xlsx\|pdf)` + `revision-trace.md` | `.md`, `.docx`, `.xlsx`, `.csv`, `.pdf` | task/segment; intrinsic load; extraneous load; germane support; evidence source; revision decision |
| Prototype Evidence Artifact | `traceability-matrix.(md\|csv)` + `AI-USE.md` + prototype snapshot/link | `.md`, `.csv`, `.pdf`, `.png`, `.url` | feature/screen; theory/rubric evidence; AI/tool use; accepted change; rejected change; known limitation |
| Ethical Judgment Artifact | `policy-map.(md\|docx\|pdf)` + `evidence-annotation.(md\|csv\|pdf)` | `.md`, `.docx`, `.pdf`, `.csv` | stakeholders; value tension; evidence source; accepted recommendation; rejected risk; boundary condition |
| Data/Spreadsheet Artifact | `data-workbook.(xlsx\|csv)` + `data-story.(md\|pdf\|pptx)` | `.xlsx`, `.csv`, `.md`, `.pdf`, `.pptx`, `.png` | claim-first title; data source; unit; grouping; chart/table; limitation |
| Professional Evidence Artifact | `career-artifact.(pdf\|docx\|md)` + `evidence-map.md` | `.pdf`, `.docx`, `.md`, `.url` | role target; skill claim; evidence artifact; accepted wording; removed overclaim; next verification step |
| Evaluation Artifact | `usability-protocol.(md\|docx\|pdf)` + `observation-table.(csv\|xlsx\|md)` | `.md`, `.docx`, `.pdf`, `.csv`, `.xlsx` | task scenario; participant profile; observed issue; severity; revision decision; remaining evidence gap |
| General Work Product | `artifact.(md\|docx\|pdf\|pptx\|xlsx\|csv\|png)` + `revision-trace.md` | `.md`, `.docx`, `.pdf`, `.pptx`, `.xlsx`, `.csv`, `.png` | artifact claim; evidence source; accepted suggestion; rejected/modified suggestion; revised state; transfer constraint |

These specifications are not only documentation. Runtime telemetry stores `artifact_submission_spec_version`, required files, accepted formats, naming pattern, and required sections with each score-derived artifact trace. The real-data validation export must include these fields before an empirical validation dataset is accepted.

## Why This Definition Matters

ALGET's novelty claim depends on adapting from the learner's artifact-mediated judgment, not from generic engagement. Therefore the system must know what kind of artifact is being submitted and whether the submitted trace provides evidence of claim, constraint, evidence use, AI judgment, revision, and transfer.

## Implementation Link

The runtime taxonomy is implemented in `frontend/src/lib/artifactTaxonomy.js`. Work Product Studio displays the artifact definition and file specification, then logs `artifact_definition_id`, `artifact_family`, and `artifact_submission_spec_version` with every artifact trace.
