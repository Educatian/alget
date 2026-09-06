# ALGET runtime contract

Status: implementation contract, 2026-09-04
Owner: ALGET application repository

This contract names the owner of each runtime path so a successful HTTP status
cannot be mistaken for a connected feature. It preserves the existing
Cloudflare Pages + Cloudflare Worker split; it does not migrate services.

## Content-to-evidence path

```text
Authored MDX / faculty-approved published module
        │
        ├─ Pages static JSON: /api/book/{course}/toc and /{chapter}/{section}
        │       │
        │       └─ ReadingPane → ReadingNarrative → quiz / sequence / branch /
        │          dynamic scenario / artifact studio
        │                         │
        │                         ├─ learner evidence (scores, choices, traces)
        │                         └─ LLM_API_BASE → Cloudflare Worker
        │                              (tutor, RAG assessment, grading,
        │                               artifact validation, adaptive policy)
        │
        └─ Supabase (RLS): mastery, progress, event_logs,
           interaction_events, artifact_revision_scores
                                      │
                                      └─ allow-listed pilot/export views
```

The reader now validates both response content type and payload shape. A Pages
SPA HTML fallback with status 200 is reported as unavailable content rather
than being parsed as a table of contents or section.

## Endpoint ownership and environment

| Concern | Browser variable / default | Owner | Contract |
|---|---|---|---|
| Authored TOC and sections | `VITE_API_BASE` / `/api` | Cloudflare Pages static assets | JSON with `chapters[]` or `{meta, content}` |
| Dynamic AI, grading, validation | `VITE_LLM_API_BASE` / production Worker URL | `alget-llm` Worker | JSON POST; no Pages fallback |
| Adaptive policy | `VITE_ADAPTIVE_WORKER_URL` (optional) or service binding | adaptive Worker | bounded recommendation; learner/instructor gate remains |
| Identity and learner evidence | Supabase client variables | Supabase + RLS | owner-scoped rows and approved export views |
| Browser unload telemetry | `LLM_API_BASE/log-events` | `alget-llm` Worker | bearer token in beacon body; Worker env supplies Supabase URL/key |

Worker vars/secrets are `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, and the existing adaptive bindings.
The unload relay never trusts a Supabase URL or key supplied by the browser.
It accepts at most 500 valid UUID-scoped events, strips known free-text keys,
persists `event_logs`, and best-effort mirrors `interaction_events`.
The client-side `buildUnloadBeaconPayload()` helper is bounded and excludes
Supabase configuration; the Worker remains the sanitizer and RLS boundary.

Legacy `vercel.json` and Render files remain in the repository for historical
rollback context. They are not the release owner; a release must verify the
Pages and Worker URLs above.

## Familiar LMS exemplar: `inst-design/02/08`

“Online & Distance Learning Design” is the current closest LMS-familiar module.
Its objectives cover Moore's interaction types, Community of Inquiry presence,
and async/sync/hybrid choice. Its MDX activities map to the following evidence
contract:

| Learning move | Learner action | Event / proxy | Qualitative bridge |
|---|---|---|---|
| Compare interaction modes | reorder or match concepts | `sequence_check` with correctness counts | exit ticket: why this mode fits |
| Decide under constraints | choose a branch | `branch_choice` with node/index/depth | reflection on trade-off |
| Apply to a realistic case | choose a curated scenario move | `dynamic_scenario_choice` | explanation of the selected move |
| Retrieve and calibrate | answer inline/quiz item | existing `problem_attempt`, confidence, misconception | learner explanation / revision |
| Revise a work product | submit claim/evidence/revision trace | `artifact_studio_trace`, score-derived mirror | before/after judgment rationale |

The new events deliberately exclude prompt, label, answer, and feedback text.
They identify the learning move, not a latent ability or emotional state.

## Agentic loop boundary

BigAL receives section context plus recent history, diagnoses a likely missing
step, escalates a hint ladder, and ends with a check question. The student
dashboard adds a learner-controlled analytics explanation loop: the student
asks a question about derived evidence, sees the evidence limitations, and
chooses whether to open the suggested concept. If the Worker is unavailable,
the UI provides a clearly labelled local evidence cue. No agent autonomously
publishes, messages a learner, or assigns a final grade.

Faculty Google Docs/PDF imports stay in shadow review. Human approval is
required before `published_course_modules` makes a generated runtime visible;
the published module carries tutor, analytics, and social configuration.

## Release verification

1. Generate and review static snapshots; deploy the Worker before Pages.
2. Check live `content_version` for the intended release (local snapshots may
   be newer than the live site).
3. Smoke-test Pages JSON, Worker `/health`, `/agentic/tools`, tutor/assessment,
   and `/log-events` with a test Supabase session.
4. Run frontend tests, Worker tests, snapshot verification, release readiness,
   and adaptive parity before enabling a class. The unload-specific gates are
   `frontend/src/lib/loggingService.test.js` and
   `cloudflare/llm-proxy/src/log-events.test.mjs`.
5. Keep research mode and the Bio-Inspired RCT assignment contract separate
   from an ordinary LMS class.
