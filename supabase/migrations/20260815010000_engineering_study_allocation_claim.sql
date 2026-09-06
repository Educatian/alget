-- Concealed, schedule-based assignment for the ALGET Bio-Inspired trial.
-- The coordinator imports only SHA-256 Study-ID links and arm allocations.
-- Learners cannot choose a seed, stratum, user id, or arm.

insert into public.experiments (experiment_key, hypothesis, status)
values (
  'alget-bio-inspired-agentic-rct-v1',
  'Transparent adaptive agentic support improves baseline-adjusted Bio-Inspired Design concept and transfer performance relative to fixed practice-only support.',
  'draft'
)
on conflict (experiment_key) do update
set hypothesis = excluded.hypothesis;

insert into public.experiment_arms (experiment_id, arm_key, description, policy_version)
select experiments.id, arms.arm_key, arms.description, arms.policy_version
from public.experiments
cross join (
  values
    ('comparison_practice_only', 'Fixed practice-only rail with no adaptive policy call or generative tutor surface.', 'bio-inspired-comparison-v1'),
    ('treatment_annotation_adaptive', 'Transparent adaptive support selected from prespecified learning signals.', 'bio-inspired-adaptive-v1')
) as arms(arm_key, description, policy_version)
where experiments.experiment_key = 'alget-bio-inspired-agentic-rct-v1'
on conflict (experiment_id, arm_key) do update
set description = excluded.description,
    policy_version = excluded.policy_version;

-- The deployed base schema predates stratified assignment metadata. Keep these
-- columns nullable so existing non-study experiments continue to work.
alter table public.experiment_assignments
  add column if not exists course_id text,
  add column if not exists stratum_key text,
  add column if not exists assignment_seed text,
  add column if not exists allocation_ratio numeric,
  add column if not exists assignment_version text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'experiment_assignments_allocation_ratio_check'
      and conrelid = 'public.experiment_assignments'::regclass
  ) then
    alter table public.experiment_assignments
      add constraint experiment_assignments_allocation_ratio_check
      check (allocation_ratio is null or allocation_ratio > 0 and allocation_ratio <= 1);
  end if;
end
$$;

create index if not exists idx_experiment_assignments_course_user
  on public.experiment_assignments(course_id, user_id);

create table if not exists public.engineering_study_allocation_schedule (
  study_link_hash text primary key check (study_link_hash ~ '^[0-9a-f]{64}$'),
  experiment_key text not null default 'alget-bio-inspired-agentic-rct-v1',
  course_id text not null default 'bio-inspired',
  course_section text not null,
  baseline_band text not null check (baseline_band in ('baseline_low', 'baseline_mid', 'baseline_high')),
  stratum_key text not null,
  assignment_arm text not null check (assignment_arm in ('treatment_annotation_adaptive', 'comparison_practice_only')),
  allocation_block text not null,
  allocation_position integer not null check (allocation_position > 0),
  assignment_seed_hash text not null check (assignment_seed_hash ~ '^[0-9a-f]{64}$'),
  imported_at timestamptz not null default now(),
  claimed_user_id uuid unique references auth.users(id) on delete restrict,
  claimed_at timestamptz,
  unique (experiment_key, allocation_block, allocation_position)
);

alter table public.engineering_study_allocation_schedule enable row level security;
revoke all on table public.engineering_study_allocation_schedule from public, anon, authenticated;
grant select, insert, update, delete on table public.engineering_study_allocation_schedule to service_role;

-- Legacy direct assignment accepted caller-controlled user, stratum, and seed.
-- Keep it available only to the service role for backward-compatible admin use.
do $$
begin
  if to_regprocedure('public.assign_experiment_arm(uuid,text,text,text,text,double precision)') is not null then
    execute 'revoke all on function public.assign_experiment_arm(uuid,text,text,text,text,double precision) from public, anon, authenticated';
    execute 'grant execute on function public.assign_experiment_arm(uuid,text,text,text,text,double precision) to service_role';
  end if;
end
$$;

create or replace function public.claim_engineering_study_assignment()
returns table (
  experiment_key text,
  course_id text,
  assignment_arm text,
  stratum_key text,
  allocation_block text,
  assignment_hash text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_study_id text;
  v_link_hash text;
  v_schedule public.engineering_study_allocation_schedule%rowtype;
  v_experiment_id uuid;
  v_arm_id uuid;
  v_assignment_hash text;
  v_existing_arm text;
begin
  if v_user_id is null then
    raise exception 'Authenticated learner session required';
  end if;

  select lower(trim(learners.learner_hash))
  into v_study_id
  from public.cohort_learners learners
  where learners.user_id = v_user_id
    and learners.cohort_id = 'bio-inspired-intervention-2026'
    and learners.course_id = 'bio-inspired'
    and learners.status in ('invited', 'active')
    and learners.invited_by is not null;

  if v_study_id is null or v_study_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'A valid research Study ID roster row is required';
  end if;

  v_link_hash := pg_catalog.encode(extensions.digest('alget-study-link-v1:' || v_study_id, 'sha256'), 'hex');

  select * into v_schedule
  from public.engineering_study_allocation_schedule schedule
  where schedule.study_link_hash = v_link_hash
    and schedule.experiment_key = 'alget-bio-inspired-agentic-rct-v1'
    and schedule.course_id = 'bio-inspired'
  for update;

  if not found then
    raise exception 'Study assignment has not been provisioned for this Study ID';
  end if;
  if v_schedule.claimed_user_id is not null and v_schedule.claimed_user_id <> v_user_id then
    raise exception 'Study assignment was already claimed by another learner account';
  end if;

  select experiments.id into v_experiment_id
  from public.experiments
  where experiments.experiment_key = v_schedule.experiment_key;

  select arms.id into v_arm_id
  from public.experiment_arms arms
  where arms.experiment_id = v_experiment_id
    and arms.arm_key = v_schedule.assignment_arm;

  if v_experiment_id is null or v_arm_id is null then
    raise exception 'Study experiment or arm is not configured';
  end if;

  v_assignment_hash := pg_catalog.encode(extensions.digest(
    v_schedule.study_link_hash || ':' || v_schedule.assignment_arm || ':' ||
    v_schedule.allocation_block || ':' || v_schedule.assignment_seed_hash,
    'sha256'
  ), 'hex');

  insert into public.experiment_assignments (
    user_id, experiment_id, arm_id, course_id, stratum_key,
    assignment_seed, allocation_ratio, assignment_version, assignment_hash
  ) values (
    v_user_id, v_experiment_id, v_arm_id, v_schedule.course_id, v_schedule.stratum_key,
    'sha256:' || v_schedule.assignment_seed_hash, 0.5, 'permuted-block-schedule-v1', v_assignment_hash
  )
  on conflict (user_id, experiment_id) do nothing;

  select arms.arm_key into v_existing_arm
  from public.experiment_assignments assignments
  join public.experiment_arms arms on arms.id = assignments.arm_id
  where assignments.user_id = v_user_id
    and assignments.experiment_id = v_experiment_id;

  if v_existing_arm is distinct from v_schedule.assignment_arm then
    raise exception 'Persisted assignment conflicts with the concealed schedule';
  end if;

  update public.engineering_study_allocation_schedule schedule
  set claimed_user_id = v_user_id,
      claimed_at = coalesce(schedule.claimed_at, now())
  where schedule.study_link_hash = v_schedule.study_link_hash;

  return query select
    v_schedule.experiment_key,
    v_schedule.course_id,
    v_schedule.assignment_arm,
    v_schedule.stratum_key,
    v_schedule.allocation_block,
    v_assignment_hash;
end;
$$;

revoke all on function public.claim_engineering_study_assignment() from public, anon;
grant execute on function public.claim_engineering_study_assignment() to authenticated;

comment on table public.engineering_study_allocation_schedule is
  'Service-role-only concealed permuted-block schedule keyed by the domain-separated SHA-256 Study-ID link. Contains no names, contacts, or raw Study IDs.';
comment on function public.claim_engineering_study_assignment() is
  'Claims the authenticated research learner''s pre-provisioned arm. Learners cannot supply or alter user, seed, block, stratum, or arm.';

-- Extend the earlier privacy-safe event view after the allocation table exists.
-- Existing view columns remain in the same order; randomization fields append.
create or replace view public.engineering_sim_event_export
with (security_invoker = true) as
select
  pg_catalog.encode(extensions.digest('alget-engineering-sim-v1:' || events.user_id::text, 'sha256'), 'hex') as actor_hash,
  pg_catalog.encode(extensions.digest('alget-study-link-v1:' || lower(trim(learners.learner_hash)), 'sha256'), 'hex') as study_link_hash,
  arms.arm_key as assignment_arm,
  experiments.experiment_key,
  events.session_id,
  events.course_id,
  events.section_id,
  events.event_type,
  events.event_ts,
  events.client_seq,
  jsonb_strip_nulls(jsonb_build_object(
    'source_app', payload->'data'->>'source_app',
    'source_schema', payload->'data'->>'source_schema',
    'app_id', payload->'data'->>'app_id',
    'event_name', payload->'data'->>'event_name',
    'opportunity_index', case when payload->'data'->>'opportunity_index' ~ '^[0-9]+$' then (payload->'data'->>'opportunity_index')::int end,
    'opportunities_completed', case when payload->'data'->>'opportunities_completed' ~ '^[0-9]+$' then (payload->'data'->>'opportunities_completed')::int end,
    'opportunities_available', case when payload->'data'->>'opportunities_available' ~ '^[0-9]+$' then (payload->'data'->>'opportunities_available')::int end,
    'normalized_opportunity_progress', case when payload->'data'->>'normalized_opportunity_progress' ~ '^[+-]?[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$' then (payload->'data'->>'normalized_opportunity_progress')::numeric end,
    'input_name', case when payload->'data'->>'input_name' ~ '^[A-Za-z0-9_,.-]{1,160}$' then payload->'data'->>'input_name' end,
    'prediction', case when nullif(trim(payload->'data'->>'prediction'), '') is not null then pg_catalog.encode(extensions.digest('alget-sim-category-v1:' || lower(trim(payload->'data'->>'prediction')), 'sha256'), 'hex') end,
    'confidence', case when payload->'data'->>'confidence' ~ '^[+-]?[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$' and (payload->'data'->>'confidence')::numeric between 0 and 100 then (payload->'data'->>'confidence')::numeric end,
    'result', case when nullif(trim(payload->'data'->>'result'), '') is not null then pg_catalog.encode(extensions.digest('alget-sim-category-v1:' || lower(trim(payload->'data'->>'result')), 'sha256'), 'hex') end,
    'constraint_violation', case when nullif(trim(payload->'data'->>'constraint_flags'), '') is null or lower(trim(payload->'data'->>'constraint_flags')) in ('none', 'ok', 'pass') then false else true end,
    'revision_attempt', case when payload->'data'->>'revision_attempt' ~ '^[0-9]+$' then (payload->'data'->>'revision_attempt')::int end,
    'is_final_design', case when lower(payload->'data'->>'is_final_design') in ('true', 'false') then (payload->'data'->>'is_final_design')::boolean end,
    'competency_score', case when payload->'data'->>'competency_score' ~ '^[+-]?[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$' and (payload->'data'->>'competency_score')::numeric between 0 and 100 then (payload->'data'->>'competency_score')::numeric end
  )) as payload,
  assignments.stratum_key as randomization_stratum,
  schedule.allocation_block as randomization_block,
  schedule.baseline_band,
  schedule.course_section
from public.interaction_events events
join public.cohort_learners learners on learners.user_id = events.user_id
  and learners.cohort_id = 'bio-inspired-intervention-2026'
  and learners.course_id = 'bio-inspired'
left join public.experiment_assignments assignments on assignments.user_id = events.user_id
  and (assignments.course_id is null or assignments.course_id = events.course_id)
  and assignments.experiment_id = (
    select id from public.experiments where experiment_key = 'alget-bio-inspired-agentic-rct-v1'
  )
left join public.experiment_arms arms on arms.id = assignments.arm_id
left join public.experiments experiments on experiments.id = assignments.experiment_id
left join public.engineering_study_allocation_schedule schedule
  on schedule.study_link_hash = pg_catalog.encode(extensions.digest('alget-study-link-v1:' || lower(trim(learners.learner_hash)), 'sha256'), 'hex')
  and schedule.experiment_key = experiments.experiment_key
where events.course_id = 'bio-inspired'
  and (
    events.event_type like 'sim_unity_%'
    or events.event_type in ('sim_open', 'sim_close', 'sim_design', 'sim_mastery')
  );

comment on view public.engineering_sim_event_export is
  'Pseudonymized Bio-Inspired research-cohort simulation export with one study assignment per event and preregistered randomization block. Choice labels are domain-separated hashes and constraint state is derived. Excludes input values, detail, finalDesign, free response, device data, names, contact data, nonstudy learners, other courses, and direct identifiers.';

revoke all on public.engineering_sim_event_export from public, anon, authenticated;
grant select on public.engineering_sim_event_export to service_role;
