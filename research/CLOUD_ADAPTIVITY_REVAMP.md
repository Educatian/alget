# Cloud Edge Adaptivity Revamp

Goal: make the adaptive support-selection respond faster (sub-100ms typical) by moving the **pure
decision policy** off the FastAPI roundtrip to a cloud edge function co-located with the database,
while keeping the heavy/LLM work in FastAPI.

## Why the current path is slow

Today: `frontend -> FastAPI (/api/adaptive_recommendation, hosted on Render) -> reads learner state +
runs the pure policy + persists provenance to Supabase -> returns`. Latency = (browser to Render) +
(Render cold/warm compute) + (Render to Supabase region roundtrip). The actual decision is pure,
cheap computation on a feature vector; almost all the latency is network hops and a non-co-located DB.

## Decision: Supabase Edge Function (Deno/TS), co-located with Postgres

The policy reads learner state (knowledge-tracing mastery, recent events, scored artifact-revision
features, social-annotation signals) and writes a decision-provenance record. Co-locating the compute
with the data is the biggest win, so a **Supabase Edge Function** (Deno, runs in the DB region) beats a
generic worker that would still round-trip to Postgres. The frontend already ships the Supabase client,
so it can call the function directly with no extra auth plumbing.

- **Edge owns** (latency-critical, pure): assemble the feature vector from in-region reads, run
  `select_support_move` (ported 1:1 from `backend/knowledge_tracing.py`), derive faithful `reason_codes`,
  persist the decision record (candidate / selected / rejected actions, evidence_snapshot, reason_codes,
  policy_mode, content_version hash) and return `{decision, decision_id}`.
- **FastAPI keeps** (heavy, not latency-critical): LLM scaffolding/tutor/evaluator generation, content
  serving, grading with solvers. Also stays as a **fallback** if the edge function is unavailable.

## Contract (unchanged from the FastAPI endpoint, so it is a drop-in)

Request: `{ learner_id, course, section_id, annotation_adaptive?, artifact_revision_scores?,
annotation_signals? }`. Response: `{ decision_id, selected_action, candidate_actions, rejected_actions,
reason_codes, evidence_snapshot, policy_mode, content_version }`. A separate
`POST .../outcome` attaches accepted/outcome labels (already exists in FastAPI; mirror on edge).

## Port + correctness

- `select_support_move`, the feature assembly, `derive_reason_codes`, and `reason_codes_are_faithful`
  are PURE functions -> a near 1:1 TypeScript port. Add a **parity test**: run the Python policy and the
  TS policy over the same fixtures and assert identical selected_action + reason_codes (golden file
  checked into `research/`). This guarantees the edge revamp does not change behavior, only latency.
- Preserve the **faithfulness invariant** (every reason_code maps to a feature in evidence_snapshot) and
  the **RQ4 `annotation_adaptive` ablation flag**.

## Provenance + RLS

The function uses the service role (function secret) to write `recommendation_decisions`
in-region; client reads stay behind RLS. This also closes the prior gap where
client-side upsert could drop provenance: every served decision is persisted server(edge)-side at
generation time.

## Caching

Static per-section features (concept_ids, difficulty, prereq edges) are stable per content version, so
cache them in the isolate keyed by `content_version` hash (added in the conformance pass); a new version
invalidates. Learner-state reads stay live.

## Rollout (safe, reversible)

1. Land the in-flight backend policy upgrade (SM-2, richer feedback) first; port that FINAL logic.
2. Add `supabase/functions/adaptive-recommendation/` (Deno) + deploy via `supabase functions deploy`.
3. Frontend: a `VITE_ADAPTIVE_EDGE` flag in `apiConfig`/`knowledgeService` routes adaptivity to the edge,
   with automatic fallback to the FastAPI endpoint on error/timeout.
4. Verify parity (golden fixtures) + measure latency, then default the flag on.

## Out of scope (per CONFORMANCE_PLAN deferrals)

No external A/B platform, no ClickHouse/EMR analytics ops; the closed loop + provenance stay in-system.
The edge function is the in-system policy, just relocated for speed.

## Implementation notes (v1 shipped)

### What landed

- `supabase/functions/adaptive-recommendation/policy.ts` — a faithful 1:1 TypeScript port of the PURE
  core of `backend/knowledge_tracing.py` (`SUPPORT_ACTIONS`, `REASON_CODE_FEATURES`,
  `ANNOTATION_REASON_CODES`, `ANNOTATION_FEATURES`, `_clamp`/`_feature`, `score_support_actions`,
  `derive_reason_codes`, `reason_codes_are_faithful`, `select_support_move`). Identical thresholds,
  tie-breaking order, and the `annotation_adaptive` ablation behavior. **Python remains the source of
  truth — never hand-edit the policy logic here without re-running the parity test.**
  - One subtlety: Python's `round(x, 3)` rounds the *exact binary* value half-to-even. A naive JS
    `Math.round(x*1000)/1000` diverges on exact halves (e.g. `0.6045` → 0.605, `0.2095` → 0.209). The
    port implements `_roundPy` over a high-precision (`toFixed(20)`) decimal expansion so rounded
    `action_scores` match Python bit-for-bit. This was the only non-mechanical part of the port.
- `supabase/functions/adaptive-recommendation/index.ts` — the edge function (`Deno.serve`). Accepts the
  same request contract `{ learner_id, course, section_id, annotation_adaptive?,
  artifact_revision_scores?, annotation_signals?, learner_profile? }` (plus optional pre-assembled
  `features`, `prefer_advance`/`readiness`, `content_version`), runs `select_support_move`, generates a
  `decision_id` via `crypto.randomUUID()`, **best-effort** persists the decision record (candidate /
  selected / rejected actions, `action_scores`, `evidence_snapshot`, `reason_codes`, `policy_mode`,
  `content_version`) to `recommendation_decisions` via the service role (`SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY` from `Deno.env`), enforces the faithfulness invariant before returning,
  and returns the same response shape incl. `decision_id`. Persistence never throws to the caller.
- `supabase/functions/adaptive-recommendation/parity/` — `fixtures.json` (13 diverse vectors varying
  mastery_gap, friction, artifact quality/gap, annotation overlap, prefer_advance, and
  `annotation_adaptive` on/off), `gen_golden.py` (imports `backend.knowledge_tracing.select_support_move`
  and emits `golden.json`), `run_parity.mjs` (runs the TS policy over the same fixtures and deep-compares
  every field), and `run_parity.sh` (the one-shot runner). **Result: 13/13 PASS — TS == Python on all
  fixtures** (`selected_action`, `rejected_actions`, `reason_codes`, `action_scores`, `evidence_snapshot`,
  `policy_mode`).
- Frontend: `frontend/src/lib/apiConfig.js` exports `ADAPTIVE_EDGE_FUNCTION` and `isAdaptiveEdgeEnabled()`
  (`VITE_ADAPTIVE_EDGE` flag, OFF by default). `frontend/src/lib/adaptiveClient.js` exposes
  `getAdaptiveRecommendation(payload, opts)` — when the flag is truthy and Supabase is configured it calls
  `supabase.functions.invoke('adaptive-recommendation', { body })` with a timeout (default 2500ms) and on
  **any** error/timeout falls back to `POST ${API_BASE}/adaptive_recommendation`. Returns
  `{ data, error, source }` where `source` is `'edge'` or `'fastapi'`.

### Switching a caller to the edge path

Existing FastAPI callers are untouched. To migrate one, replace the direct
`fetch(\`${API_BASE}/adaptive_recommendation\`, ...)` with:

```js
import { getAdaptiveRecommendation } from '../lib/adaptiveClient'
const { data, error, source } = await getAdaptiveRecommendation(payload)
```

Set `VITE_ADAPTIVE_EDGE=1` in the frontend env to enable edge routing; unset to revert instantly.

### Running the parity check

```bash
bash supabase/functions/adaptive-recommendation/parity/run_parity.sh
```

It generates the Python golden file, transpiles `policy.ts` to ESM (via the frontend's bundled
`esbuild`; uses `deno check` first if Deno is present), and asserts TS == Python on every fixture.

### Deploy

```bash
# from repo root, with the Supabase CLI logged in + project linked
supabase functions deploy adaptive-recommendation

# set the function secrets (service role is in-region, behind the function only)
supabase secrets set SUPABASE_URL="https://<project-ref>.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
```

Then set `VITE_ADAPTIVE_EDGE=1` in the frontend deploy env and ship. Verify parity (above) and measure
latency before defaulting the flag on.

### Deferred to v2

- **DB-side feature mining.** v1 trusts the assembled signals the client already sends (the
  post-feature-gather feature vector, or the raw `learner_profile` / `annotation_signals` /
  `artifact_revision_scores` that `assembleFeatures` folds into it). The full server-side mining the
  FastAPI path does (mastery reads, telemetry aggregation, misconception clustering, SM-2
  `forgetting_risk` from review history, content-version hashing) is **not** replicated in the isolate
  yet. v2 should read learner state in-region and compute the vector edge-side so the client cannot
  shape the inputs.
- Per-section static-feature caching keyed by `content_version` (isolate-level), per the Caching section.
- The `.../outcome` label-attach endpoint mirrored on the edge.

## Cloudflare Worker (v1 shipped)

A second, even-lower-latency deployment target landed alongside the Supabase edge fn: a Cloudflare
Worker that serves the SAME parity-verified policy from Cloudflare's global edge. The Supabase edge fn
**remains as an alternative**; both run identical decision logic.

### Design (client-signal v1, best-effort write)

- `cloudflare/adaptive-recommendation/src/policy.ts` is a **verbatim copy** of the parity-verified
  Supabase `policy.ts` (do NOT hand-edit the logic — parity must be preserved; Python remains the source
  of truth at `backend/knowledge_tracing.py`).
- `cloudflare/adaptive-recommendation/src/index.ts` is the Worker
  (`export default { async fetch(request, env, ctx) {...} }`). It accepts the same client-sent request
  contract as the Supabase `index.ts` (`learner_id, course, section_id, annotation_adaptive?,
  artifact_revision_scores?, annotation_signals?, learner_profile?, features?, content_version?`), runs
  the identical `assembleFeatures` -> `select_support_move`, generates `decision_id` via
  `crypto.randomUUID()`, enforces the faithfulness invariant, and returns the same response shape
  (`decision_id, selected_action, candidate_actions, rejected_actions, action_scores, reason_codes,
  evidence_snapshot, policy_mode, content_version`).
- **Latency = pure policy compute + return.** There are NO per-request DB reads. The ONLY Worker ->
  Supabase interaction is a **best-effort, fire-and-forget provenance WRITE** of the decision record to
  `${SUPABASE_URL}/rest/v1/recommendation_decisions` (apikey + `Authorization: Bearer <service role>`,
  `Prefer: return=minimal`), dispatched via `ctx.waitUntil(...)` so it runs AFTER the response is sent.
  Wrapped in try/catch; a failed write NEVER affects the response, and if `SUPABASE_URL` /
  `SUPABASE_SERVICE_ROLE_KEY` are unset the write is skipped silently.
- CORS: `OPTIONS` preflight -> 204; all responses carry `Access-Control-Allow-Origin` (echoes `Origin`,
  else `*`), `-Methods POST,OPTIONS`, `-Headers content-type`.
- `wrangler.toml` sets `name = "alget-adaptive-recommendation"` and a `compatibility_date`; **no secrets**
  live in it (secrets are set via `wrangler secret put`).

### Parity (Cloudflare Worker == Python)

`cloudflare/adaptive-recommendation/parity/` holds copies of `fixtures.json` + `golden.json` and a Node
runner `run_parity.mjs` that transpiles the Worker's `src/policy.ts` via the frontend's bundled `esbuild`
and deep-compares every field to the Python golden. **Result: 13/13 fixtures IDENTICAL.** Regenerate the
golden with the existing `supabase/functions/adaptive-recommendation/parity/gen_golden.py` if backend
logic changes, then re-copy + re-run.

```bash
node cloudflare/adaptive-recommendation/parity/run_parity.mjs
```

### Deploy

```bash
cd cloudflare/adaptive-recommendation
npx wrangler deploy
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

### Point the frontend at the Worker

`frontend/src/lib/apiConfig.js` exports `ADAPTIVE_WORKER_URL` (`VITE_ADAPTIVE_WORKER_URL`) and
`isAdaptiveWorkerEnabled()`. In `frontend/src/lib/adaptiveClient.js`, `getAdaptiveRecommendation` POSTs to
the Worker (plain `fetch` with a timeout, default 2500ms) when the URL is set, and on ANY error/timeout
falls back to the Supabase edge fn (if `VITE_ADAPTIVE_EDGE` is on) then FastAPI. It returns
`{ data, error, source }` where `source` is `'worker' | 'edge' | 'fastapi'`. When `VITE_ADAPTIVE_WORKER_URL`
is unset, behavior is unchanged. Set it to the deployed Worker URL to route adaptivity to the edge.

### v2 follow-up

Same as the Supabase deferral: **DB-side feature mining** (mastery reads, telemetry aggregation,
misconception clustering, SM-2 `forgetting_risk`, content-version hashing). If per-request learner-state
reads are later needed from the Worker, mine them edge-side via **Hyperdrive / PostgREST** so the client
cannot shape the inputs. The Supabase edge fn stays as an alternative deployment.
