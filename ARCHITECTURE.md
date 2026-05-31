# ALGET Architecture

This is the top-level map of ALGET (Adaptive Learning for Generative Engineering Textbooks). It names the layers, the content-model contract, the adaptivity fusion path, and the validation gate that guards every merge. It is the first document a reviewer or new contributor should read.

ALGET sits in the lineage of intelligent-textbook systems (Runestone, OLI Torus, OpenStax `rex-web`, PreTeXt) but adopts their governance and content-rigor patterns rather than their stacks. The conformance rationale, including what is deliberately deferred or rejected, is recorded in `research/CONFORMANCE_PLAN.md`. ALGET's distinguishing contribution is an in-system, artifact-mediated, closed-loop adaptivity that persists a faithful decision provenance record; see `docs/core-beliefs.md` for the values that drive these choices.

Two longer design documents are consolidated, not duplicated, by this file:

- `backend/SYSTEM_DESIGN_HISTORY.md`: the narrative evolution of the system (the bio-inspired pivot, the move from single-prompt to multi-agent orchestration, and the "why" behind each agent). Read it for history and rationale.
- `backend/agents/MULTI_AGENT_GENERATIVE_DESIGN.md`: the generative authoring pipeline (agent roster, personas, orchestration contract).

---

## 1. The three layers

```
  ┌─────────────────────────────────────────────────────────────┐
  │  React / Vite SPA  (frontend/)                                │
  │  - react-router-dom pages: LandingPage, BookLayout, MainApp,  │
  │    StudentDashboard, InstructorDashboard, AnalyticsDashboard, │
  │    DiagnosticAssessment, GenerativeLab                        │
  │  - runtime MDX renderer (react-markdown + remark/rehype) with │
  │    lazy interactive components (InteractiveQuiz, ArtifactStudio│
  │    DynamicScenario, InlineCheck, Glossary, KnowledgeGraph ...) │
  │  - client services in src/lib/ (apiConfig, knowledgeService,  │
  │    loggingService, researchService, socialService, supabase)  │
  └───────────────┬───────────────────────────────┬───────────────┘
                  │ HTTP (REST /api/*)             │ direct SDK
                  ▼                                 ▼
  ┌─────────────────────────────────────────┐  ┌──────────────────┐
  │  FastAPI multi-agent backend (backend/)  │  │  Supabase         │
  │  - server.py: ~40 /api/* routes          │  │  - Postgres +     │
  │  - content_service.py (per-section files)│──┤    REST (PostgREST)│
  │  - knowledge_tracing.py (KT + policy core)│  │  - auth           │
  │  - grading_service.py, solvers/          │  │  - tables/views:  │
  │  - rag_service.py, logic_engine.py       │  │    event_logs,    │
  │  - agents/ (orchestrator + sub-agents)   │  │    adaptive_      │
  └───────────────┬──────────────────────────┘  │    decisions, ... │
                  │ reads                         └──────────────────┘
                  ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  Content layer (frontend/content/)                            │
  │  per-section: <section>.mdx + .meta.json + .practice.json     │
  │               + .misconceptions.json                          │
  │  _schema/   : canonical JSON Schemas (draft 2020-12)          │
  │  _concepts/ : registry.json (464 concepts) + concept_map.json │
  └─────────────────────────────────────────────────────────────┘
```

### React / Vite SPA (`frontend/`)
A single Vite + React 19 SPA. Routing is `react-router-dom`. Reading happens in `pages/BookLayout.jsx`; the section body is authored MDX rendered at runtime with `react-markdown` plus `remark-gfm`, `remark-math`, `rehype-katex`, and `rehype-raw`. Interactive blocks are real React components (not pre-baked HTML): `InteractiveQuiz`, `ArtifactStudio`, `DynamicScenario`, `InlineCheck`, `Glossary`, `KnowledgeGraph`, the per-topic diagram components, and the social-annotation surfaces (`HighlightableContent`, `HighlightDiscussion`). Client-side concerns live in `src/lib/`: API base resolution (`apiConfig.js`), knowledge/telemetry (`knowledgeService.js`), event logging (`loggingService.js`), research instrumentation (`researchService.js`), social annotation (`socialService.js`), and the Supabase client (`supabase.js`).

### FastAPI multi-agent backend (`backend/`)
`server.py` exposes roughly forty `/api/*` routes. They fall into families:

- **Content delivery**: `/api/all-modules`, `/api/book/{course}/toc`, `/api/book/{course}/{chapter}/{section}`, `/api/search/index`, `/api/practice/{practice_id}`. These read per-section files through `content_service.py`.
- **Grading and knowledge tracing**: `/api/grade`, `/api/grade/{problem_id}`, `/api/grade_summary`, `/api/mastery_graph`, `/api/telemetry_fusion`. `grading_service.py` and the `solvers/` registry grade typed practice; `knowledge_tracing.py` holds the BKT-style tracer and the pure support-move policy core.
- **Adaptivity**: `/api/adaptive_recommendation` (POST) and its provenance reads/writes `/api/adaptive_recommendation/{decision_id}` and `.../outcome`. This is the fusion path described in section 3.
- **Generative authoring**: `/api/orchestrate`, `/api/generate`, `/api/generate_assessment`, `/api/practice/generate`, `/api/generate_scenario`, `/api/generate-image`, `/api/explain`, plus the `agents/` orchestrator and sub-agents (engineering, biology, tutor, evaluator, critique, scaffolding, simulation, illustration, curriculum, activity, assessment, practice-generation, validation). See `backend/agents/MULTI_AGENT_GENERATIVE_DESIGN.md`.
- **Assistance and instrumentation**: `/api/assist/explain`, `/api/assist/represent`, `/api/assist/peer_note`, `/api/assist/chat`, `/api/stuck-events`, `/api/log-events`.
- **Research and access**: `/api/research/*` validation/scoring, `/api/access/validate`, `/api/diagnostic/questions/{course_id}`.

### Supabase
Postgres reached over the PostgREST REST API and, from the client, the Supabase JS SDK. Persistence is best-effort and never on the critical path: `_persist_decision_to_supabase` in `server.py` writes the decision record to the `adaptive_decisions` table but swallows backend failures so a persistence outage cannot break a live recommendation. The generic event sink `/api/log-events` writes to `event_logs`. Table and view DDL lives in `backend/supabase_*.sql`.

---

## 2. The content-model contract

Content is authored, not stored in a database. Every section is a sibling set of files under `frontend/content/<course>/<chapter>/<section>`:

| File | Purpose | Schema |
| --- | --- | --- |
| `<section>.mdx` (or `.md`) | The reading body. Prose plus interactive MDX components. | rendered, not schema-gated |
| `<section>.meta.json` | Title, objectives, concept ids, practice ids, ordering, prerequisite edges. | `_schema/meta.schema.json` |
| `<section>.practice.json` | Typed practice problems for the section. | `_schema/practice.schema.json` |
| `<section>.misconceptions.json` | Authored misconceptions with a rail action per item. | `_schema/misconceptions.schema.json` |

Two shared registries live alongside the sections:

- `_schema/`: the three canonical JSON Schemas (draft 2020-12). They are the single source of truth for the authoring contract; `CONTENT_MODEL.md` is the prose mirror of these schemas.
- `_concepts/`: `registry.json` (464 canonical concepts, each `{id, label, description, courses, related}`) and `concept_map.json` (an id alias map). Concept ids in `meta.concept_ids` and on practice/misconception items refer into this registry; they are the cross-section knowledge-tracing keys.

The prerequisite graph is expressed per-section in `meta.prereq_section_ids` (present on all 256 sections). Each edge is a slug of the form `course/chapter/section`: exactly the key the backend uses in `_find_concept_origin` to route prerequisite remediation. The validator enforces that this graph is a DAG (no dangling targets, no self-reference, no cycle).

`content_service.py` is the only reader of this layer. `load_section` assembles meta + MDX + practice; `load_misconceptions` and `find_misconception` feed the grade/feedback loop; `generate_toc` builds the table of contents from the directory structure; `collect_referenced_solver_ids` + `assert_content_solver_ids_resolve` guarantee that every `solver_id` referenced by a problem resolves in the `solvers/` registry, so a problem can never silently fall through to the wrong grader.

The exhaustive per-type field spec, the two meta generations, and the misconception rail-action contract are documented in `CONTENT_MODEL.md`.

---

## 3. The adaptivity fusion path (faithful decision provenance)

The adaptive contribution is a single, auditable support-move decision that fuses three signal families. The pure policy core lives in `backend/knowledge_tracing.py` (`select_support_move`, `reason_codes_are_faithful`) with no FastAPI or network dependency, so it is unit-testable in isolation. `build_adaptive_recommendation` in `server.py` assembles the feature vector, calls the core, builds the response, and persists the record.

The fused families:

1. **Knowledge-tracing / telemetry state**: per-concept mastery (BKT-style `p_known` / `mastery_score`), practice accuracy, stuck/idle/affect counts, hint and chat signals. Produces features such as `mastery_gap`, `friction_signal`, `forgetting_risk`, `calibration_drift`, `transfer_readiness`.
2. **Scored artifact-revision**: the most recent before/after rubric quality and the after-minus-before delta from `ArtifactStudio`, preferring in-section scores. Produces `artifact_quality`, `artifact_gap`, `artifact_revision_delta`.
3. **Social-annotation**: typed annotations (question / confusion / insight / connection) weighted by whether the annotated quote belongs to the current section. Produces `annotation_friction`, `annotation_momentum`, `annotation_section_overlap`.

These are folded into one `feature_vector`. `select_support_move` applies the support-move weights (honoring the annotation ablation flag used for the RQ4 study), and returns the candidate actions, the selected action (`explain` / `represent` / `practice` / `advance` / `ask`), the rejected actions, and `reason_codes` derived from those same features.

**Faithfulness is enforced, not asserted in prose.** `REASON_CODE_FEATURES` declares which features each reason code is allowed to cite. Before the response is built, `reason_codes_are_faithful(final_reason_codes, evidence_snapshot)` asserts that every emitted reason code maps to at least one feature present in the `evidence_snapshot`. The persisted `decision_record` carries `decision_id`, `policy_mode`, `policy_strategy`, `candidate_actions`, `selected_action`, `rejected_actions`, `action_scores`, `reason_codes`, and the `evidence_snapshot`, plus `outcome`/`accepted` (filled later via `.../outcome`). This is what "faithful decision provenance" means concretely: the persisted evidence-to-decision mapping is honest by construction, no reason code can appear without backing evidence, and the annotation ablation flag genuinely removes annotation-derived codes. Persistence to the `adaptive_decisions` Supabase table is best-effort and off the critical path.

---

## 4. The validation / CI gate

Authored content and the application code are guarded by a blocking CI gate (see `.github/workflows/ci.yml` and `CONTRIBUTING.md`). Malformed content or dangling concept/prerequisite links cannot merge. The gate runs:

- `python scripts/validate_content.py`: validates all 256 sections against the three JSON Schemas and runs cross-file and corpus-level checks (duplicate problem ids, `correct_index` bounds, `practice_ids` and `misconception_id` reference integrity, and the prerequisite-graph DAG check). Uses `jsonschema` when present, otherwise a stdlib fallback validator. Non-zero exit on any hard error.
- `python scripts/lint_boilerplate.py`: fails if machine-generated filler boilerplate survives in any section MDX.
- `python scripts/lint_duplication.py`: bounds practice-stem and misconception duplication across the supplement courses.
- Frontend: `npm ci && npx vitest run && npx eslint src && npx vite build`.
- Browser e2e: Playwright route smoke, accessibility, and annotation -> artifact -> adaptive-rationale workflow checks.
- Backend: `pip install -r backend/requirements.txt && python -m pytest backend/test_eval.py backend/test_misconceptions.py backend/test_support_policy.py backend/test_agent_persona.py backend/test_access_validation.py`.
- Static deploy: `node scripts/verify_static_snapshot.mjs` ensures the committed Pages API snapshot has all 256 sections, TOCs, diagnostics, mastery graphs, concept origins, baked misconceptions, and content-version descriptors.
- Workers: adaptive policy parity plus Cloudflare Worker dry-runs for both `cloudflare/adaptive-recommendation` and `cloudflare/llm-proxy`.

The current baseline is green only when all code, content, browser, static-snapshot, backend, and Worker gates pass. Keeping this gate green is a merge requirement, not a courtesy.
