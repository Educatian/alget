# ALGET Content Model

This is the authoring contract for ALGET content. It is an exhaustive prose mirror of the three canonical JSON Schemas in `frontend/content/_schema/` (JSON Schema draft 2020-12). The schemas are the single source of truth; this document explains them so the corpus is authorable by people who are not reading raw schema. If this document and a schema ever disagree, the schema wins and this document is the bug.

Every section is a sibling set of files under `frontend/content/<course>/<chapter>/<section>`:

| File | Schema | Required |
| --- | --- | --- |
| `<section>.mdx` (or `.md`) | none (rendered at runtime) | body content |
| `<section>.meta.json` | `meta.schema.json` | yes |
| `<section>.practice.json` | `practice.schema.json` | yes |
| `<section>.misconceptions.json` | `misconceptions.schema.json` | yes |

`<section>` is the filename stem (for example `01`). The section slug used everywhere as a cross-reference key is `course/chapter/section` (for example `statics/01/01`). All files are UTF-8.

The validator (`scripts/validate_content.py`) enforces both the per-file schemas and additional cross-file and corpus-level rules described in the last two sections. It runs as a blocking CI step (see `CONTRIBUTING.md`).

---

## 1. `meta.json`: Section Meta File

Schema id: `alget://schema/meta.schema.json`. `additionalProperties: true` (extra keys are tolerated, which is how forward-looking keys land before the schema names them).

### The two meta generations

The corpus contains two generations of meta, and the schema accommodates both:

- **Engineering generation** (20 files): carries `course`, `chapter`, and `section` explicitly.
- **Supplement generation** (236 files): those three keys are absent. Backfilling them is a deferred metadata pass.

Because only the supplement generation can lack `course`/`chapter`/`section`, the schema requires **only** `title` (the one key present in every meta today) and validates the rest when present. Do not assume `course`/`chapter`/`section` are present when authoring tooling; derive them from the file path when absent (the backend does this in `content_service.load_section`, which injects the path-derived values into the returned meta).

### Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string (min length 1) | **yes** | Section title. |
| `course` | string | no | Engineering-generation only; path-derived otherwise. |
| `chapter` | string | no | Engineering-generation only; path-derived otherwise. |
| `section` | string | no | Engineering-generation only; path-derived otherwise. |
| `chapter_title` | string | no | Used by `generate_toc` for chapter headings when `section == "01"`. |
| `description` | string | no | Short section summary. |
| `estimated_time_minutes` | number | no | |
| `order` | number | no | Sort key within a chapter. |
| `top_tier_hardened` | boolean | no | Marks a section that passed the quality-hardening pass. |
| `learning_objectives` | array of `{id, statement}` objects | yes by corpus policy | Stable, section-scoped objective IDs used by item-level alignment checks. The schema still accepts legacy strings for migration compatibility, but the validator rejects them in the active corpus. |
| `concept_ids` | array of strings | no | Ids that must exist in `_concepts/registry.json`; these are the cross-section knowledge-tracing keys. |
| `practice_ids` | array of strings | no | Each must reference a real problem id in the sibling practice file (cross-file check, hard error if not). |
| `prereq_section_ids` | array of strings | no (present on all 256 today) | Each is a `course/chapter/section` slug naming a prerequisite section. Used by the backend `_find_concept_origin` remediation route. Must form a DAG (corpus check). |
| `lo_practice_map` | object | yes by corpus policy | Maps every learning-objective ID to one or more real sibling practice IDs. |
| `alignment_method` | string | yes by corpus policy | Records how the mapping was produced and whether instructor review remains necessary. |

---

## 2. `practice.json`: Section Practice File

Schema id: `alget://schema/practice.schema.json`. `additionalProperties: false` at the top level. Required: `problems` (array). Each item is a `problem`.

### Common problem rules

Every problem requires `id` (string, min length 1) and `type` (one of `multiple_choice`, `numeric`, `step_based`, `conceptual`).

Every problem needs a prompt. The prompt is `stem` in the dominant generation and `statement` in the legacy flat-numeric generation, so the schema requires **at least one of** `stem` or `statement` (an `anyOf`). Prefer `stem` for new content.

Every active-corpus problem also carries a non-empty `learning_objective_ids`
array. Each referenced objective must exist in the sibling meta file. A direct-
evidence conceptual item is preferred over falsely mapping an unrelated closed-
response item.

Per-type required fields and accepted keys are layered on top via conditional (`if`/`then`) subschemas keyed on `type`.

### Type: `multiple_choice`

Required: `options`, `correct_index`, `explanation`.

| Field | Type | Notes |
| --- | --- | --- |
| `options` | array of strings, min 2 items | The answer choices. |
| `correct_index` | integer ≥ 0 | Index into `options`. Must be in range (cross-file hard check: `0 <= correct_index < len(options)`). |
| `explanation` | string | Why the correct option is correct. |
| `concept_id` | string | Optional; should exist in the registry. |
| `misconception_id` | string | Optional; should reference an id in the sibling misconceptions file (soft warning if not). |
| `difficulty` | string | Optional. |

### Type: `numeric`

A numeric problem has **two accepted answer shapes**, and at least one must be present (an `anyOf`):

- **Nested `final_answer` (dominant)**: a `final_answer` object (see below).
- **Flat `expected_value` (legacy)**: a top-level `expected_value` number, optionally with `expected_unit`.

Prefer the nested `final_answer` form for new content. Accepted keys:

| Field | Type | Notes |
| --- | --- | --- |
| `final_answer` | object | Dominant answer shape. See `final_answer` below. |
| `expected_value` | number | Legacy flat answer value. |
| `expected_unit` | string | Legacy flat answer unit. |
| `require_unit` | boolean | Whether a unit must be supplied to be marked correct. |
| `tolerance` | number | Acceptable numeric tolerance (legacy flat form). |
| `statement` | string | Prompt (legacy form). |
| `givens` | object | Named given quantities. |
| `params` | object | Parameters consumed by a solver. |
| `solver_id` | string | Names a grader in the `solvers/` registry; must resolve (`assert_content_solver_ids_resolve`). |
| `concept_id` | string | Optional. |
| `difficulty` | string | Optional. |
| `hint` | string | Single hint. |
| `hints` | array of strings | Ordered hints. |

### Type: `step_based`

Required: `steps`, `final_answer`.

| Field | Type | Notes |
| --- | --- | --- |
| `steps` | array, min 1 item | The worked steps. |
| `final_answer` | object | See `final_answer` below. |
| `params` | object | Optional solver parameters. |
| `solver_id` | string | Optional; must resolve in the solver registry when present. |

### Type: `conceptual`

Required: `expected_answer`, `explanation`.

| Field | Type | Notes |
| --- | --- | --- |
| `expected_answer` | string | The target answer (prose). |
| `explanation` | string | Why that answer is correct. |

### The `final_answer` object

Used by `numeric` (nested form) and `step_based`. Required: `value`.

| Field | Type | Notes |
| --- | --- | --- |
| `value` | number **or** string | The answer. |
| `unit` | string | Optional unit. |
| `tolerance` | number | Optional acceptable tolerance. |

### `final_answer` vs `expected_value` (read this)

These are not interchangeable styles for the same generation; they mark two different answer encodings on `numeric` problems:

- `final_answer` is a **nested object** (`{value, unit?, tolerance?}`) and is the **dominant** shape. Use it for new content.
- `expected_value` is a **flat top-level number** paired with optional `expected_unit`/`tolerance`/`require_unit`, and is the **legacy** shape.

A `numeric` problem must satisfy at least one of the two (the `anyOf`). `step_based` problems only use `final_answer` (there is no flat fallback for step-based answers).

---

## 3. `misconceptions.json`: Section Misconceptions File

Schema id: `alget://schema/misconceptions.schema.json`. `additionalProperties: false`. The canonical shape is an **object**, not a bare array:

```json
{ "section_id": "<slug>", "misconceptions": [ ... ] }
```

Required top-level keys: `section_id` and `misconceptions`.

- `section_id`: string matching `^[a-z0-9_]+$` (lowercase alphanumerics and underscores only).
- `misconceptions`: array of misconception items.

A bare top-level array is a **legacy defect and is rejected** by the schema (the loader in `content_service.load_misconceptions` reads it defensively, but the validator flags it so it gets fixed).

### Misconception item

Required: `id` and `rail_action`.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string (min length 1) | Item id. Referenced by `practice.misconception_id`. |
| `rail_action` | string enum | **Required.** One of `explain`, `represent`, `practice`, `ask`. |
| `trigger` | string | Optional. What surfaces the misconception. |
| `pattern` | string | Optional. The error pattern to match. |
| `description` | string | Optional. |
| `feedback` | string | Optional. Coaching text. |

### The `rail_action` contract

`rail_action` is non-optional and must be one of the four allowed values: `explain`, `represent`, `practice`, `ask`. It is the bridge from a detected misconception to a support move: when the grade/feedback loop matches a misconception (`find_misconception`), the rail action tells the system which kind of intervention to route. These four values intentionally align with four of the five support actions emitted by the adaptive policy (`explain` / `represent` / `practice` / `ask`; the policy's fifth action, `advance`, is never an appropriate response to a misconception).

The legacy item variant (`claim` / `reality` / `whyItHappens` / `coachPrompt` with no `rail_action`) is rejected so the validator flags items needing backfill.

---

## 4. The concept registry and prerequisite graph

### Concept registry (`_concepts/`)

`registry.json` holds a single top-level `concepts` array (464 entries today). Each concept is:

```json
{ "id": "...", "label": "...", "description": "...", "courses": ["..."], "related": [] }
```

`id` is the canonical cross-section knowledge-tracing key. `concept_map.json` is a flat alias map (`{ id: canonical_id }`) used to resolve concept references. Any `concept_id` written in a meta or on a practice/misconception item should resolve into this registry.

### Prerequisite graph (`meta.prereq_section_ids`)

Prerequisite relationships are expressed per-section, not in the registry. Each entry in `prereq_section_ids` is a `course/chapter/section` slug naming a section that must come before this one. This is exactly the slug form the backend keys on in `_find_concept_origin` to route a learner back to a prerequisite section. The corpus check requires the graph to be a directed acyclic graph: no entry may be a non-string, reference a nonexistent slug, reference itself, or participate in a cycle (all hard errors).

---

## 5. Validation rules beyond the schemas

`scripts/validate_content.py` runs the per-file schema validation (via `jsonschema`, or a stdlib fallback when it is not installed) and then these additional checks.

**Cross-file (per section):**

- Duplicate problem ids within a practice file, **hard error**.
- `multiple_choice` `correct_index` out of `options` range, **hard error**.
- `meta.practice_ids` referencing a problem id that does not exist in the sibling practice file, **hard error**.
- `practice.misconception_id` referencing an id absent from the sibling misconceptions file, **soft warning**.

**Corpus-level (across sections):**

- Prerequisite graph integrity over `meta.prereq_section_ids`: dangling target, self-reference, non-string entry, and cycle (topological sort): all **hard errors**.
- Constructive-alignment integrity is a **hard check**: every objective must have a stable ID, every problem must reference at least one existing objective, every objective must be assessed, and every `lo_practice_map` target must resolve to a real problem. The checked-in mappings are deterministic first-pass mappings and remain subject to instructor/domain-expert review.

A non-zero exit (any hard error) blocks the merge.

---

## 6. Schema versioning policy

The schemas are draft 2020-12 and identified by `alget://schema/<name>.schema.json`. When a schema must change in a backward-incompatible way (a new required key, a removed field, a tightened type), introduce a versioned namespace (for example `_schema/v1/`) and stamp the version into the `$id`, then point the validator at the new directory and record a one-paragraph migration note here. Additive, backward-compatible changes (a new optional key, a widened `anyOf`) do not require a version bump; document them inline in the table above. The goal is that a 256-section corpus can evolve without a silent break: a content file authored against an older schema version must either still validate or be migrated deliberately, never fail mysteriously.
