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

The function uses the service role (function secret) to write `recommendation_decisions` /
`adaptive_decisions` in-region; client reads stay behind RLS. This also closes the prior gap where
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
