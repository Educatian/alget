# ALGET Cloudflare production operations

Updated: 2026-09-24

## Production topology

- Frontend: Cloudflare Pages project `alget`, `https://alget.pages.dev`.
- Backend: Cloudflare Worker `alget-backend`, `https://alget-backend.jewoong-moon.workers.dev`; it forwards API traffic to the FastAPI application in a Cloudflare Container.
- Database and RAG vectors: Supabase PostgreSQL with pgvector and row-level security.
- AI: OpenRouter. The configured embedding model remains `google/gemini-embedding-001` at 768 dimensions to match the existing vector column.
- The Pages and Worker Git builds use the `Educatian/alget` repository and `cloudflare-production` branch. Production API routing defaults to the Worker URL in `frontend/src/lib/apiConfig.js`.

## Runtime configuration

Set these values in the production Worker settings as encrypted secrets, except `SUPABASE_URL`, which may be a non-secret variable:

- `OPENROUTER_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENGINEERING_ACCESS_CODE`
- `EDUCATION_ACCESS_CODE`
- `RESEARCHER_ACCESS_CODE`

The frontend deployment also needs its public Supabase URL and publishable/anonymous key, plus any configured access codes used by its entry flows. Never place service-role or provider key values in Git, build logs, this document, or chat. Record only secret names and rotation dates in release notes.

## Deployment

1. Make and review changes on a feature branch; merge or push approved production changes to `cloudflare-production`.
2. Confirm the Cloudflare Pages and Worker builds complete successfully for the same commit.
3. Check `GET https://alget-backend.jewoong-moon.workers.dev/healthz` returns `200`.
4. Check a representative textbook section, an access-code validation, one OpenRouter-backed tutor request, and a Supabase-backed learner-data flow.
5. Open `https://alget.pages.dev` and verify sign-in, textbook content, AI generation, and student progress from the deployed frontend.
6. Review Worker and Container logs for missing secrets, RAG initialization errors, and Supabase errors. Record the commit SHA, Worker version, Pages deployment ID, and smoke-check results without recording secret values.

The Worker currently runs a Python FastAPI application in Cloudflare Containers. Keep the configured Workers Paid plan and usage in view: Cloudflare budget alerts are informational rather than a hard spending cap, and OpenRouter is billed separately. The owner's target is to keep total usage below $100; check provider-side quotas and both bills regularly.

## Recovery

### Frontend deployment issue

1. In Cloudflare Pages project `alget` → Deployments, roll back to the last known-good production deployment.
2. Confirm its bundled API base points to the currently healthy Worker.
3. Recheck sign-in and the textbook, tutor, and progress flows at `https://alget.pages.dev`.

### Backend deployment issue

1. In Cloudflare Workers & Pages → `alget-backend` → Deployments, roll back to the last known-good Worker version.
2. Check `/healthz`, a textbook-content request, AI generation, and Supabase-backed retrieval.
3. Confirm the Container image/configuration rollout matches the restored Worker version; a Worker rollback does not restore Supabase data or other external resources.

### Data or secret incident

- A Worker rollback does not revert Supabase schema or data. Apply a reviewed forward migration or restore from the database backup procedure.
- Rotate a leaked provider/database key at its issuer, update the encrypted Worker secret, redeploy, and verify the integration. Never record secret values in release notes.

## Access and MFA

- The Cloudflare account owner should enroll two-factor authentication before broadening account access.
- Stephen and David have Cloudflare Developer Platform Editor access. Confirm each person has working MFA before routine production administration.
- The Supabase organization is on Free, where organization-wide MFA enforcement is unavailable. Each member must enroll MFA in their own Supabase account.
- Do not store recovery codes in this repository. Each person should keep recovery codes in their own password manager.
