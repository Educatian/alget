# ALGET deployment environment

These values should be configured in the deployment platform rather than committed to `.env`.

## Backend

- `GEMINI_API_KEY`
- `ENGINEERING_ACCESS_CODE`
- `EDUCATION_ACCESS_CODE`
- `RESEARCHER_ACCESS_CODE`

## Frontend

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Supabase SQL to apply

1. `backend/supabase_social_features.sql`
2. `backend/supabase_learning_features.sql`

## Notes

- `ENGINEERING_ACCESS_CODE` and `EDUCATION_ACCESS_CODE` now validate server-side through `/api/access/validate`.
- `course_progress` enables cloud-synced section completion across devices.
- `social_presence` powers live reader analytics and dashboard concurrency metrics.
- Keep local `.env` out of git.
