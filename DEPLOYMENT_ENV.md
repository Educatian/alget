# ALGET release environment

ALGET deploys the static React application to Cloudflare Pages and the dynamic AI, PDF, admin, and adaptation APIs to Cloudflare Workers. Secrets belong in the deployment platform and must never be committed.

## Cloudflare Pages

Build `frontend` with:

```text
npm ci
npm run build
```

Required build variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` or the current publishable-key equivalent
- `VITE_LLM_API_BASE`, when the production Worker URL differs from the application default

Never configure `VITE_E2E_AUTH_BYPASS` in production. The release checker fails when the E2E identity is present in the production bundle.

## Cloudflare Worker

Secrets, configured with `wrangler secret put`:

- `OPENROUTER_API_KEY`
- `ALGET_ADMIN_TOKEN`, optional for server-to-server administration only

Non-secret bindings and variables are declared in `cloudflare/llm-proxy/wrangler.toml`:

- `OPENROUTER_MODEL`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `ADAPTIVE` service binding
- `ADAPTATION_POLICIES` KV binding

## Supabase

Apply tracked migrations in `supabase/migrations` through the normal migration workflow. The administrator control-plane migration is `20260730090000_admin_control_plane.sql` and enables RLS for instructor, course, ingestion, agent-run, and audit tables.

Authorization roles must live in `app_metadata.role`. Do not authorize from user-editable `user_metadata`.

## Release gates

Run from the repository root:

```text
node scripts/release_readiness.mjs
node scripts/verify_static_snapshot.mjs
```

Run from `frontend`:

```text
npm audit --omit=dev --audit-level=high
npm test
npm run lint
npm run build
npm run test:e2e
```

Run from the repository root with Python 3.11:

```text
python -m pytest backend
python scripts/validate_content.py
python scripts/lint_boilerplate.py
python scripts/lint_duplication.py
```

## Production verification

- Application: `https://alget.pages.dev`
- Worker health: `https://alget-llm.jewoong-moon.workers.dev/health`
- Admin authorization: an unauthenticated `/admin/system/summary` request must return `401`
- Adaptation emergency pause: verify from `/admin` → `Adaptation`; the runtime response must report `emergency_paused: true` while paused

See `RELEASE_RUNBOOK.md` for incident response and rollback.
