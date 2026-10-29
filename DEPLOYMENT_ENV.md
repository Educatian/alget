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

The AI Literacy course for TAMU students, with no Supabase or FastAPI backend: course data is static JSON and
student sign-in, progress, learning events and the AI tutor run on the TAMU tutor worker below. It is published as
the `tamu-3d-labs` preview branch of the `alget-tamu-ai-literacy` Pages project (the project's production site is
separate and must not be overwritten): https://tamu-3d-labs.alget-tamu-ai-literacy.pages.dev

```
cd frontend
VITE_STATIC_DEMO=true VITE_API_BASE=/demo-api VITE_TUTOR_URL=https://alget-tamu-tutor.jewoong-moon.workers.dev VITE_TAMU_ACCOUNTS=true npm run build   # no VITE_SUPABASE_*
python ../scripts/export_static_demo.py dist     # demo-api JSON, _redirects, and a media _worker.js (byte ranges for the clips)
npx wrangler pages deploy dist --project-name alget-tamu-ai-literacy --branch tamu-3d-labs
```

Course content is generated: `python scripts/build_ai_literacy_course.py` writes the sections (and each section's
time budget, 218 min in total). Written activities are `NN.activity.json`; their reference answers are bundled into
the worker and stripped from the exported section JSON.

Lecture clips (`frontend/public/media/ai-literacy`, one per section, each with `.vtt` captions and `.quiz.json`
check-ins) are built in `media_src/`: `make_narration.py` (Kokoro), `manimgl ai_literacy_videos.py <Clip> -w --hd
--video_dir build/manim`, then `node annotated/record.mjs` appends the pen-annotated reading (Rough Notation,
Hershey Text JS, rough.js; Playwright frame capture), normalizes loudness to -16 LUFS and publishes the clip.

### Student accounts

40 roster IDs (`TAMU-001`..`TAMU-040`) plus `TAMU-999` for testing (TAMU-9xx are reserved for instructor and test
accounts; leave them out of analysis). Passwords are word-word-number; the roster CSVs are kept outside the repo
(owner's Desktop) and only PBKDF2 hashes are stored (KV `alget-tamu-accounts`). Sessions (token hashes) and
per-student progress are in D1. Make or restore accounts:

```
cd cloudflare/tamu-tutor-worker
node scripts/make_accounts.mjs --count 40 --roster <outside-repo>/roster.csv --kv <tmp>/kv.json   # new passwords
node scripts/make_accounts.mjs --from-roster <outside-repo>/roster.csv --kv <tmp>/kv.json         # same passwords
npx wrangler kv bulk put <tmp>/kv.json --namespace-id 91434d52ecd14b9caf4988d193993652 --remote   # then delete kv.json
```

### Instructor accounts and class dashboard

`TAMU-901` is the instructor account for Prof. Yeonji Jung (roster `TAMU-instructor-account.csv` on the owner's
Desktop; passphrase word-word-word-NN). An instructor session lands on `/teach`, the class dashboard
(`frontend/src/pages/TamuDashboard.jsx`): summary cards, the roster with 12-section status, accuracy, check-ins,
written activities, hints, stuck counts and flags, a per-student drawer (section detail, concept mastery, written
activities with feedback criteria, recent events), per-item stats with the most common wrong answer, CSV download,
refresh every minute. It reads `GET /instructor/overview` and `/instructor/student?id=` (worker `instructor.js`),
which return 403 for student sessions. TAMU-9xx IDs are left out of the dashboard; note and highlight text is never
returned, only counts. Make another instructor:

```
node scripts/make_accounts.mjs --start 902 --count 1 --role instructor --name "Prof. Name" --roster <outside-repo>/instructor.csv --kv <tmp>/kv.json
```

Local testing: `node scripts/seed_local_test_account.mjs` adds local-only TAMU-001/002/900 (`local-test-42`) and the
instructor TAMU-950 (`local-teach-42`).

### Learning events

One row per action in D1 `alget-tamu-events` (table `events`), keyed by student, session and sequence number; typed
text is stored only as its length. Event names: `docs/tamu-event-codebook.md`. Export for analysis (writes
`events.csv` and `sequences.csv`, outside the repo):

```
node cloudflare/tamu-tutor-worker/scripts/export_events.mjs --out <folder> [--since 2026-11-01] [--student TAMU-007]
```

Schema changes go in `cloudflare/tamu-tutor-worker/migrations/` and are applied with
`npx wrangler d1 migrations apply alget-tamu-events --remote`.

### TAMU tutor worker (`cloudflare/tamu-tutor-worker`)

Sign-in, progress and learning events for the TAMU preview, plus its AI tutor (hints, "explain this passage",
written-activity feedback, tutor notes on the reading): https://alget-tamu-tutor.jewoong-moon.workers.dev
(separate from `alget-backend` and `alget-tamu-api`). Model calls go to UA's Microsoft Foundry (UA OIT allows only
Foundry or Gemini on UA enterprise accounts; OpenRouter is not covered): `FOUNDRY_ENDPOINT` is the resource's
`/openai/v1` base and `MODEL` is the deployment name. For a gpt-5-family deployment set `REASONING_EFFORT` (for
example `low`). It currently uses the SAIL and ME Foundry resource (`UA-Education-SAIL-and-ME-RG`, owner's
decision 2026-10-28), so usage bills to that project. It reads course data from the preview's `/demo-api`, accepts
calls only from the preview origin, requires a signed-in student for everything except sign-in, limits each student
to 12 calls a minute per route (a class shares one campus IP) and the whole worker to `DAILY_CAP` AI calls a day
(KV `alget-tamu-tutor-usage`). Every hint passes `src/leakGuard.js` and then a model leak judge (`judgeMessages` in
`src/prompts.js`); written feedback may quote only the learner's own words and is blocked if it supplies the
reference answer. `TUTOR_ENABLED=false` switches the AI off (sign-in and progress keep working).

```
npx wrangler secret put FOUNDRY_API_KEY --name alget-tamu-tutor      # owner only (Foundry home page > API key)
cd cloudflare/tamu-tutor-worker && npm test && npx wrangler deploy
node scripts/sweep.mjs                                                 # live leak/grounding sweep (~120 calls)
```

Build the preview with `VITE_TUTOR_URL=https://alget-tamu-tutor.jewoong-moon.workers.dev` to turn the AI steps on;
without it the reader stays fully offline.

### TAMU live class worker (`cloudflare/tamu-live-worker`)

Real-time social cues for the TAMU preview, as a separate worker so the tutor worker and the Supabase-based
presence/peer-highlight code are untouched: https://alget-tamu-live.jewoong-moon.workers.dev. One Durable Object
(`ClassRoom`, SQLite class, hibernating WebSockets) holds a socket per open reader; the session token travels in
the WebSocket subprotocol list, never in the URL. Readers report only their section, heading and whether the tab is
hidden. Every reader is told, without names: classmates online, how many are reading each section (contents panel
pill), how many are at each heading of their section ("N here" badge), and the passages that 2+ classmates
underlined in their section (dotted underline with a count and colour-tag counts; `src/shared.js` builds them from
the synced highlights in D1 and never returns notes). Instructors and TAMU-9xx IDs are not counted. The worker only
reads the tutor worker's D1 (sessions, progress).

```
cd cloudflare/tamu-live-worker && npm test && npx wrangler deploy
```

Build the preview with `VITE_LIVE_URL=https://alget-tamu-live.jewoong-moon.workers.dev` (needs the accounts build);
without it the live class stays off. Local testing needs both workers in one `wrangler dev` process (two processes
sharing one local D1 file fail with D1 internal errors): run them behind a small router that sends `/live` to the
live worker and everything else to the tutor worker.

## UTK site (multi-site study, same branch)

The same build and worker code as the TAMU preview, run for Prof. Yukyeong Song's course at UTK on its own
Cloudflare resources, so accounts, sessions, progress, learning events and the live class never mix with TAMU:

| | TAMU | UTK |
|---|---|---|
| Site | `tamu-3d-labs.alget-tamu-ai-literacy.pages.dev` | https://alget-utk-ai-literacy.pages.dev (Pages project `alget-utk-ai-literacy`, branch `main`) |
| Tutor worker | `alget-tamu-tutor` (`wrangler.jsonc`) | `alget-utk-tutor` (`wrangler.utk.jsonc`) |
| Live worker | `alget-tamu-live` (`wrangler.jsonc`) | `alget-utk-live` (`wrangler.utk.jsonc`) |
| D1 | `alget-tamu-events` | `alget-utk-events` |
| KV | `alget-tamu-accounts`, `alget-tamu-tutor-usage` | `alget-utk-accounts`, `alget-utk-tutor-usage` |
| IDs | `TAMU-001`.. | `UTK-001`.. (worker var `ID_PREFIX`, build var `VITE_ID_PREFIX`) |

IDs ending in 9xx are instructor and test accounts on every site. UTK roster: `UTK-001`..`UTK-040`, `UTK-999` (test),
instructors `UTK-901` (Prof. Yukyeong Song) and `UTK-902` (Dr. Zhen Xu); rosters on the owner's Desktop
(`UTK-AI-Literacy-Accounts.csv`, `UTK-instructor-accounts.csv`, `UTK-test-account.csv`).

```
npx wrangler secret put FOUNDRY_API_KEY --name alget-utk-tutor          # owner only; AI steps are off until set
cd cloudflare/tamu-tutor-worker && npx wrangler d1 migrations apply alget-utk-events -c wrangler.utk.jsonc --remote
npx wrangler deploy -c wrangler.utk.jsonc                               # and the same in cloudflare/tamu-live-worker
node scripts/make_accounts.mjs --prefix UTK --count 40 --roster <outside-repo>/roster.csv --kv <tmp>/kv.json
npx wrangler kv bulk put <tmp>/kv.json --namespace-id e7b0e5562ea84c5eaeb8c1c98583383e --remote
node scripts/export_events.mjs --db alget-utk-events --out <folder>
```

Build the UTK site like the TAMU one with `VITE_TUTOR_URL=https://alget-utk-tutor.jewoong-moon.workers.dev`,
`VITE_LIVE_URL=https://alget-utk-live.jewoong-moon.workers.dev` and `VITE_ID_PREFIX=UTK`, then
`npx wrangler pages deploy <dist> --project-name alget-utk-ai-literacy --branch main`. In Git Bash set
`MSYS_NO_PATHCONV=1` first: otherwise `VITE_API_BASE=/demo-api` is rewritten to a Windows path and no section loads.
Local testing: `node scripts/seed_local_test_account.mjs --prefix UTK --config wrangler.utk.jsonc` seeds
UTK-001/002/900/950.

### Site-only features (TAMU)

Some features are on for one site only, keyed by the roster prefix in `frontend/src/lib/site.js` and
`cloudflare/tamu-tutor-worker/src/site.js` (no build or worker vars). TAMU has all four; UTK has none:

| Feature | Where |
|---|---|
| `ai-badge` | "✦ AI" pill on Explain this passage, Ask AI tutor and AI hints, Get feedback, Tutor notes |
| `deadlines` | chapter due dates (`chapterDue` in `site.js`) in the course sidebar and a Pace column on the roster; nothing locks |
| `analytics` | "Class analytics" tab: `GET /instructor/analytics` (`analytics.js`) |
| `discussion` | section discussions: `GET/POST /discussion`, `POST /discussion/hide` (`discussion.js`, table `posts`), live via the live worker's `discussion` message |

Deploying them needs the `posts` table first (`npx wrangler d1 migrations apply alget-tamu-events --remote` in
`cloudflare/tamu-tutor-worker`), then the tutor worker, the live worker and the TAMU site. Applying the migration to
UTK is harmless; its worker answers 404 for these routes.

## Notes

- `ENGINEERING_ACCESS_CODE` and `EDUCATION_ACCESS_CODE` now validate server-side through `/api/access/validate`.
- `course_progress` enables cloud-synced section completion across devices.
- `social_presence` powers live reader analytics and dashboard concurrency metrics.
- Keep local `.env` out of git.
- OpenRouter usage is billed separately from Cloudflare Workers. Set provider-side limits and monitor both bills against the $100 deployment target.
