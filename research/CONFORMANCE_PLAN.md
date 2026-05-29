# ALGET Conformance Plan

**Role:** conformance lead
**Date:** 2026-05-28
**Question:** Which standards/patterns from four mature OSS intelligent-textbook systems (Runestone `rs`, OLI Torus, OpenStax `rex-web`, PreTeXt) should ALGET adopt to be credible in this lineage, *without* diluting what ALGET already does well?

---

## Executive summary

ALGET is already inside this lineage on the dimensions that matter most: it has canonical JSON Schemas (`frontend/content/_schema/`), a concept registry (`frontend/content/_concepts/`), cross-file + prerequisite-graph validators (`scripts/validate_content.py`), a BKT-ish knowledge tracer (`backend/knowledge_tracing.py`), a multi-signal fusion policy that persists faithful decision provenance (`/api/adaptive_recommendation`), an event sink (`/api/log-events` -> `event_logs`), a client-side search index (`/api/search/index`), and a runtime React/MDX renderer with lazy interactive components (`frontend/src/components/ReadingNarrative.jsx`). Its artifact-centered closed-loop adaptivity is a genuine novelty none of the four references attempt.

The credibility gaps are **not** architectural rewrites. They are (1) **documentation/governance artifacts** the references treat as load-bearing (Torus `ARCHITECTURE.md` + `core-beliefs.md` + `.review/ui.md`; Runestone documented `question_json_schema.md`; PreTeXt single-source grammar), (2) **content-model rigor** ALGET's presentational MDX lacks (PreTeXt semantic blocks, Torus semantic element vocabulary, schema *versioning*), (3) **a few analytics/interaction conventions** that are cheap and high-signal (Runestone dual-write typed answer tables + derived item stats + component registry; rex DOM-attribute analytics attribution + a11y transforms; PreTeXt static+dynamic dual representation), and (4) a **publish/version-pin boundary** (Torus publication snapshots, rex version pinning) that would let ALGET say "this learner's adaptive decision was made against exactly this content version" — directly reinforcing ALGET's own faithful-provenance thesis.

Everything stack-specific (Elixir/Phoenix, XSLT, jQuery widgets, Polylith Docker fleet, ClickHouse/EMR, full LTI surface, rex's imperative-DOM-manager model) is explicitly **deferred or rejected** below, because copying it would regress ALGET's React+MDX runtime model or add ops weight with no payoff at 8 courses / 256 sections.

The recommendations favor **additive-safe** wins first: a documented content-model spec, an `ARCHITECTURE.md`, a versioned schema namespace, an a11y PR gate. The two **structural** items (publication-snapshot boundary; typed-answer + manifest analytics substrate) are framed so they can land incrementally without a runtime rewrite.

---

## Prioritization key

- **P0** — credibility-critical, low cost, mostly additive. Do first.
- **P1** — strengthens the core thesis (content rigor, provenance, analytics) at moderate cost.
- **P2** — valuable maturity signal but larger surface or lower marginal credibility.

Risk: **additive-safe** (new files/docs/columns, no behavior change) / **moderate** (touches a service or schema, backward-compatible) / **structural** (introduces a new boundary or data path).

---

## P0 — credibility-critical, additive

### 1. Add `ARCHITECTURE.md` + a `core-beliefs.md` (Torus pattern)
Torus's `ARCHITECTURE.md`, `docs/design-docs/core-beliefs.md`, and `AGENTS.md` are the first thing a reviewer or contributor reads; they make the authoring-vs-delivery boundary, the attempt model, and the GenAI posture legible. ALGET has rich docs (`SYSTEM_DESIGN_HISTORY.md`, `MULTI_AGENT_GENERATIVE_DESIGN.md`) but no single top-level architecture map that names the layers (React/Vite SPA -> FastAPI multi-agent -> Supabase), the content-model contract, the adaptivity fusion, and the explicit values (artifact-centered, faithful provenance, UDL). This is the single highest-credibility, lowest-risk win.

### 2. Document the content-model spec exhaustively (`CONTENT_MODEL.md`) — Runestone `question_json_schema.md` discipline
Runestone documents its one `question_json` shape per type, exhaustively, with builder defaults + merge logic. ALGET has three schema files but no prose spec describing the per-`type` field map for `practice.json` (the schema already encodes `multiple_choice`/`numeric`/`step_based`/`conceptual` variants), the meta two-generation split, and the misconception `rail_action` contract. A `CONTENT_MODEL.md` that mirrors the schemas in prose (one section per file, per-type field table, the "two generations" caveats already written into the schema `description`s) makes the corpus authorable by others and is a standard mature systems ship.

### 3. Schema version namespace + migration note (Torus `priv/schemas/v0-1-0/` + PreTeXt single-source)
Move `frontend/content/_schema/*.schema.json` under a versioned folder (e.g. `_schema/v1/`) and stamp a `schemaVersion` into the `$id`s, with a one-paragraph migration policy in `CONTENT_MODEL.md`. Torus versions its schema directory precisely so a 256-section corpus can evolve safely; this is additive (validator points at `v1/`) and sets up any future `content_migrator` without committing to one now.

### 4. Accessibility/UDL as an enforced PR checklist (Torus `.review/ui.md`)
ALGET ran a one-time UDL pass. Torus turned a11y into a durable governance gate (`.review/ui.md`: real headings, keyboard/no-traps, visible focus, contrast, no color-only state, alt/caption, reduced-motion, 200% reflow, focus-trapping dialogs, >=44px targets). Commit an ALGET-tailored `.review/ui.md` (or `docs/a11y-review.md`) so the UDL pass becomes a recurring gate rather than a historical artifact. Pure documentation; immediate credibility.

### 5. Build-time fail-loud content validation gate in CI (rex `validateDOMContent` + PreTeXt validate-before-publish)
ALGET already has `validate_content.py` / `lint_boilerplate.py` / `lint_duplication.py`. Wire them as a **blocking CI gate** (documented in `ARCHITECTURE.md`/CONTRIBUTING) so malformed authored content and dangling concept/prereq links cannot ship — exactly rex's "fail loudly before release" and PreTeXt's "validate before publish" stance. The code exists; the missing piece is the documented gate.

---

## P1 — strengthens the core thesis

### 6. Promote a small set of SEMANTIC content nodes (PreTeXt blocks + Torus element vocabulary)
ALGET's MDX is presentational; it already has bespoke components (`InlineCheck`, `InteractiveQuiz`, `ArtifactStudio`, `DynamicScenario`). PreTeXt and Torus both make blocks *semantic* (`definition`/`example`/`callout`/`figure`/`objective`). Introduce a few typed MDX nodes — at minimum `<Definition term concept_id>`, `<Callout purpose>`, `<Figure>` — that carry a `concept_id` linking into the existing registry. This unlocks glossary/knowl linking, "which definitions did learners expand" analytics, and accessible-by-default rendering, and it makes the concept registry actually load-bearing in the prose rather than only in metadata.

### 7. Knowl-style in-place cross-reference expansion (PreTeXt `knowl.js`)
PreTeXt resolves `xref -> xml:id` to inline expandable popups instead of page jumps. Pair this with item 6 and the concept registry: a reference to a concept/definition/figure expands in place. This is a high-value reading-UX pattern that fits ALGET's runtime React tree natively (no DOM mutation needed, unlike rex), and reinforces the registry.

### 8. Eager cross-reference resolution -> typed errors at fetch time (rex `resolveContent`)
rex resolves in-content links into `PageReferenceMap | PageReferenceError` at load. ALGET's `content_service` / search-index path should resolve concept-ids and cross-section links when a section is fetched (or at build), surfacing broken concept/section references as typed errors rather than runtime dead links. This complements `validate_content.py`'s prereq-graph check by extending it to the *runtime* fetch boundary.

### 9. Derived per-item analytics columns (Runestone `difficulty` / `pct_on_first` / `mean_clicks_to_correct`)
Runestone materializes cohort-calibrated item statistics onto the question record so the adaptive policy and authors get fast stats without re-aggregating the event log. ALGET's fusion policy (`knowledge_tracing.py`) and authors would benefit from materialized per-`problem_id` stats (first-attempt correctness, attempt count, mean time) computed from `event_logs` into a small Supabase view/table. Moderate, additive, and directly feeds the existing policy.

### 10. DOM-attribute-driven analytics attribution + declarative event objects (rex)
rex co-locates analytics context with content via `data-analytics-region`/`data-analytics-location` resolved by ancestor walk, and models each event as a declarative object with per-sink payload methods. ALGET's `/api/log-events` writes to one generic `event_logs` table; adopting declarative `region`/`location` attributes on the semantic nodes (item 6) and a small typed event-object layer makes social-annotation and ArtifactStudio interactions instrumented consistently, and keeps the door open for a second sink without rewriting handlers.

### 11. Static + dynamic dual representation for interactives (PreTeXt)
Every PreTeXt gradable item compiles to a static (print/Braille/screen-reader) form *and* a dynamic graded form. ALGET's `InteractiveQuiz` / `ArtifactStudio` / `DynamicScenario` should each guarantee a degraded-but-faithful static rendering (the schema already carries `stem`/`statement`/`explanation`/`expected_answer` for every practice type). This is a concrete UDL deliverable and an offline/print/no-JS fallback. ALGET already has `MarkdownBlockFallback`; formalize it as a contract.

### 12. SM-2 spaced-repetition tied to section completion as a SECOND interpretable signal (Runestone)
Runestone auto-enrolls a section's concepts into an SM-2 review schedule on completion — a transparent, explainable scheduler with no opaque model. ALGET's fusion policy already names `forgetting_risk`/`retrieval_risk` reason codes; adding an explicit SM-2 schedule per `concept_id` (keyed off section completion) gives that signal a principled, auditable source that complements the BKT-ish tracer rather than replacing it. Borrow the SM-2 *math* only (the reference flags Runestone's web2py implementation as debt).

---

## P2 — maturity signals, larger surface

### 13. Component/assessment registry via self-registration (Runestone decorator + Torus `manifest.json`)
Runestone's `register_answer_table` + `EVENT2TABLE` and Torus's per-activity `manifest.json` + Authoring/Delivery contract both make new interactive types plug into grading/logging without editing a dispatcher. ALGET keeps adding interactive types (diagrams, quizzes, ArtifactStudio); a lightweight registry (a manifest per component type declaring its schema, grader, and event shape, consumed by `grading_service` and the renderer) would let new types register rather than be hard-wired. Moderate-to-structural; do after items 6/10/11 establish the node/event contracts.

### 14. Publication-snapshot + content version pinning (Torus Resource/Revision/Publication; rex version pinning)
ALGET serves sections live from disk via `/api/book/...`; there is no frozen-publication boundary. A publish step that snapshots the content tree to an immutable, versioned publication that delivery references would give reproducible reading sessions, A/B-stable cohorts, clean rollback, and — most importantly for ALGET — let each adaptive-decision provenance record reference the exact content version it was made against. This is the single most thesis-reinforcing structural item, but it is genuinely structural (new boundary between author-on-disk and runtime-ingest), so it is P2 and staged: start by stamping a content-version hash into the decision provenance record (additive), then introduce the snapshot boundary later.

### 15. Typed per-type answer tables alongside the generic event firehose (Runestone dual-write)
Runestone logs every interaction to a generic `useinfo` table AND to typed per-question-type answer tables, giving both a cheap research firehose and structured gradeable records. ALGET has only the generic `event_logs`. Adding typed answer rows (per practice `type`) for graded submissions makes item analysis and honest knowledge-tracing first-class. Heed the reference's warnings: use **structured JSON fields not delimited strings**, key on **stable surrogate ids not mutable names**, and design **partitioning/retention** for the firehose from the start. Structural; sequence after item 9.

### 16. Build-time analytics manifest mapping content -> stable interaction ids (PreTeXt `runestone-manifest.xml`; Torus ingest manifests)
PreTeXt emits a manifest mapping divisions->pages and exercises->tracked question ids so the analytics layer never parses content. ALGET should mint stable interaction ids at build time (decoupled from human-editable section/problem names — the references repeatedly flag mutable-name keys as a defect) into a manifest that the KT/recommendation layer consumes. Pairs with items 14/15. Moderate-to-structural.

### 17. Prerender + hydrate for public reading surfaces (rex `script/prerender`)
rex prerenders every page for SEO/first-paint then hydrates. ALGET is runtime-fetch-only. Worth planning for *public/marketing* reading surfaces on the Vite/React stack (do **not** copy rex's Concourse/CORGI infra). Lowest marginal credibility for an authenticated adaptive app; P2.

---

## Deferred / rejected (with why)

- **Elixir/Phoenix/LiveView + clustered Erlang/Oban/Cachex (Torus runtime).** Adopt the *patterns* (publication snapshots, attempt hierarchy, render contract), never the runtime. ALGET is React+Vite / FastAPI / Supabase; porting BEAM is a rewrite with no payoff.
- **XSLT 1.0 transformation engine + XML authoring surface (PreTeXt).** ~70 hand-maintained stylesheets and verbose strict-ordering XML conflict with ALGET's MDX+JSON ergonomics and runtime remark/rehype rendering. Keep MDX/JSON; borrow only the semantic-block *idea* (item 6) and validate-before-publish stance.
- **jQuery + server-rendered `htmlsrc` widgets and storing rendered HTML in the DB (Runestone).** Regressing from ALGET's typed React/MDX runtime render to HTML blobs couples content to a renderer version and bloats storage. Keep source-only, render on the client.
- **rex's class-component + imperative-DOM-manager model (`dangerouslySetInnerHTML` + WeakMap listeners + run-id guards + bespoke DOM "managers").** It exists only because rex consumes opaque pre-baked HTML. ALGET renders a real React tree, so highlighting/search/anchoring belong in React/DOM-range space. Borrow the *a11y transform intent* (item 11) and *await-layout-before-positioning* idea, not the architecture.
- **Full LTI 1.3 AGS grade-passback + multi-tenant institution model (Runestone/Torus).** Large, security-sensitive subsystem. Defer until ALGET actually needs LMS launch; revisit as an interoperability boundary only then.
- **Heavyweight analytics ops: ClickHouse, EMR Serverless, S3 xAPI pipeline, AppSignal (Torus).** Premature at 8 courses / 256 sections. Adopt the *conceptual* dual-path (operational Supabase tables vs an event firehose with retention) — items 9/15 — not the big-data stack.
- **Delegating adaptivity/experimentation to an external platform (PreTeXt->Runestone; Torus->UpGrade).** ALGET's whole thesis is *in-system* closed-loop adaptivity with faithful provenance. Do not outsource it. Borrow only the manifest/id discipline (item 16) and the *idea* of serializing content-alternatives for experimentation — never hard-code UpGrade's payload shape.
- **Polylith components/bases/projects Docker fleet (Runestone) / many Phoenix-embedded React micro-apps (Torus).** ALGET's single React+Vite SPA + service-separated FastAPI is simpler and appropriate at this scale. The *spirit* (separate reusable domain components from API surfaces) is already partly realized in `backend/`; do not fragment the UI to mirror a server-rendered shell.
- **Two-backend content split (rex archive API + OSWeb CMS) and the slug/uuid/archiveOverride/CORGI resolution machinery.** ALGET's single FastAPI `content_service` reading per-section files is sufficient. Borrow only the *idea* of version pinning (item 14), not the dual-source plumbing.
- **PDF/LaTeX/EPUB/Braille/Jupyter/Sage/WeBWorK/MyOpenMath/STACK print-fidelity machinery and the ~5900-line monolithic `lib/pretext.py` orchestrator.** Out of scope for a web-first React reading app with its own ArtifactStudio/solver stack; keep modules small and bounded (ALGET already does).
- **Treating static formative practice as the assessment ceiling (rex correctness-0.0/1.0, no tracing).** That non-adaptive model is exactly the gap ALGET fills; do not mirror it as a target.
