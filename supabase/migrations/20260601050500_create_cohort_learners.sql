-- Stable roster mapping for current CAT cohorts.
-- Lets instructor/research views resolve Supabase auth user_ids back to the
-- learner name and course cohort entered at sign-in.

create table if not exists public.cohort_learners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  cohort_id text not null,
  cohort_label text not null,
  course_id text not null,
  learner_hash text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  profile jsonb not null default '{}'::jsonb
);

create index if not exists idx_cohort_learners_cohort on public.cohort_learners(cohort_id);
create index if not exists idx_cohort_learners_course on public.cohort_learners(course_id);
create index if not exists idx_cohort_learners_last_seen on public.cohort_learners(last_seen_at desc);

alter table public.cohort_learners enable row level security;

drop policy if exists "Users can manage own cohort learner profile" on public.cohort_learners;
create policy "Users can manage own cohort learner profile" on public.cohort_learners
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can read cohort learner roster" on public.cohort_learners;
create policy "Authenticated users can read cohort learner roster" on public.cohort_learners
  for select
  to authenticated
  using (true);

grant select, insert, update on public.cohort_learners to authenticated;
