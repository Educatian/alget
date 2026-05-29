# alget-adaptive-recommendation (Cloudflare Worker)

Low-latency edge endpoint serving the adaptive support-selection policy. It runs
the **parity-verified** pure policy (`src/policy.ts`, a verbatim copy of the
Supabase edge fn's `policy.ts`, itself a 1:1 mirror of
`backend/knowledge_tracing.py`) at the Cloudflare edge.

## Design (v1)

- **Latency = pure policy compute + return.** No per-request DB reads. The Worker
  accepts the client-sent signals in the request body (the same contract as the
  Supabase edge fn's `index.ts`) and computes the decision in-isolate.
- **Provenance is best-effort and non-blocking.** The only Worker -> Supabase
  interaction is a fire-and-forget `POST` of the decision record to
  `adaptive_decisions`, dispatched via `ctx.waitUntil(...)` so it runs *after*
  the response is sent. A failed/absent write never affects the response. If the
  `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` secrets are unset, the write is
  skipped silently.
- **Faithfulness invariant enforced** before returning: every `reason_code` maps
  to a feature present in `evidence_snapshot` (fail-closed to a faithful state).

### Request

```jsonc
POST /
{
  "learner_id": "...",
  "course": "...",
  "section_id": "...",
  "annotation_adaptive": true,            // optional, default true
  "artifact_revision_scores": [...],      // optional raw signals
  "annotation_signals": [...],            // optional raw signals
  "learner_profile": { ... },             // optional raw signals
  "features": { ... },                    // optional pre-assembled vector (preferred)
  "content_version": "..."                // optional provenance
}
```

### Response (same shape as the Supabase edge fn / FastAPI)

```jsonc
{
  "decision_id": "uuid",
  "selected_action": "explain",
  "candidate_actions": ["explain","represent","practice","advance","ask"],
  "rejected_actions": ["..."],
  "action_scores": { "...": 0.0 },
  "reason_codes": ["..."],
  "evidence_snapshot": { ... },
  "policy_mode": "annotation_adaptive",
  "content_version": "..."
}
```

CORS: `OPTIONS` preflight returns 204; all responses carry
`Access-Control-Allow-Origin` (echoes `Origin`, else `*`), `-Methods POST,OPTIONS`,
`-Headers content-type` (plus authorization/apikey/x-client-info).

## Parity

`src/policy.ts` is a verbatim copy of the Supabase port (do not hand-edit the
logic — parity must be preserved). The Python module
`backend/knowledge_tracing.py` is the source of truth.

```bash
# Regenerate the Python golden if backend logic changed:
python ../../supabase/functions/adaptive-recommendation/parity/gen_golden.py
cp ../../supabase/functions/adaptive-recommendation/parity/golden.json parity/golden.json

# Run the parity check (transpiles src/policy.ts via the frontend's esbuild and
# deep-compares every field to the Python golden over all fixtures):
node parity/run_parity.mjs
```

Current result: **13/13 fixtures IDENTICAL** (CF policy == Python).

## Deploy

```bash
cd cloudflare/adaptive-recommendation

# Validate without deploying:
npx wrangler deploy --dry-run

# Deploy:
npx wrangler deploy

# Set the secrets (NOT stored in wrangler.toml):
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Then point the frontend at the deployed Worker URL by setting
`VITE_ADAPTIVE_WORKER_URL` in the frontend env (see
`frontend/src/lib/apiConfig.js`). When set, `getAdaptiveRecommendation` POSTs to
the Worker first and falls back to the Supabase edge fn (if its flag is on) or
FastAPI on any error/timeout.

## v2 follow-up

DB-side feature mining (mastery reads, telemetry aggregation, misconception
clustering, SM-2 forgetting risk, content-version hashing) is **not** replicated
in the isolate. If per-request learner-state reads are later needed, mine them
edge-side via Hyperdrive/PostgREST so the client cannot shape the inputs. The
Supabase edge fn remains as an alternative deployment target.
