# ALGET Engineering Data-Collection Readiness

Date: 2026-08-16
Decision: **TECHNICAL PACKAGE READY / RECRUITMENT AND ACTIVATION HOLD**

This addendum records the state after adding a fail-closed ALGET-to-Qualtrics survey portal. It does not authorize recruitment, enrollment, survey activation, production migration, or confirmatory data access.

## Readiness decision

| Gate | State | Evidence or next action |
|---|---|---|
| Invitation-bound research identity | Ready locally | Portal accepts only the Bio-Inspired research cohort/course and a UUIDv4 learner hash. |
| Survey embedding shell | Ready locally | Authenticated route `/study-survey/:phase`, exact `az1.qualtrics.com` host, new-tab fallback, and CSP allowlist are implemented. |
| Fail-closed configuration | Ready locally | Portal is hidden and inaccessible unless `VITE_ENGINEERING_STUDY_SURVEYS_ENABLED=true` and the requested `SV_...` ID is configured. Defaults remain disabled. |
| Pseudonymous linkage | Ready locally | Approved links carry random `study_id`, `wave`, and cohort. Direct PII is explicitly reserved for the separate compensation/contact form. |
| Local application tests | Pass | 281/281 frontend tests passed; ESLint, the production build, and 51/51 Playwright browser E2E tests passed. |
| Local research package | Pass | 56/56 research tests and 62/62 package checks passed. The 145-artifact draft preregistration lock passes integrity audit and remains registration-pending. |
| Qualtrics production instruments | Hold | Existing five live drafts remain inactive and structurally unsuitable. Candidate v2.3 passes 17/17 local structure/privacy/consent/linkage checks but must not be imported until expert, cognitive, IRB, and authenticated inactive-project QA gates are met. |
| Scientific instrument validity | Hold | Execute `docs/ENGINEERING_FIELDWORK_PACKET_2026-08-16.md`: 6–8 subject-matter reviews, 3–5 measurement reviews, 8–12 cognitive interviews, and a 30–50 learner measurement pilot. Templates and scoring scripts are ready; no fieldwork evidence is yet claimed. |
| IRB and operations | Hold | Secure approval of protocol, recruitment, consent, compensation, named roles, privacy/retention, and adverse-event procedures. |
| Hosted staging database | Hold | Apply pending migrations only to an isolated staging Supabase project, then run RLS, assignment, export, and cleanup reconciliation. Production remains unchanged. |
| Preregistration | Hold | Refresh the draft fingerprint set, resolve all pending decisions, register before outcome access, then freeze the registered record. |
| Recruitment | Hold | Do not screen, consent, enroll, or activate until every external gate is documented as passed. |

## Reproducible local verification

Run these commands from the canonical worktrees before handing the package to
the study team. They are read-only with respect to production systems:

```powershell
# ALGET research package and frontend
py research/validate_engineering_study_package.py
py -m pytest research -q
cd frontend
cmd /c npm test
cmd /c npm run lint
cmd /c npm run build
cmd /c npm run test:e2e
```

The 2026-08-16 verification returned package `62/62`, research `56 passed`,
frontend `281 passed`, and browser E2E `51 passed`. Build output is local and
does not publish or alter the production deployment.

## Configuration contract

The browser build accepts only these public, non-secret settings:

```text
VITE_ENGINEERING_STUDY_SURVEYS_ENABLED=false
VITE_ENGINEERING_STUDY_QUALTRICS_DC=az1
VITE_ENGINEERING_STUDY_PRE_SID=
VITE_ENGINEERING_STUDY_POST_SURVEY_SID=
VITE_ENGINEERING_STUDY_POSTTEST_SID=
VITE_ENGINEERING_STUDY_GIFT_CARD_SID=
VITE_ENGINEERING_STUDY_RETENTION_SID=
```

Never place API tokens, contact data, Qualtrics response IDs, or linkage ledgers in browser environment variables or this repository.

## Activation sequence

1. Obtain IRB and institutional permission, and finalize compensation and data-retention decisions.
2. Complete expert review, cognitive interviewing, scoring review, and the measurement pilot. Revise and re-freeze instruments if indicated.
3. Import approved Candidate v2 instruments as new inactive Qualtrics projects. Do not overwrite the defective drafts.
4. In authenticated Qualtrics UI, verify consent/eligibility branching, forced-response rules, scoring, mobile layout, privacy notices, embedded-data fields, and end-of-survey behavior.
5. Submit synthetic responses only. Confirm export tags, pseudonymous joins, zero direct PII in outcome exports, and separate access controls for compensation records.
6. Apply the database package to isolated hosted staging and pass the staging reconciliation harness.
7. Complete and register the preregistration before accessing outcomes.
8. Configure the five approved `SV_...` IDs in a staging browser build, enable the feature flag, and rerun end-to-end QA.
9. Record a named go/no-go decision. Only a documented go permits production configuration and recruitment.

## Explicit non-actions

- No Qualtrics survey was activated or published.
- No production ALGET deployment or Supabase migration was performed.
- No real response, contact, or outcome data was accessed.
- No causal or measurement-validity claim is made from engineering or synthetic checks.
