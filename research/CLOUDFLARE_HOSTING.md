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
  TOCs, 256 sections, and the search index (265 files).
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
  `wrangler secret put`.
- For full server features, host the FastAPI backend (e.g. Render/Fly) and point `VITE_API_BASE` at it instead of `/api`.
