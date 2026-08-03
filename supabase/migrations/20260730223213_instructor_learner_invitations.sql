alter table public.cohort_learners
  add column if not exists email text,
  add column if not exists status text not null default 'active'
    check (status in ('invited', 'active', 'suspended')),
  add column if not exists invited_by uuid references auth.users(id) on delete set null,
  add column if not exists invited_at timestamptz,
  add column if not exists accepted_at timestamptz;

create index if not exists idx_cohort_learners_course_status
  on public.cohort_learners(course_id, status, last_seen_at desc);

-- Learners may refresh their display name and last-seen metadata, but cannot
-- move their own roster row into another course or cohort.
create or replace function private.same_learner_assignment(
  p_user_id uuid,
  p_course_id text,
  p_cohort_id text,
  p_learner_hash text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cohort_learners current_row
    where current_row.user_id = p_user_id
      and current_row.course_id = p_course_id
      and current_row.cohort_id = p_cohort_id
      and current_row.learner_hash = p_learner_hash
  );
$$;

revoke all on function private.same_learner_assignment(uuid, text, text, text) from public, anon;
grant execute on function private.same_learner_assignment(uuid, text, text, text) to authenticated;

drop policy if exists "users update own cohort learner profile" on public.cohort_learners;
create policy "users update own cohort learner profile" on public.cohort_learners
for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and private.same_learner_assignment(user_id, course_id, cohort_id, learner_hash)
);

grant select on public.cohort_learners to authenticated;
