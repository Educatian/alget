-- Close the learner-data exposure paths used by the instructor dashboard and
-- establish an explicit instructor-owned publishing terminus.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.can_manage_course(p_course_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      public.is_alget_operator()
      or exists (
        select 1
        from public.managed_courses mc
        join public.instructor_profiles ip on ip.id = mc.owner_instructor_id
        where mc.course_key = p_course_key
          and ip.user_id = (select auth.uid())
          and ip.status = 'active'
      )
    );
$$;

create or replace function private.can_view_learner_mastery(p_learner_id uuid, p_concept_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      public.is_alget_operator()
      or exists (
        select 1
        from public.cohort_learners cl
        join public.managed_courses mc on mc.course_key = cl.course_id
        join public.instructor_profiles ip on ip.id = mc.owner_instructor_id
        where cl.user_id = p_learner_id
          and ip.user_id = (select auth.uid())
          and ip.status = 'active'
          and exists (
            select 1
            from public.sections s
            where s.course = cl.course_id
              and p_concept_id = any(s.concept_ids)
          )
      )
    );
$$;

revoke all on function private.can_manage_course(text) from public, anon;
revoke all on function private.can_view_learner_mastery(uuid, text) from public, anon;
grant execute on function private.can_manage_course(text) to authenticated;
grant execute on function private.can_view_learner_mastery(uuid, text) to authenticated;

-- Learners can only manage their own mastery rows. Instructors receive
-- read-only access through an assigned managed course; anonymous access is
-- removed at both the grant and policy layers.
drop policy if exists "Users can view own mastery" on public.mastery;
drop policy if exists "Users can update own mastery" on public.mastery;
drop policy if exists "users read own mastery" on public.mastery;
drop policy if exists "users insert own mastery" on public.mastery;
drop policy if exists "users update own mastery" on public.mastery;
drop policy if exists "instructors read assigned mastery" on public.mastery;

create policy "users read own mastery" on public.mastery
for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "users insert own mastery" on public.mastery
for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "users update own mastery" on public.mastery
for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "instructors read assigned mastery" on public.mastery
for select to authenticated
using (private.can_view_learner_mastery(user_id, concept_id));

revoke all on table public.mastery from public, anon, authenticated;
grant select, insert, update on table public.mastery to authenticated;

-- Roster rows are private to the learner and read-only to the assigned
-- instructor or an accountable operator.
drop policy if exists "Users can manage own cohort learner profile" on public.cohort_learners;
drop policy if exists "Authenticated users can read cohort learner roster" on public.cohort_learners;
drop policy if exists "users read own cohort learner profile" on public.cohort_learners;
drop policy if exists "users insert own cohort learner profile" on public.cohort_learners;
drop policy if exists "users update own cohort learner profile" on public.cohort_learners;
drop policy if exists "instructors read assigned cohort roster" on public.cohort_learners;

create policy "users read own cohort learner profile" on public.cohort_learners
for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "users insert own cohort learner profile" on public.cohort_learners
for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "users update own cohort learner profile" on public.cohort_learners
for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "instructors read assigned cohort roster" on public.cohort_learners
for select to authenticated
using (private.can_manage_course(course_id));

revoke all on table public.cohort_learners from public, anon, authenticated;
grant select, insert, update on table public.cohort_learners to authenticated;

-- Make the course catalog query use the same assignment rule as the data
-- policies. This also avoids depending on a nested RLS query against profiles.
drop policy if exists "instructors read owned courses" on public.managed_courses;
drop policy if exists "instructors read assigned courses" on public.managed_courses;
create policy "instructors read assigned courses" on public.managed_courses
for select to authenticated
using (private.can_manage_course(course_key));

-- Faculty artifacts must belong to a course the current instructor manages.
drop policy if exists "instructors manage own faculty pilots" on public.faculty_pilots;
create policy "instructors manage own faculty pilots" on public.faculty_pilots
for all to authenticated
using (public.is_alget_instructor() and owner_id = (select auth.uid()) and private.can_manage_course(course_id))
with check (public.is_alget_instructor() and owner_id = (select auth.uid()) and private.can_manage_course(course_id));

drop policy if exists "instructors manage own evidence briefs" on public.instructor_evidence_briefs;
create policy "instructors manage own evidence briefs" on public.instructor_evidence_briefs
for all to authenticated
using (public.is_alget_instructor() and created_by = (select auth.uid()) and private.can_manage_course(course_id))
with check (public.is_alget_instructor() and created_by = (select auth.uid()) and private.can_manage_course(course_id));

drop policy if exists "instructors manage own impact reports" on public.course_impact_reports;
create policy "instructors manage own impact reports" on public.course_impact_reports
for all to authenticated
using (public.is_alget_instructor() and created_by = (select auth.uid()) and private.can_manage_course(course_id))
with check (public.is_alget_instructor() and created_by = (select auth.uid()) and private.can_manage_course(course_id));

-- Co-instructors can save independent weekly briefs for the same course period.
alter table public.instructor_evidence_briefs
drop constraint if exists instructor_evidence_briefs_course_id_period_start_period_end_key;
alter table public.instructor_evidence_briefs
drop constraint if exists instructor_evidence_briefs_course_id_period_start_period_en_key;
alter table public.instructor_evidence_briefs
add constraint instructor_evidence_briefs_course_creator_period_key
unique (course_id, created_by, period_start, period_end);

create table if not exists public.published_course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id text not null check (course_id ~ '^[a-z0-9][a-z0-9-]*$'),
  pilot_id uuid not null unique references public.faculty_pilots(id) on delete cascade,
  published_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 180),
  module_name text not null check (char_length(module_name) between 2 and 240),
  generation_draft jsonb not null,
  status text not null default 'published' check (status in ('published', 'retired')),
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(generation_draft -> 'sections') = 'array')
);

drop trigger if exists set_published_course_modules_updated_at on public.published_course_modules;
create trigger set_published_course_modules_updated_at
before update on public.published_course_modules
for each row execute function public.set_agentic_updated_at();

alter table public.published_course_modules enable row level security;

drop policy if exists "instructors manage own published modules" on public.published_course_modules;
create policy "instructors manage own published modules" on public.published_course_modules
for all to authenticated
using (published_by = (select auth.uid()) and private.can_manage_course(course_id))
with check (published_by = (select auth.uid()) and private.can_manage_course(course_id));

drop policy if exists "learners read published course modules" on public.published_course_modules;
create policy "learners read published course modules" on public.published_course_modules
for select to authenticated
using (
  status = 'published'
  and (
    private.can_manage_course(course_id)
    or exists (
      select 1 from public.cohort_learners cl
      where cl.user_id = (select auth.uid())
        and cl.course_id = published_course_modules.course_id
    )
  )
);

revoke all on table public.published_course_modules from public, anon, authenticated;
grant select, insert, update on table public.published_course_modules to authenticated;

create index if not exists idx_published_course_modules_course_status
on public.published_course_modules(course_id, status, published_at desc);
