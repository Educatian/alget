# ALGET release runbook

## Release decision

A release candidate is ready to deploy only when GitHub CI is green and the production dependency audit reports zero high-severity production vulnerabilities. Content, backend, frontend, browser, Worker parity, and static snapshot gates are blocking.

## Deploy order

1. Deploy `cloudflare/llm-proxy` so new APIs exist before the UI references them.
2. Deploy `frontend/dist` to Cloudflare Pages.
3. Verify `/health`, the Pages security headers, the learner reading route, and the administrator route.
4. Confirm the GitHub commit deployed to both production surfaces.

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
