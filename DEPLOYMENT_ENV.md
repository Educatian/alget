# ALGET deployment environment

These values should be configured in the deployment platform rather than committed to `.env`.

## Backend

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` (defaults to `google/gemini-3.1-flash-lite`)
- `OPENROUTER_EMBEDDING_MODEL` (defaults to `google/gemini-embedding-001`; preserves the existing 768-dimensional Supabase vectors)
- `OPENROUTER_IMAGE_MODEL` (defaults to `google/gemini-2.5-flash-image`)
- `ENGINEERING_ACCESS_CODE`
- `EDUCATION_ACCESS_CODE`
- `RESEARCHER_ACCESS_CODE`

## Frontend

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Supabase SQL to apply

1. `backend/supabase_social_features.sql`
2. `backend/supabase_learning_features.sql`

## TAMU static preview (branch `tamu/ai-literacy`)

A read-only preview of the AI Literacy course with no Supabase, backend or accounts. It is published as the
`tamu-3d-labs` preview branch of the `alget-tamu-ai-literacy` Pages project (the project's production site is
separate and must not be overwritten): https://tamu-3d-labs.alget-tamu-ai-literacy.pages.dev

```
cd frontend
VITE_STATIC_DEMO=true VITE_API_BASE=/demo-api VITE_TUTOR_URL=https://alget-tamu-tutor.jewoong-moon.workers.dev npm run build   # no VITE_SUPABASE_*
python ../scripts/export_static_demo.py dist
npx wrangler pages deploy dist --project-name alget-tamu-ai-literacy --branch tamu-3d-labs
```

### TAMU tutor worker (`cloudflare/tamu-tutor-worker`)

AI hints and "explain this passage" for the TAMU preview only: https://alget-tamu-tutor.jewoong-moon.workers.dev
(separate from `alget-backend` and `alget-tamu-api`). Model calls go to UA's Microsoft Foundry (UA OIT allows only
Foundry or Gemini on UA enterprise accounts; OpenRouter is not covered): `FOUNDRY_ENDPOINT` is the resource's
`/openai/v1` base and `MODEL` is the deployment name. For a gpt-5-family deployment set `REASONING_EFFORT` (for
example `low`). It currently uses the SAIL and ME Foundry resource (`UA-Education-SAIL-and-ME-RG`, owner's
decision 2026-10-28), so usage bills to that project. It reads course data from the preview's `/demo-api`, accepts
calls only from the preview origin, limits each IP to 12 calls a minute and the whole worker to `DAILY_CAP` calls a
day (KV `alget-tamu-tutor-usage`), and every hint passes `src/leakGuard.js` and then a model leak judge
(`judgeMessages` in `src/prompts.js`) that catches answers given away in other words. `TUTOR_ENABLED=false` switches it off.

```
npx wrangler secret put FOUNDRY_API_KEY --name alget-tamu-tutor      # owner only (Foundry home page > API key)
cd cloudflare/tamu-tutor-worker && npm test && npx wrangler deploy
node scripts/sweep.mjs                                                 # live leak/grounding sweep (~120 calls)
```

Build the preview with `VITE_TUTOR_URL=https://alget-tamu-tutor.jewoong-moon.workers.dev` to turn the AI steps on;
without it the reader stays fully offline.

## Notes

- `ENGINEERING_ACCESS_CODE` and `EDUCATION_ACCESS_CODE` now validate server-side through `/api/access/validate`.
- `course_progress` enables cloud-synced section completion across devices.
- `social_presence` powers live reader analytics and dashboard concurrency metrics.
- Keep local `.env` out of git.
- OpenRouter usage is billed separately from Cloudflare Workers. Set provider-side limits and monitor both bills against the $100 deployment target.
