# ALGET Content Guide

> Canonical corpus snapshot: 2026-07-30

ALGET contains eight adaptive textbook pathways. Counts are generated from the
MDX corpus by `scripts/generate_content_manifest.mjs`; the app imports the
generated manifest so catalog claims cannot drift from deployable content.

## Corpus summary

| Course | Chapters | Sections | Track |
| --- | ---: | ---: | --- |
| Engineering Statics | 6 | 14 | Engineering |
| ME 201: Engineering Dynamics | 3 | 11 | Engineering |
| Bio-Inspired Design | 8 | 10 | Engineering |
| Foundation of Instructional Design | 8 | 17 | Education |
| AI and Ethics | 6 | 12 | Education |
| AIL 606 Software Technology Supplement | 8 | 64 | Education |
| CAT 531 Technology and Teaching Supplement | 8 | 64 | Education |
| CAT 100 Computer Concepts Supplement | 8 | 64 | Education |
| **Total** | **55** | **256** | — |

## Section contract

Each section lives under `frontend/content/<course>/<chapter>/` as four sibling
files:

- `<section>.mdx`: narrative, worked examples, visuals, and inline interactions.
- `<section>.meta.json`: title, stable learning-objective IDs, concepts,
  prerequisites, practice IDs, and the objective-to-practice map.
- `<section>.practice.json`: closed and open-response evidence items. Every item
  carries one or more `learning_objective_ids`.
- `<section>.misconceptions.json`: misconception patterns and adaptive rail action.

The current corpus contains 1,002 explicit learning objectives and 1,131
practice items. When no existing closed-response item adequately samples an
objective, the alignment migration adds a direct-evidence conceptual prompt
instead of claiming a false mapping.

## Authoring and quality commands

```powershell
python scripts\validate_content.py
python scripts\lint_boilerplate.py
python scripts\content_census.py
node scripts\generate_content_manifest.mjs
python scripts\generate_reference_figures.py
node scripts\verify_static_snapshot.mjs
```

`validate_content.py` blocks missing or dangling learning-objective links,
unassessed objectives, invalid practice IDs, broken misconception references,
and invalid prerequisite graphs. Generated alignment is explicitly marked for
instructor review in each meta file; automation establishes traceability but
does not replace domain-expert judgment.

## Reference-image policy

- Every section must include at least one instructional visual: a semantic
  reference figure, a dedicated concept diagram, a simulation, or an
  instructional video.
- Images must be organizational or explanative and explicitly support a
  learning objective. Decorative stock imagery is not part of the textbook
  visual standard.
- Project-authored images use `<figure-block>` so the rendered page has a real
  `<figure>`/`<figcaption>` relationship, descriptive alt text, a nearby
  instructional caption, visual purpose, source, and license.
- `frontend/public/course-art/reference-manifest.json` records objective links,
  concept IDs, provenance, licensing, and SHA-256 integrity hashes.
- Existing dedicated diagrams are retained instead of adding a redundant
  overview graphic. Missing visual coverage is blocked by
  `scripts/release_readiness.mjs`.

See `research/REFERENCE_IMAGE_AUDIT.md` for course-level coverage.

## Citation policy

- Use resolvable identifiers that match the cited title, author, year, and
  edition; a resolving DOI attached to the wrong work is still an error.
- Prefer primary or peer-reviewed sources for factual claims.
- Record hypothetical scenario numbers as illustrative rather than empirical.
- Run the citation-integrity check before an official course publication.

See `CONTENT_MODEL.md` for the schema-level contract and
`research/CONTENT_VERIFICATION.md` for the trust audit history.
