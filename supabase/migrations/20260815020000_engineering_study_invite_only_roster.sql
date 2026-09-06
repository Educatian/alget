-- Prevent learner-created research roster identities. Engineering Study IDs
-- are bearer-sensitive linkage values and must be bound by an accountable
-- admin/course-admin invitation using the service role.

drop policy if exists "users insert own cohort learner profile" on public.cohort_learners;
create policy "users insert own nonresearch cohort learner profile" on public.cohort_learners
for insert to authenticated
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and not (
    cohort_id = 'bio-inspired-intervention-2026'
    or course_id = 'bio-inspired' and learner_hash ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  )
);

comment on policy "users insert own nonresearch cohort learner profile" on public.cohort_learners is
  'Ordinary course learners may create their own row. Bio-Inspired research rows are invite-only and service-role provisioned.';

create unique index if not exists idx_engineering_study_unique_learner_hash
  on public.cohort_learners(learner_hash)
  where cohort_id = 'bio-inspired-intervention-2026';

-- Assigned course instructors may view ordinary rosters, but the research
-- roster includes invitation email and Study-ID linkage. Restrict that roster
-- to accountable admin/course-admin operators and each learner's own row.
drop policy if exists "instructors read assigned cohort roster" on public.cohort_learners;
create policy "instructors read assigned nonresearch roster" on public.cohort_learners
for select to authenticated
using (
  private.can_manage_course(course_id)
  and (
    cohort_id <> 'bio-inspired-intervention-2026'
    or public.is_alget_operator()
  )
);

comment on policy "instructors read assigned nonresearch roster" on public.cohort_learners is
  'Course instructors cannot read the restricted engineering-study account-linkage roster; accountable operators retain access.';
