# Summer 2026 ALGET Course Redevelopment Gap Report

    This report documents the redevelopment pass requested for AIL606, CAT531, and CAT100 supplemental learning materials.

    ## Expansion Target

    - Existing ALGET content before this pass: 64 sections.
    - New supplement content generated in this pass: 192 sections.
    - Resulting section count target: 256 sections, or 4x the previous section count.
    - Each new section includes a narrative `.mdx`, `.meta.json`, `.practice.json`, and `.misconceptions.json`.
    - Each module includes a renderable SVG visual anchor plus an imagegen2 prompt for a final raster replacement.

    ## Cross-Course Gap Findings

    | Course | New Sections | Redevelopment Rationale |
    | --- | ---: | --- |
    | AIL 606 | 64 | Compared against the Summer 2026 AIL-606 schedule and the existing ALGET instructional-design track, the missing layer was not theory coverage; it was a full scaffold from principle selection to prototype evidence, toolchain disclosure, and usability testing. |
| CAT 531 | 64 | Compared against the CAT-531 Option A redesign, the new ALGET layer adds decision rehearsal, explicit cross-links among DTS, TeachGen@i, Ethobot, and assessment artifacts, plus more frequent concept checks than the Blackboard shell can comfortably hold. |
| CAT 100 | 64 | Compared against the CAT-100 Summer 2026 shell, the missing layer was a richer step-by-step practice sequence: more worked examples, AI critique checkpoints, and low-stakes self-checks around digital citizenship, resumes, Excel data stories, teacher-AI conversations, presentations, and GitHub Pages portfolios. |

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
