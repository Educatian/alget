# ALGET Cloudflare backend migration and operations

Updated: 2026-09-24

## Current production state

- Frontend: Cloudflare Pages project `alget`, production URL `https://alget.pages.dev`.
- Backend: Render service `alget` (`https://alget.onrender.com/api`). The frontend still falls back to this URL when `VITE_API_BASE` is unset.
- Database and RAG vectors: Supabase. The backend reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for pgvector; OpenRouter is used for embeddings and generation.
- Do not remove or pause the Render service until the Cloudflare backend passes the cutover checklist below.
- Supabase project `ALGET` was checked in its dashboard on 2026-09-24: status **Healthy**, Compute **NANO**, 6/60 connections. Recent dashboard traffic includes successful auth and database API requests. The six Postgres errors shown in the same 60-minute overview were from earlier SQL/editor activity (including permission/syntax errors); this is not evidence that the database is paused.

## Prepared Cloudflare backend

The prepared target is a Cloudflare Worker that forwards API requests to the existing FastAPI application running in a Cloudflare Container. This keeps the current Python packages, synchronous HTTP calls, filesystem-based course content, and FastAPI lifespan behavior intact. The container includes the backend and `frontend/content` corpus.

Files:

- `Dockerfile.cloudflare` — Python 3.11 image, dependencies, content corpus, and FastAPI command.
- `cloudflare/backend-worker/wrangler.jsonc` — Container, Durable Object binding, migration, secrets, and observability settings.
- `cloudflare/backend-worker/src/index.js` — Worker-to-container request forwarding and secret injection.
- `backend/server.py` — `/healthz` readiness endpoint; removes a legacy environment diagnostic that exposed the first four characters of a configured OpenRouter key.

Cloudflare Containers require Workers Paid. Current prepared sizing is `basic` (1 GiB memory), at most two active instances, and five-minute idle sleep. The $5/month Workers Paid minimum includes only 25 GiB-hours, 375 vCPU-minutes, and 200 GB-hours of container resources; overages and egress can add charges. Check actual use and set a billing alert before production traffic. No plan upgrade or billing change has been made.

### $100 monthly budget guardrail

Cloudflare does not enforce a hard dollar cap for usage-based spend. Its budget alerts are informational, evaluated daily, and do not pause service; they also exclude recurring fees such as the $5 Workers Paid subscription. OpenRouter API billing is separate from Cloudflare. The requested $100 is therefore a target, not a guaranteed maximum. Set an OpenRouter API key in Render and Cloudflare as a secret, set provider-side limits where available, and monitor OpenRouter usage alongside Cloudflare Workers/Containers usage. After enabling Paid, set Cloudflare alerts at $75 and $90 under **Manage Account → Billing → Billable Usage**. If an absolute $100 ceiling is mandatory, do not launch public AI traffic until hard quotas are confirmed for every billable provider.

## One-time setup after enabling Workers Paid

Run from `cloudflare/backend-worker`:

```powershell
npm install
npx wrangler login
npm run bootstrap
```

The bootstrap creates the `alget-backend` Worker with a temporary 503 response and no secret bindings or container. This makes the Worker available for secret configuration before the first container deployment. It is not the application backend and must not be used as the Pages API URL.

In Cloudflare Dashboard → **Workers & Pages → alget-backend → Settings → Variables and Secrets**, add these as encrypted secrets: `OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ENGINEERING_ACCESS_CODE`, `EDUCATION_ACCESS_CODE`, and `RESEARCHER_ACCESS_CODE`. Enter secret values directly in Cloudflare; do not commit them, put them in `wrangler.jsonc`, or paste them into chat. The Worker passes them to the container as environment variables at startup.

Then deploy the container configuration with `npm run deploy` after Docker is running, or configure Workers Builds to run a full production deploy from the repository. A production Workers Builds configuration should use the repository root as its build root, `npm --prefix cloudflare/backend-worker ci` as its build command, and `npm --prefix cloudflare/backend-worker run deploy` as its deploy command. Wait for the container rollout before setting the Pages API URL.

For staging, deploy `npm run bootstrap:staging`, then create the same six secrets under the staging Worker's **Settings → Variables and Secrets** using a separate OpenRouter key, access codes, and Supabase staging project. Deploy with `npm run deploy:staging`. Never reuse the production service-role key for staging.

Local container build/deploy requires a running Docker-compatible engine. Workers Builds can build Dockerfile images remotely. The Dockerfile and configured build context are within the repository root.

## Cutover checklist

1. Provision a separate staging Supabase project and use staging-only OpenRouter/Supabase secrets. Set those secrets with the staging config and deploy with `npm run deploy:staging`. Do not point staging at the live learning database.
2. Build the container image and deploy the production Worker from this folder.
3. Check `GET https://<worker-name>.<account-subdomain>.workers.dev/healthz` returns `200` and the Worker has a healthy container instance.
4. Confirm a representative book section via `/api/book/bio-inspired/01/01`, an access-code validation, and one OpenRouter-backed tutor request. Review Worker and container logs for missing secrets, RAG initialization errors, and Supabase REST errors.
5. In Cloudflare Pages project `alget`, set production `VITE_API_BASE` to `https://<worker-name>.<account-subdomain>.workers.dev/api`, rebuild, then verify Google login, book content, AI generation, and student progress from `https://alget.pages.dev`.
6. Keep Render available during a monitoring period. Only after the Pages build is healthy and core learning flows pass should the team decide whether to decommission Render.

Until this checklist passes, production continues to use Render. The current repo branch and Cloudflare Pages production branch must also be synchronized before the frontend setting is changed.

## Routine deployment

1. Make and review changes on a feature branch; do not edit the live Worker in the dashboard.
2. Build and inspect the API locally with Docker and `wrangler dev` once a Docker-compatible engine is available.
3. Deploy the dedicated staging Worker first with `npm run deploy:staging`. Container Workers do not get a complete application preview URL from non-production Workers Builds; this config creates an isolated Worker, and its secrets must point at a separate Supabase staging project.
4. Deploy production with `npm run deploy` from this folder or merge the reviewed change to the Worker’s configured production branch.
5. Verify the active deployment, container rollout, `/healthz`, a textbook-content request, OpenRouter generation, and Supabase-backed RAG. Check both Worker and Containers logs.
6. Record the commit SHA, Worker version ID, migration result, secret changes (names only), and smoke-check results in the release record.

## Recovery

### Backend code regression

1. Cloudflare Dashboard → Workers & Pages → `alget-backend` → Deployments.
2. Select the last known healthy Worker version and choose **Rollback**; or run `npx wrangler rollback <version-id>` from this folder.
3. Check `/healthz`, textbook content, AI generation, and Supabase-backed retrieval again.
4. If the container image or configuration also changed, confirm its rollout completed; a Worker rollback does not restore Supabase data or other external resources.

### Cloudflare backend outage

1. In Cloudflare Pages production settings, restore `VITE_API_BASE=https://alget.onrender.com/api` and rebuild the Pages site, or roll back to the last Pages deployment that uses Render.
2. Confirm `https://alget.onrender.com/api` and the frontend's book and AI flows respond.
3. Keep the failed Cloudflare version and logs for diagnosis. Do not delete the Worker or Container application while investigating.

### Data or secret incident

- Worker rollback does not revert Supabase schema/data. Apply a reviewed forward database migration or restore from the database backup procedure.
- Rotate a leaked API/database key at its issuer, update the Cloudflare Worker secret with `npx wrangler secret put <NAME>`, redeploy, and verify the integration. Never record secret values in the release notes.

## Access and MFA readiness

- Cloudflare account owner 2FA is currently inactive. Owner must enroll a security key or authenticator app in Cloudflare **My Profile → Authentication → Two-factor authentication** before enforcing account-wide 2FA.
- Stephen and David have Cloudflare Developer Platform Editor access. Confirm each person has working 2FA and signs in before expanding privileges.
- Supabase organization is on Free, where org-wide MFA enforcement is unavailable. Each member must enroll MFA in their own Supabase account. David is accepted as Developer; Stephen’s invitation is still pending acceptance.
- Do not store recovery codes in this repository. Each person should keep recovery codes in their own password manager.
