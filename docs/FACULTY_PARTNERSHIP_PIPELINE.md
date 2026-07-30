# Faculty evidence partnership pipeline

ALGET lets an instructor connect one Google Doc, inspect a generated course experience in shadow mode, and approve only the material they want learners to see.

## Workflow

1. The instructor opens `/instructor` and selects **Shadow pilot**.
2. They paste a view-only Google Docs URL. ALGET accepts only canonical `docs.google.com/document/d/...` links and fetches the text export from a fixed Google endpoint.
3. The faculty API creates a source-grounded draft containing:
   - measurable learning objectives;
   - reading sections with estimated time and purpose;
   - claim-evidence-revision activities and their evidence fields;
   - proposed parameter-exploration simulations with prediction, observation, and explanation traces.
4. The draft is stored with its source revision hash. Student visibility, automatic publishing, messaging, and grading remain disabled.
5. The instructor reviews the generated experience and marks the pilot ready. This state remains learner-invisible.
6. A separate **Approve & publish** action writes an RLS-protected `published_course_modules` record and activates the pilot. The module then appears under **Instructor-published modules** in that course's reader.
7. Weekly evidence briefs and course impact reports reuse the same governed faculty workspace.

## Account and roster onboarding

- Instructor accounts may be requested through public sign-up by selecting **Instructor**. Supabase creates a `pending_approval` application, but never grants instructor permissions at sign-up.
- A course administrator reviews applications in Admin → Instructors. Approval changes the profile to `active` and assigns the server-side `instructor` role; rejection assigns `instructor_rejected`. Course creation, source ingestion, roster access, and artifact generation remain unavailable until approval.
- The existing administrator invitation path remains available for direct onboarding. A public user cannot self-assign the `instructor` role.
- An active instructor can invite a learner from the course-scoped roster panel. The invitation creates a Supabase Auth account, sends the learner a secure setup email, and records an `invited` roster row for that course.
- The invitation endpoint verifies the instructor's active profile and course ownership before creating the account. It never grants instructor or administrator metadata to the learner.

## Runtime contract

- `POST /api/faculty/google-docs/import` requires an authenticated `instructor`, `course_admin`, or `admin` role.
- The Cloudflare Worker optionally enriches the deterministic draft through OpenRouter. If AI is unavailable, the source-grounded deterministic draft remains usable.
- The local FastAPI runtime implements the same URL validation and deterministic fallback.
- Documents must currently be shared as **Anyone with the link can view**. ALGET never writes to or modifies the source Google Doc.
- Imports are capped at 250,000 characters and reject non-Google URLs, short documents, HTML login responses, and redirects to Google Accounts.

## Persistence

Migration `20260730110000_faculty_evidence_partnership.sql` adds RLS-protected faculty pilots, evidence briefs, and impact reports. Migration `20260730220826_harden_instructor_course_access.sql` adds the instructor-approved publishing terminus and course-assignment policies. Each pilot records the canonical source URL, source hash, generated draft, objectives, and governance settings. Only assigned instructors can manage a publication; only learners enrolled in that course can read it.

Configured Supabase failures are surfaced to the instructor and never silently fall back to browser storage. Demo-only local evidence copies remove learner IDs and display names before persistence.

## Next integration boundary

Private-domain Google Docs should use an institutional OAuth consent flow with read-only Drive/Docs scopes. Tokens must be stored server-side with rotation and revocation support; they should never be persisted in browser storage or course records.
