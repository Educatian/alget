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
create or replace view research_trace_summary as
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

select 'ALGET research schema ready' as status;
