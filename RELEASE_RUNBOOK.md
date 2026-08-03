# ALGET release runbook

## Release decision

A release candidate is ready to deploy only when GitHub CI is green and the production dependency audit reports zero high-severity production vulnerabilities. Content, backend, frontend, browser, Worker parity, and static snapshot gates are blocking.

## Deploy order

1. Apply the reviewed Supabase migrations, including the admin control plane and agentic LMS runtime.
2. Deploy `cloudflare/llm-proxy` so new APIs exist before the UI references them.
3. Deploy `frontend/dist` to Cloudflare Pages. Run `wrangler pages deploy dist` from `frontend/`, not from the repository root: wrangler discovers `functions/` relative to the working directory, and deploying from elsewhere uploads the assets without the Pages Functions. The access-code endpoint then answers POST with a static-asset 405, which disables every pathway unlock and the researcher console.
4. Run `node scripts/post_deploy_smoke.mjs` and require every check to pass. It exercises the deployed artifact — app shell, security headers, the access-code Function, Worker health, assessment generation, and anonymous refusal on the administrator and faculty endpoints. Point it elsewhere with `ALGET_APP_URL` / `ALGET_WORKER_URL` to smoke a preview first.
5. Draft and cancel one learner plan; draft and reject one instructor intervention. Confirm both decisions create workflow events and neither triggers delivery or grading.

## Roadmap contracts

- Verify `/roadmap/manifest` reports all three horizons and `roadmap-runtime-v1`.
- Create one shadow runtime package and confirm source hash, section references, and `student_visible=false`.
- Record one instructor `modify` decision and confirm the evidence IDs and rationale are present in the decision ledger.
- Export one subject's data, review the deletion plan, and require explicit confirmation before deletion.
- Register a draft model, reject production registration without an approver, and open/triage/contain one incident.
- Validate one Caliper event, OneRoster user payload, CASE competency, and evaluation manifest before institutional export.
6. Confirm the GitHub commit deployed to both production surfaces.

The same smoke runs hourly through `.github/workflows/production-smoke.yml` and
can be started manually from the Actions tab. A failed scheduled run is an
operational alert: inspect the Pages deployment and Worker version before
promoting a rollback.

Supabase migration history contains older remote-only versions from the legacy
schema bundle. Do not repair those versions by marking them reverted without a
schema review. The current forward contracts are tracked and verified by
`20260801000000_openstax_reference_index.sql` and
`20260802000000_agentic_roadmap_contracts.sql`; after applying them, confirm
`openstax_sections`, `course_runtime_packages`, and
`agent_decision_ledger` exist with
`powershell -File scripts/verify_live_migrations.ps1` before release.

## Adaptation incident response

1. Open `/admin` and choose `Adaptation`.
2. Select the affected course and choose `Emergency pause`.
3. Confirm that the status reads `Adaptive interventions are paused`.
4. Verify an adaptive recommendation response reports `suppression_reason: emergency_pause` and `intervention_allowed: false`.
5. Inspect the `adaptation_policy.emergency_paused` audit event.
6. Diagnose or draft a corrected policy. Do not resume until a course administrator approves the recovery.
7. Choose `Resume interventions`, then verify the audit event and one low-risk recommendation request.

Emergency pause leaves core reading and practice available. It suppresses adaptive interventions without deleting the active policy or its history.

## Rollback

- Policy rollback: create a rollback draft from a known policy version, review it, and activate it separately.
- Worker rollback: use Cloudflare deployment history to restore the prior verified Worker version.
- Pages rollback: use Cloudflare Pages deployment history to promote the prior verified deployment.
- Database changes: apply a reviewed forward migration. Do not destructively reset production data.

## Evidence to retain

- Git commit and GitHub Actions run
- Cloudflare Worker version and Pages deployment URL
- `/health` response
- HTTP security-header check
- unauthenticated admin `401` check
- adaptive support and emergency-pause runtime checks
- release-check, test, content-validation, and dependency-audit summaries
