# Recording the governed-agentic demo

Produces a screen recording of the governed agentic workflow: a course built
from a source PDF, then the learner-side approval loop and the adaptation
controls.

## Recorded beats

| Beat | Local full tour | Deployed |
|---|---|---|
| Landing | yes | yes |
| Instructor registry: register → approve | yes | needs a real administrator |
| Course shell creation | yes | needs a real administrator |
| PDF ingestion: upload → in-flight conversion → ingested result | yes | needs a real administrator |
| Governed agent run: plan → awaiting approval → approve | yes | needs a real administrator |
| Pathway unlock | yes | yes |
| Reading surface | yes | yes |
| Study planner: draft → awaiting approval → active | yes | needs a signed-in Supabase user |
| Adaptation control plane | yes | needs a real administrator |
| Instructor intervention queue | yes — course-scoped queue is visible; it stays empty until evidence crosses the drafting threshold | needs role + cohort evidence for a proposal |

The instructor intervention queue is now reachable in the local E2E path: the
course-scoped dashboard supplies an `e2e-course` fallback when the demo identity
has no remote assignment. It correctly shows an empty evidence state until
course-scoped mastery evidence crosses the drafting threshold. A deployed
instructor still needs an assigned course and real cohort evidence before a
proposal can be created.

## Local full tour (the working path)

### 1. Backend

```bash
cd backend
ALGET_ADMIN_TOKEN=local-demo-admin-token \
ALGET_DEMO_MODE=true \
ENGINEERING_ACCESS_CODE=eng123 \
EDUCATION_ACCESS_CODE=edu123 \
RESEARCHER_ACCESS_CODE=res123 \
python -m uvicorn server:app --host 127.0.0.1 --port 8000
```

PDF ingestion needs `PyPDF2` (`pip install -r requirements.txt`); without it
`convert_pdf_bytes` raises at request time.

### 2. Frontend

`frontend/.env.local` (git-ignored) supplies:

```
VITE_E2E_AUTH_BYPASS=true
VITE_API_BASE=/api
VITE_LLM_API_BASE=/api
```

`VITE_E2E_AUTH_BYPASS` is the application's own end-to-end affordance. It
supplies the `e2e-user` identity that `hasInstructorAccess` and
`hasCourseAdminAccess` accept, and it blanks the Supabase credentials so the
agentic runtime uses its offline mirror instead of RLS-gated RPCs. It must
never reach a hosted build — `scripts/release_readiness.mjs` fails when it
appears in a production bundle.

```bash
cd frontend && npm run dev -- --port 5173 --strictPort
```

The recorder supplies `X-Alget-Admin-Token` as a browser-context header for
the local PDF ingestion endpoint; no privileged token is placed in the
frontend bundle.

### 3. Record

```bash
cd frontend
ALGET_DEMO_BASE_URL=http://127.0.0.1:5173 \
ALGET_DEMO_ADMIN_TOKEN=local-demo-admin-token \
ALGET_DEMO_PDF=../reading/Sosnovsky_2025.pdf \
node scripts/record-agentic-demo.mjs
```

The recorder sets `X-Alget-Admin-Token` on the browser context, which is the
server-to-server branch `require_admin_access` already supports. No
application source is modified, and the header is only ever supplied by the
recording script.

The run prints every beat it recorded and every beat it skipped, with the
reason. Treat a skipped beat as a failed take. Output lands in
`frontend/tmp/agentic-demo/*.webm`.

## The learner-visible generated course

`/admin` PDF ingestion produces a governed source and an approved agent run; it
does not by itself put anything in front of a learner. The faculty pipeline is
what publishes a module into the course reader:

Shadow pilot → `Connect & draft` → `Start shadow mode` → `Mark ready for review`
→ `Approve & publish` → the module appears in that course's reader under
**Instructor-published modules**.

Two things follow from this:

- Pass `ALGET_DEMO_GOOGLE_DOC` (a view-only `docs.google.com/document/d/…` link)
  and `ALGET_DEMO_READER_COURSE` (the course key) to record those beats.
- Section titles and objectives are only as good as the draft. The Worker
  enriches the deterministic draft through OpenRouter; without a provider key
  the fallback structures the source by its heading candidates, which on a
  journal PDF yields cover-page fragments ("ARTICLE", the citation line). Record
  the faculty path against the deployed Worker, not an unkeyed local backend.

An ingested PDF can also seed a pilot: `convert_pdf_bytes` returns a
`runtime_draft`, and the Shadow pilot form offers **Ingested course source →
Draft from source** whenever the selected course has one.

## Deployed-site tour

Against `https://alget.pages.dev` the administrator beats need an account that
genuinely holds `app_metadata.role = admin | course_admin`; every `/admin/*`
endpoint re-verifies the caller against Supabase. Capture that session with:

```bash
cd frontend && node scripts/capture-admin-session.mjs
```

A browser window opens and waits while you sign in — no credential passes
through the script. It writes `tmp/admin-session.json`, which grants access to
the account: `tmp/` is git-ignored, and the file should be deleted once the
recording is done. Then:

```bash
ALGET_DEMO_STORAGE_STATE=tmp/admin-session.json \
ALGET_DEMO_GOOGLE_DOC="https://docs.google.com/document/d/…/edit" \
ALGET_DEMO_READER_COURSE=<course-key> \
node scripts/record-agentic-demo.mjs
```

Add `ALGET_DEMO_PDF=../reading/Sosnovsky_2025.pdf` to also record the admin
ingestion beats.

## Encoding

```bash
cd frontend/tmp/agentic-demo
ffmpeg -i page@*.webm -c:v libx264 -pix_fmt yuv420p -crf 21 -movflags +faststart alget-demo.mp4
# 40-second highlight, small enough to inline in email
ffmpeg -ss 50 -t 40 -i alget-demo.mp4 -vf "fps=9,scale=760:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3" -loop 0 alget-demo-highlight.gif
```

A full-length GIF of the 2:46 tour lands around 24MB; keep GIFs to a segment
and use the MP4 for the whole tour.

## Note on the deployed build

`/book/generate_custom_module` is disabled in the hosted Worker by design — it
writes content files, and the hosted build serves a fixed versioned catalog.
Whole-module authoring must run against a local backend. PDF ingestion,
assessment generation (`/generate_assessment`), and the agentic runtime all
work against the deployed site.
