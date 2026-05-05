-- ============================================================================
-- ALGET Research Layer Schema - Supabase SQL
-- Execute after:
--   1. supabase_schema.sql
--   2. supabase_logging.sql
--   3. supabase_social_features.sql
--   4. supabase_learning_features.sql
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists vector;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'intervention_action') then
    create type intervention_action as enum ('explain', 'represent', 'practice', 'ask', 'advance');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'eval_phase') then
    create type eval_phase as enum ('pre', 'post', 'retention');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'trace_status') then
    create type trace_status as enum ('recommended', 'engaged', 'awaiting_outcome', 'resolved_positive', 'resolved_negative');
  end if;
end
$$;

create table if not exists model_registry (
  id uuid primary key default gen_random_uuid(),
  model_name text not null,
  model_family text not null,
  version text not null,
  task text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (model_name, version, task)
);

create table if not exists experiments (
  id uuid primary key default gen_random_uuid(),
  experiment_key text not null unique,
  hypothesis text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists experiment_arms (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references experiments(id) on delete cascade,
  arm_key text not null,
  description text not null,
  policy_version text not null,
  unique (experiment_id, arm_key)
);

create table if not exists experiment_assignments (
  user_id uuid not null references auth.users(id) on delete cascade,
  experiment_id uuid not null references experiments(id) on delete cascade,
  arm_id uuid not null references experiment_arms(id) on delete cascade,
  course_id text,
  stratum_key text not null default 'all',
  assignment_seed text not null default 'alget-summer2026-v1',
  allocation_ratio double precision not null default 0.5,
  assignment_version text not null default 'course-blocked-sha256-v1',
  assigned_at timestamptz not null default now(),
  assignment_hash text,
  primary key (user_id, experiment_id)
);

create table if not exists learner_concept_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id text not null references concepts(id) on delete cascade,
  proficiency_mu double precision not null default 0,
  proficiency_sigma double precision not null default 1,
  mastery_prob double precision not null default 0.1,
  forgetting_half_life_hours double precision,
  forgetting_risk double precision not null default 0.5,
  transfer_readiness double precision not null default 0,
  confidence_mean double precision not null default 0.5,
  calibration_error double precision not null default 0,
  dominant_misconception text,
  attempts_count integer not null default 0,
  correct_count integer not null default 0,
  last_seen_at timestamptz,
  last_correct_at timestamptz,
  model_version text,
  updated_at timestamptz not null default now(),
  primary key (user_id, concept_id)
);

create index if not exists learner_concept_state_user_idx
  on learner_concept_state(user_id, updated_at desc);

create index if not exists learner_concept_state_concept_idx
  on learner_concept_state(concept_id);

create table if not exists interaction_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  session_id uuid,
  course_id text,
  section_id text,
  item_id text,
  event_type text not null,
  event_ts timestamptz not null default now(),
  client_seq bigint,
  payload jsonb not null default '{}'::jsonb,
  experiment_arm_id uuid references experiment_arms(id)
);

create index if not exists interaction_events_user_time_idx
  on interaction_events(user_id, event_ts desc);

create index if not exists interaction_events_section_time_idx
  on interaction_events(section_id, event_ts desc);

create index if not exists interaction_events_payload_gin
  on interaction_events using gin(payload);

create unique index if not exists interaction_events_session_seq_unique
  on interaction_events(session_id, client_seq)
  where session_id is not null and client_seq is not null;

create table if not exists recommendation_decisions (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid not null unique,
  user_id uuid references auth.users(id) on delete cascade,
  course_id text,
  section_id text not null,
  concept_ids text[] not null default '{}',
  chosen_action intervention_action not null,
  learner_state_snapshot jsonb not null,
  candidate_actions jsonb not null,
  evidence_snapshot jsonb not null,
  explanation_snapshot jsonb not null,
  policy_score jsonb not null default '{}'::jsonb,
  policy_model_id uuid references model_registry(id),
  explanation_model_id uuid references model_registry(id),
  created_at timestamptz not null default now()
);

create index if not exists recommendation_decisions_user_idx
  on recommendation_decisions(user_id, created_at desc);

create index if not exists recommendation_decisions_section_idx
  on recommendation_decisions(section_id, created_at desc);

create table if not exists intervention_traces (
  trace_id uuid primary key,
  recommendation_id uuid not null references recommendation_decisions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  section_id text not null,
  status trace_status not null default 'recommended',
  accepted boolean,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  outcome_label text,
  immediate_reward double precision,
  retention_reward double precision,
  notes jsonb not null default '{}'::jsonb
);

create table if not exists intervention_trace_events (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid not null references intervention_traces(trace_id) on delete cascade,
  event_type text not null,
  event_ts timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists intervention_trace_events_trace_idx
  on intervention_trace_events(trace_id, event_ts);

create table if not exists evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null,
  phase eval_phase not null,
  form_key text,
  experiment_arm_id uuid references experiment_arms(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  score_raw double precision,
  score_pct double precision,
  delayed_days integer,
  notes jsonb not null default '{}'::jsonb
);

create unique index if not exists evaluation_runs_unique_phase
  on evaluation_runs(user_id, course_id, phase);

create table if not exists evaluation_responses (
  evaluation_id uuid not null references evaluation_runs(id) on delete cascade,
  item_id text not null,
  concept_id text references concepts(id) on delete set null,
  is_correct boolean not null,
  confidence double precision,
  latency_ms integer,
  misconception_label text,
  response_payload jsonb not null default '{}'::jsonb,
  primary key (evaluation_id, item_id)
);

create index if not exists idx_evaluation_responses_concept
  on evaluation_responses(concept_id);

create index if not exists idx_evaluation_responses_correct
  on evaluation_responses(is_correct);

create table if not exists generated_feedback (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid references intervention_traces(trace_id) on delete set null,
  support_type text not null,
  prompt_version text not null,
  retrieved_context jsonb not null default '{}'::jsonb,
  generated_text text not null,
  validator_pass boolean,
  created_at timestamptz not null default now()
);

create table if not exists artifact_revision_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  section_id text not null,
  course_id text,
  artifact_type text,
  studio_mode text,
  trace_event_id uuid references interaction_events(id) on delete set null,
  judgment text check (judgment in ('accept', 'modify', 'reject', 'defer')),
  trace_score integer not null default 0,
  trace_denominator integer not null default 8,
  claim_clarity double precision not null default 0,
  evidence_alignment double precision not null default 0,
  revision_depth double precision not null default 0,
  judgment_quality double precision not null default 0,
  transfer_readiness double precision not null default 0,
  specificity_delta double precision not null default 0,
  overall_revision_quality double precision not null default 0,
  diagnostics jsonb not null default '{}'::jsonb,
  privacy_policy text not null default 'score-derived-only-v1',
  scorer_version text not null default 'artifact-revision-scorer-v1',
  instructor_override jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists artifact_revision_scores_section_idx
  on artifact_revision_scores(section_id, created_at desc);

create index if not exists artifact_revision_scores_user_idx
  on artifact_revision_scores(user_id, created_at desc);

create table if not exists content_audits (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid references generated_feedback(id) on delete cascade,
  rubric_name text not null,
  auto_score double precision,
  rubric_breakdown jsonb not null default '{}'::jsonb,
  approved boolean,
  created_at timestamptz not null default now()
);

create table if not exists human_ratings (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id uuid not null,
  rater_id uuid not null references auth.users(id) on delete cascade,
  rubric_name text not null,
  rating jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_experiment_assignments_user
  on experiment_assignments(user_id);

create index if not exists idx_experiment_assignments_course_stratum
  on experiment_assignments(experiment_id, course_id, stratum_key);

create or replace function assign_experiment_arm(
  p_user_id uuid,
  p_experiment_key text,
  p_course_id text,
  p_stratum_key text default 'all',
  p_assignment_seed text default 'alget-summer2026-v1',
  p_allocation_ratio double precision default 0.5
) returns table (
  user_id uuid,
  experiment_id uuid,
  arm_id uuid,
  arm_key text,
  assignment_hash text
) language plpgsql security definer set search_path = public as $$
declare
  v_experiment_id uuid;
  v_hash text;
  v_bucket numeric;
  v_arm_key text;
  v_arm_id uuid;
begin
  if p_allocation_ratio <= 0 or p_allocation_ratio >= 1 then
    raise exception 'allocation_ratio must be between 0 and 1';
  end if;

  select id into v_experiment_id
  from experiments
  where experiment_key = p_experiment_key;

  if v_experiment_id is null then
    raise exception 'Unknown experiment_key: %', p_experiment_key;
  end if;

  v_hash := encode(digest(
    p_experiment_key || ':' || p_user_id::text || ':' || coalesce(p_course_id, '') || ':' ||
    coalesce(p_stratum_key, 'all') || ':' || p_assignment_seed,
    'sha256'
  ), 'hex');
  v_bucket := ('x' || substr(v_hash, 1, 12))::bit(48)::bigint::numeric / 281474976710655;
  v_arm_key := case
    when v_bucket < p_allocation_ratio then 'treatment_annotation_adaptive'
    else 'comparison_practice_only'
  end;

  select id into v_arm_id
  from experiment_arms
  where experiment_arms.experiment_id = v_experiment_id
    and experiment_arms.arm_key = v_arm_key;

  if v_arm_id is null then
    raise exception 'Missing arm % for experiment %', v_arm_key, p_experiment_key;
  end if;

  insert into experiment_assignments (
    user_id,
    experiment_id,
    arm_id,
    course_id,
    stratum_key,
    assignment_seed,
    allocation_ratio,
    assignment_version,
    assignment_hash
  ) values (
    p_user_id,
    v_experiment_id,
    v_arm_id,
    p_course_id,
    coalesce(p_stratum_key, 'all'),
    p_assignment_seed,
    p_allocation_ratio,
    'course-blocked-sha256-v1',
    v_hash
  )
  on conflict (user_id, experiment_id) do update set
    arm_id = experiment_assignments.arm_id,
    assigned_at = experiment_assignments.assigned_at
  returning experiment_assignments.user_id,
    experiment_assignments.experiment_id,
    experiment_assignments.arm_id,
    v_arm_key,
    experiment_assignments.assignment_hash
  into user_id, experiment_id, arm_id, arm_key, assignment_hash;

  return next;
end;
$$;

create index if not exists idx_generated_feedback_trace
  on generated_feedback(trace_id, created_at desc);

create index if not exists idx_content_audits_feedback
  on content_audits(feedback_id, created_at desc);

create index if not exists idx_human_ratings_target
  on human_ratings(target_type, target_id, created_at desc);

alter table model_registry enable row level security;
alter table experiments enable row level security;
alter table experiment_arms enable row level security;
alter table experiment_assignments enable row level security;
alter table learner_concept_state enable row level security;
alter table interaction_events enable row level security;
alter table recommendation_decisions enable row level security;
alter table intervention_traces enable row level security;
alter table intervention_trace_events enable row level security;
alter table evaluation_runs enable row level security;
alter table evaluation_responses enable row level security;
alter table artifact_revision_scores enable row level security;
alter table generated_feedback enable row level security;
alter table content_audits enable row level security;
alter table human_ratings enable row level security;

drop policy if exists "Authenticated users can read model registry" on model_registry;
create policy "Authenticated users can read model registry" on model_registry
  for select to authenticated using (true);

drop policy if exists "Authenticated users can read experiments" on experiments;
create policy "Authenticated users can read experiments" on experiments
  for select to authenticated using (true);

drop policy if exists "Authenticated users can read experiment arms" on experiment_arms;
create policy "Authenticated users can read experiment arms" on experiment_arms
  for select to authenticated using (true);

drop policy if exists "Users can read own experiment assignments" on experiment_assignments;
create policy "Users can read own experiment assignments" on experiment_assignments
  for select using (auth.uid() = user_id);

drop policy if exists "Users can manage own learner concept state" on learner_concept_state;
create policy "Users can manage own learner concept state" on learner_concept_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own interaction events" on interaction_events;
create policy "Users can manage own interaction events" on interaction_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own recommendation decisions" on recommendation_decisions;
create policy "Users can manage own recommendation decisions" on recommendation_decisions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own intervention traces" on intervention_traces;
create policy "Users can manage own intervention traces" on intervention_traces
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own intervention trace events" on intervention_trace_events;
create policy "Users can manage own intervention trace events" on intervention_trace_events
  for all using (
    exists (
      select 1
      from intervention_traces traces
      where traces.trace_id = intervention_trace_events.trace_id
        and traces.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from intervention_traces traces
      where traces.trace_id = intervention_trace_events.trace_id
        and traces.user_id = auth.uid()
    )
  );

drop policy if exists "Users can manage own evaluation runs" on evaluation_runs;
create policy "Users can manage own evaluation runs" on evaluation_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own evaluation responses" on evaluation_responses;
create policy "Users can manage own evaluation responses" on evaluation_responses
  for all using (
    exists (
      select 1
      from evaluation_runs runs
      where runs.id = evaluation_responses.evaluation_id
        and runs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from evaluation_runs runs
      where runs.id = evaluation_responses.evaluation_id
        and runs.user_id = auth.uid()
    )
  );

drop policy if exists "Users can manage own artifact revision scores" on artifact_revision_scores;
create policy "Users can manage own artifact revision scores" on artifact_revision_scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own generated feedback" on generated_feedback;
create policy "Users can manage own generated feedback" on generated_feedback
  for all using (
    exists (
      select 1
      from intervention_traces traces
      where traces.trace_id = generated_feedback.trace_id
        and traces.user_id = auth.uid()
    )
  )
  with check (
    generated_feedback.trace_id is not null
    and exists (
      select 1
      from intervention_traces traces
      where traces.trace_id = generated_feedback.trace_id
        and traces.user_id = auth.uid()
    )
  );

drop policy if exists "Users can read own content audits" on content_audits;
create policy "Users can read own content audits" on content_audits
  for select using (
    exists (
      select 1
      from generated_feedback feedback
      join intervention_traces traces on traces.trace_id = feedback.trace_id
      where feedback.id = content_audits.feedback_id
        and traces.user_id = auth.uid()
    )
  );

drop policy if exists "Users can manage own human ratings" on human_ratings;
create policy "Users can manage own human ratings" on human_ratings
  for all using (auth.uid() = rater_id) with check (auth.uid() = rater_id);

drop view if exists research_trace_summary;
create or replace view research_trace_summary
with (security_invoker = true) as
select
  traces.user_id,
  traces.trace_id,
  traces.section_id,
  traces.status,
  traces.accepted,
  traces.outcome_label,
  traces.immediate_reward,
  traces.retention_reward,
  traces.opened_at,
  traces.closed_at,
  decisions.chosen_action,
  decisions.concept_ids,
  decisions.created_at as recommended_at
from intervention_traces traces
join recommendation_decisions decisions
  on decisions.id = traces.recommendation_id;

grant select on research_trace_summary to authenticated;

drop view if exists research_interaction_event_export;
create or replace view research_interaction_event_export
with (security_invoker = true) as
select
  id,
  user_id,
  session_id,
  course_id,
  section_id,
  item_id,
  event_type,
  event_ts,
  client_seq,
  experiment_arm_id,
  payload
from interaction_events;

grant select on research_interaction_event_export to authenticated;

drop view if exists evaluation_item_response_export;
create or replace view evaluation_item_response_export
with (security_invoker = true) as
select
  runs.user_id,
  runs.course_id,
  runs.phase,
  runs.form_key,
  runs.started_at,
  runs.completed_at,
  responses.evaluation_id,
  responses.item_id,
  responses.concept_id,
  responses.is_correct,
  responses.confidence,
  responses.latency_ms,
  responses.misconception_label,
  responses.response_payload
from evaluation_responses responses
join evaluation_runs runs on runs.id = responses.evaluation_id;

grant select on evaluation_item_response_export to authenticated;

drop view if exists artifact_revision_cohort_summary;
create or replace view artifact_revision_cohort_summary
with (security_invoker = true) as
select
  course_id,
  section_id,
  studio_mode,
  artifact_type,
  count(*) as score_count,
  count(distinct user_id) as learner_count,
  avg(claim_clarity) as avg_claim_clarity,
  avg(evidence_alignment) as avg_evidence_alignment,
  avg(revision_depth) as avg_revision_depth,
  avg(judgment_quality) as avg_judgment_quality,
  avg(transfer_readiness) as avg_transfer_readiness,
  avg(specificity_delta) as avg_specificity_delta,
  avg(overall_revision_quality) as avg_overall_revision_quality,
  count(*) filter (where evidence_alignment < 0.5) as weak_evidence_count,
  count(*) filter (where revision_depth < 0.5) as shallow_revision_count,
  count(*) filter (where judgment_quality < 0.5) as judgment_risk_count,
  count(*) filter (where transfer_readiness >= 0.7) as transfer_ready_count,
  max(created_at) as latest_score_at
from artifact_revision_scores
group by course_id, section_id, studio_mode, artifact_type;

revoke all on artifact_revision_cohort_summary from anon;
grant select on artifact_revision_cohort_summary to authenticated;

drop view if exists artifact_revision_recent_scores;

select 'ALGET research schema ready' as status;
