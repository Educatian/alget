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
5. The instructor reviews the generated experience, marks the pilot ready, and separately approves any intervention or release action.
6. Weekly evidence briefs and course impact reports reuse the same governed faculty workspace.

## Runtime contract

- `POST /api/faculty/google-docs/import` requires an authenticated `instructor`, `course_admin`, or `admin` role.
- The Cloudflare Worker optionally enriches the deterministic draft through OpenRouter. If AI is unavailable, the source-grounded deterministic draft remains usable.
- The local FastAPI runtime implements the same URL validation and deterministic fallback.
- Documents must currently be shared as **Anyone with the link can view**. ALGET never writes to or modifies the source Google Doc.
- Imports are capped at 250,000 characters and reject non-Google URLs, short documents, HTML login responses, and redirects to Google Accounts.

## Persistence

Migration `20260730110000_faculty_evidence_partnership.sql` adds RLS-protected faculty pilots, evidence briefs, and impact reports. Each pilot records the canonical source URL, source hash, generated draft, objectives, and governance settings.

## Next integration boundary

Private-domain Google Docs should use an institutional OAuth consent flow with read-only Drive/Docs scopes. Tokens must be stored server-side with rotation and revocation support; they should never be persisted in browser storage or course records.
