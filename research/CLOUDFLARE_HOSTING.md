# Cloudflare Hosting

ALGET is hosted on Cloudflare with no Python backend in the request path.

## Live URLs
- **App (Cloudflare Pages):** https://alget.pages.dev
- **Adaptive engine (Cloudflare Worker):** https://alget-adaptive-recommendation.jewoong-moon.workers.dev

## Architecture
- **Frontend → Cloudflare Pages.** Vite SPA built and deployed via `wrangler pages deploy dist`.
- **Reading content → static JSON.** The FastAPI `/api/book/*` GET endpoints are deterministic file reads, so they are
  snapshotted to static JSON under `frontend/public/api/` (`scripts/export_static_content.mjs`, run against a live backend).
  Pages serves them directly; the client `fetch(...).json()` parses them regardless of content-type. Covers all 8 course
  TOCs, 256 sections, diagnostics, and the search index. Each section snapshot carries a `content_version` descriptor so
  hosted adaptive decisions can be tied back to the exact authored MDX/meta/practice/misconception substrates.
- **Adaptivity → Cloudflare Worker.** `cloudflare/adaptive-recommendation/` (parity-verified policy port). The frontend
  routes to it via `VITE_ADAPTIVE_WORKER_URL` with a FastAPI fallback.
- **SPA routing:** `frontend/public/_redirects` (`/* /index.html 200`); existing static files (incl. `/api/*`) are served
  before the fallback.
- **Auth:** "Continue in Demo Mode" persists a local demo session (`alget_demo_session`) so the hosted demo survives
  reloads and direct section URLs.

## Build + deploy
```
# 1. (when content changes) refresh the static content snapshot from a live backend:
#    backend on :8000, then
node scripts/export_static_content.mjs
node scripts/bake_indexes.mjs
python scripts/bake_grading_data.py
node scripts/verify_static_snapshot.mjs

# 2. build the frontend for Cloudflare (env in frontend/.env.production, NOT the shell:
#    Git Bash mangles a leading-slash VITE_API_BASE into a Windows path):
cd frontend && npx vite build

# 3. deploy
npx wrangler pages deploy dist --project-name=alget --branch=main
cd ../cloudflare/adaptive-recommendation && npx wrangler deploy
```

## Known limitations (v1)
- **Backend-dependent POST features degrade gracefully** (no Python backend in this deployment): LLM tutor chat,
  server-side grading, and social-annotation persistence are unavailable. The core reading + interactives + adaptivity work.
- **Social annotations 404** against Supabase because the `section_annotations` (and related) tables are not provisioned on
  the live Supabase project; run `backend/supabase_all_in_one.sql` to enable.
- **Worker provenance write** is best-effort and skipped unless `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set via
  `wrangler secret put`. The hosted LLM Worker preserves the adaptive Worker `decision_id`, so any persisted decision can
  be joined to the UI-facing response.
- **Access codes are server-side only.** Set `ENGINEERING_ACCESS_CODE`, `EDUCATION_ACCESS_CODE`, and
  `RESEARCHER_ACCESS_CODE` in Cloudflare Pages. The local fallback codes only work when `ALLOW_FALLBACK_ACCESS_CODES=true`
  is explicitly set.
- For full server features, host the FastAPI backend (e.g. Render/Fly) and point `VITE_API_BASE` at it instead of `/api`.
