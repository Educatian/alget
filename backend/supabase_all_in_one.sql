-- ============================================================================
-- ALGET Supabase All-in-One Schema
-- Clean consolidated SQL for a fresh or resettable project setup.
-- This file merges the project schema, logging, social, learning, feature,
-- and research layers into one rerunnable script.
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists vector;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

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

-- ============================================================================
-- CORE REFERENCE TABLES
-- ============================================================================

create table if not exists concepts (
    id text primary key,
    name text not null,
    definition text,
    formula text,
    formula_latex text,
    misconception_triggers text[],
    related_concepts text[],
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

insert into concepts (id, name, definition, formula, formula_latex, misconception_triggers, related_concepts) values
    ('equilibrium', 'Equilibrium', 'A state where the net force on a body is zero', 'Sigma F = 0', '\sum \vec{F} = 0',
     array['confusing equilibrium with rest', 'forgetting reaction forces'],
     array['sum_of_forces', 'fbd']),
    ('sum_of_forces', 'Sum of Forces', 'Vector addition of all forces acting on a body', 'Sigma Fx = 0, Sigma Fy = 0', '\sum F_x = 0, \sum F_y = 0',
     array['not breaking into components', 'wrong sign convention'],
     array['equilibrium', 'tension']),
    ('fbd', 'Free Body Diagram', 'A diagram showing all external forces on an isolated body', null, null,
     array['missing forces', 'including internal forces', 'wrong direction'],
     array['equilibrium', 'tension']),
    ('tension', 'Tension', 'A pulling force transmitted through a string, cable, or rope', 'T', 'T',
     array['confusing tension direction', 'assuming tension equals weight in every case'],
     array['equilibrium', 'sum_of_forces'])
on conflict (id) do nothing;

create table if not exists sections (
    id serial primary key,
    course text not null,
    chapter int not null,
    section int not null,
    title text not null,
    description text,
    concept_ids text[],
    prereq_section_ids int[],
    learning_objectives text[],
    estimated_time_minutes int default 30,
    created_at timestamptz default now(),
    unique(course, chapter, section)
);

insert into sections (course, chapter, section, title, description, concept_ids, learning_objectives, estimated_time_minutes) values
    ('statics', 1, 1, 'Equilibrium Conditions', 'Introduction to equilibrium for particles',
     array['equilibrium', 'sum_of_forces', 'fbd', 'tension'],
     array['Define equilibrium for a particle', 'Apply Sigma F = 0 to solve for unknown forces', 'Construct and interpret free body diagrams'],
     25)
on conflict (course, chapter, section) do nothing;

create table if not exists problems (
    id text primary key,
    section_id int references sections(id),
    problem_type text not null default 'numeric',
    difficulty text default 'medium',
    statement text not null,
    givens_schema jsonb,
    solver_id text,
    solver_params jsonb,
    expected_value float,
    expected_unit text,
    tolerance float default 0.02,
    require_unit boolean default true,
    hint text,
    explanation text,
    q_matrix jsonb,
    created_at timestamptz default now()
);

insert into problems (id, section_id, problem_type, difficulty, statement, givens_schema, solver_id, solver_params, expected_value, expected_unit, tolerance, require_unit, hint) values
    ('p001', 1, 'numeric', 'medium',
     'A 50 kg object is suspended by a single cable at an angle of 45 degrees from horizontal. Calculate the tension in the cable.',
     '{"mass": "50 kg", "angle": "45 degrees", "g": "9.81 m/s^2"}'::jsonb,
     'statics_tension_inclined',
     '{"mass": 50, "angle_deg": 45}'::jsonb,
     693.67, 'N', 0.02, true,
     'Use Sigma Fy = 0. The vertical component of tension, T*sin(45 degrees), must equal the weight mg.'),
    ('p002', 1, 'numeric', 'easy',
     'A 25 kg lamp hangs vertically from a single cable. What is the tension in the cable?',
     '{"mass": "25 kg", "g": "9.81 m/s^2"}'::jsonb,
     'statics_tension_vertical',
     '{"mass": 25}'::jsonb,
     245.25, 'N', 0.01, true,
     'For a vertically hanging object, the tension equals the weight.')
on conflict (id) do nothing;

create table if not exists problem_steps (
    id serial primary key,
    problem_id text references problems(id) on delete cascade,
    step_index int not null,
    step_type text default 'calculation',
    description text not null,
    expected_value float,
    expected_unit text,
    partial_credit_rule jsonb,
    unique(problem_id, step_index)
);

insert into problem_steps (problem_id, step_index, step_type, description, expected_value, expected_unit) values
    ('p001', 1, 'calculation', 'Calculate the weight W = mg', 490.5, 'N'),
    ('p001', 2, 'calculation', 'Apply Sigma Fy = 0 and solve for T', 693.67, 'N'),
    ('p002', 1, 'calculation', 'Calculate T = mg', 245.25, 'N')
on conflict (problem_id, step_index) do nothing;

-- ============================================================================
-- LEARNING AND SESSION TABLES
-- ============================================================================

create table if not exists attempts (
    id serial primary key,
    user_id uuid references auth.users(id) on delete cascade,
    problem_id text references problems(id),
    step_index int,
    answer text not null,
    answer_numeric float,
    unit text,
    is_correct boolean,
    is_unit_correct boolean,
    feedback text,
    time_spent_seconds int,
    hint_used boolean default false,
    created_at timestamptz default now()
);

create index if not exists idx_attempts_user on attempts(user_id);
create index if not exists idx_attempts_problem on attempts(problem_id);
create index if not exists idx_attempts_created on attempts(created_at);

create table if not exists stuck_events (
    id serial primary key,
    user_id uuid references auth.users(id) on delete cascade,
    section_id int references sections(id),
    problem_id text references problems(id),
    reason text not null,
    consecutive_wrong_count int,
    idle_duration_seconds int,
    context jsonb,
    rail_opened boolean default false,
    rail_action_taken text,
    resolved boolean default false,
    resolved_at timestamptz,
    created_at timestamptz default now()
);

create index if not exists idx_stuck_user on stuck_events(user_id);
create index if not exists idx_stuck_section on stuck_events(section_id);
create index if not exists idx_stuck_created on stuck_events(created_at);

create table if not exists mastery (
    user_id uuid references auth.users(id) on delete cascade,
    concept_id text references concepts(id),
    mastery_score float default 0.0,
    p_known float default 0.1,
    p_guess float default 0.2,
    p_slip float default 0.1,
    p_transit float default 0.1,
    attempts_count int default 0,
    correct_count int default 0,
    last_practiced_at timestamptz,
    misconception_flags text[],
    confidence_level text default 'low',
    updated_at timestamptz default now(),
    primary key (user_id, concept_id)
);

create table if not exists learning_sessions (
    id serial primary key,
    user_id uuid references auth.users(id) on delete cascade,
    section_id int references sections(id),
    started_at timestamptz default now(),
    ended_at timestamptz,
    duration_seconds int,
    problems_attempted int default 0,
    problems_correct int default 0,
    stuck_events_count int default 0,
    rail_interactions_count int default 0,
    completion_status text default 'in_progress'
);

create index if not exists idx_sessions_user on learning_sessions(user_id);
create index if not exists idx_sessions_section on learning_sessions(section_id);

create table if not exists course_progress (
    user_id uuid not null references auth.users(id) on delete cascade,
    section_id text not null,
    course text not null,
    chapter text not null,
    section text not null,
    completed_at timestamptz default now(),
    last_synced_at timestamptz default now(),
    primary key (user_id, section_id)
);

create index if not exists idx_course_progress_course on course_progress(course);
create index if not exists idx_course_progress_completed_at on course_progress(completed_at desc);

-- ============================================================================
-- LOGGING TABLES
-- ============================================================================

create table if not exists event_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    session_id uuid not null,
    sequence_num int not null,
    event_type text not null,
    event_target text,
    event_data jsonb default '{}'::jsonb,
    section_id text,
    client_ts timestamptz not null,
    server_ts timestamptz default now(),
    unique(session_id, sequence_num)
);

create index if not exists idx_event_logs_user on event_logs(user_id);
create index if not exists idx_event_logs_session on event_logs(session_id);
create index if not exists idx_event_logs_type on event_logs(event_type);
create index if not exists idx_event_logs_section on event_logs(section_id);
create index if not exists idx_event_logs_client_ts on event_logs(client_ts);

create table if not exists user_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    started_at timestamptz default now(),
    ended_at timestamptz,
    duration_ms int,
    total_events int default 0,
    device_info jsonb default '{}'::jsonb,
    last_section_id text
);

create index if not exists idx_user_sessions_user on user_sessions(user_id);
create index if not exists idx_user_sessions_started on user_sessions(started_at);

-- ============================================================================
-- SOCIAL TABLES
-- ============================================================================

create table if not exists social_signals (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    section_id text not null,
    course text,
    heading text,
    concept_id text,
    signal_type text not null,
    signal_value text,
    payload jsonb default '{}'::jsonb,
    created_at timestamptz default now()
);

create index if not exists idx_social_signals_section on social_signals(section_id);
create index if not exists idx_social_signals_type on social_signals(signal_type);
create index if not exists idx_social_signals_created on social_signals(created_at desc);

create table if not exists social_presence (
    presence_key text primary key,
    user_id uuid references auth.users(id) on delete cascade,
    alias text not null,
    color_token text,
    course text,
    section_id text not null,
    section_title text,
    heading text,
    concept_id text,
    joined_at timestamptz default now(),
    last_seen_at timestamptz default now()
);

create index if not exists idx_social_presence_last_seen on social_presence(last_seen_at desc);
create index if not exists idx_social_presence_section on social_presence(section_id);

-- ============================================================================
-- FEATURE TABLES
-- ============================================================================

create table if not exists highlights (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    section_id text not null,
    start_offset int not null default 0,
    end_offset int not null default 0,
    text_content text not null,
    color text default 'yellow',
    note text,
    created_at timestamptz default now()
);

create index if not exists idx_highlights_user on highlights(user_id);
create index if not exists idx_highlights_section on highlights(section_id);
create index if not exists idx_highlights_text on highlights(text_content);

create table if not exists chat_history (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    section_id text not null,
    messages jsonb not null default '[]'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique(user_id, section_id)
);

create index if not exists idx_chat_history_user on chat_history(user_id);
create index if not exists idx_chat_history_section on chat_history(section_id);

-- ============================================================================
-- RESEARCH TABLES
-- ============================================================================

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

create index if not exists idx_experiment_assignments_user on experiment_assignments(user_id);

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

create index if not exists learner_concept_state_user_idx on learner_concept_state(user_id, updated_at desc);
create index if not exists learner_concept_state_concept_idx on learner_concept_state(concept_id);

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

create index if not exists interaction_events_user_time_idx on interaction_events(user_id, event_ts desc);
create index if not exists interaction_events_section_time_idx on interaction_events(section_id, event_ts desc);
create index if not exists interaction_events_payload_gin on interaction_events using gin(payload);

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

create index if not exists recommendation_decisions_user_idx on recommendation_decisions(user_id, created_at desc);
create index if not exists recommendation_decisions_section_idx on recommendation_decisions(section_id, created_at desc);

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

create index if not exists intervention_trace_events_trace_idx on intervention_trace_events(trace_id, event_ts);

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

create unique index if not exists evaluation_runs_unique_phase on evaluation_runs(user_id, course_id, phase);

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

create index if not exists idx_generated_feedback_trace on generated_feedback(trace_id, created_at desc);

create table if not exists content_audits (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid references generated_feedback(id) on delete cascade,
  rubric_name text not null,
  auto_score double precision,
  rubric_breakdown jsonb not null default '{}'::jsonb,
  approved boolean,
  created_at timestamptz not null default now()
);

create index if not exists idx_content_audits_feedback on content_audits(feedback_id, created_at desc);

create table if not exists human_ratings (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id uuid not null,
  rater_id uuid not null references auth.users(id) on delete cascade,
  rubric_name text not null,
  rating jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_human_ratings_target on human_ratings(target_type, target_id, created_at desc);

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

alter table concepts enable row level security;
alter table sections enable row level security;
alter table problems enable row level security;
alter table problem_steps enable row level security;
alter table attempts enable row level security;
alter table stuck_events enable row level security;
alter table mastery enable row level security;
alter table learning_sessions enable row level security;
alter table course_progress enable row level security;
alter table event_logs enable row level security;
alter table user_sessions enable row level security;
alter table social_signals enable row level security;
alter table social_presence enable row level security;
alter table highlights enable row level security;
alter table chat_history enable row level security;
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

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

drop policy if exists "Public read concepts" on concepts;
create policy "Public read concepts" on concepts for select to authenticated using (true);

drop policy if exists "Public read sections" on sections;
create policy "Public read sections" on sections for select to authenticated using (true);

drop policy if exists "Public read problems" on problems;
create policy "Public read problems" on problems for select to authenticated using (true);

drop policy if exists "Public read problem_steps" on problem_steps;
create policy "Public read problem_steps" on problem_steps for select to authenticated using (true);

drop policy if exists "Users can view own attempts" on attempts;
create policy "Users can view own attempts" on attempts
    for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own attempts" on attempts;
create policy "Users can insert own attempts" on attempts
    for insert with check (auth.uid() = user_id);

drop policy if exists "Users can view own stuck_events" on stuck_events;
create policy "Users can view own stuck_events" on stuck_events
    for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own stuck_events" on stuck_events;
create policy "Users can insert own stuck_events" on stuck_events
    for insert with check (auth.uid() = user_id);

drop policy if exists "Users can view own mastery" on mastery;
create policy "Users can view own mastery" on mastery
    for select using (auth.uid() = user_id or auth.uid() is null);

drop policy if exists "Users can update own mastery" on mastery;
create policy "Users can update own mastery" on mastery
    for all using (auth.uid() = user_id or auth.uid() is null);

drop policy if exists "Users can manage own sessions" on learning_sessions;
create policy "Users can manage own sessions" on learning_sessions
    for all using (auth.uid() = user_id);

drop policy if exists "Users can manage own course progress" on course_progress;
create policy "Users can manage own course progress" on course_progress
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can read course progress" on course_progress;
create policy "Authenticated users can read course progress" on course_progress
    for select to authenticated using (true);

drop policy if exists "Users can manage own event_logs" on event_logs;
create policy "Users can manage own event_logs" on event_logs
    for all using (auth.uid() = user_id);

drop policy if exists "Users can manage own sessions" on user_sessions;
create policy "Users can manage own sessions" on user_sessions
    for all using (auth.uid() = user_id);

drop policy if exists "Users can insert own social signals" on social_signals;
create policy "Users can insert own social signals" on social_signals
    for insert with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can read social signals" on social_signals;
create policy "Authenticated users can read social signals" on social_signals
    for select to authenticated using (true);

drop policy if exists "Users can delete own social signals" on social_signals;
create policy "Users can delete own social signals" on social_signals
    for delete using (auth.uid() = user_id);

drop policy if exists "Users can manage own social presence" on social_presence;
create policy "Users can manage own social presence" on social_presence
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can read social presence" on social_presence;
create policy "Authenticated users can read social presence" on social_presence
    for select to authenticated using (true);

drop policy if exists "Users can manage own highlights" on highlights;
create policy "Users can manage own highlights" on highlights
    for all using (auth.uid() = user_id);

drop policy if exists "Authenticated users can read all highlights" on highlights;
create policy "Authenticated users can read all highlights" on highlights
    for select to authenticated using (true);

drop policy if exists "Users can manage own chat history" on chat_history;
create policy "Users can manage own chat history" on chat_history
    for all using (auth.uid() = user_id);

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
      select 1 from intervention_traces traces
      where traces.trace_id = intervention_trace_events.trace_id
        and traces.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from intervention_traces traces
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
      select 1 from evaluation_runs runs
      where runs.id = evaluation_responses.evaluation_id
        and runs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from evaluation_runs runs
      where runs.id = evaluation_responses.evaluation_id
        and runs.user_id = auth.uid()
    )
  );

drop policy if exists "Users can manage own generated feedback" on generated_feedback;
create policy "Users can manage own generated feedback" on generated_feedback
  for all using (
    exists (
      select 1 from intervention_traces traces
      where traces.trace_id = generated_feedback.trace_id
        and traces.user_id = auth.uid()
    )
  )
  with check (
    generated_feedback.trace_id is not null
    and exists (
      select 1 from intervention_traces traces
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

-- ============================================================================
-- ANALYTICS AND RESEARCH VIEWS
-- ============================================================================

drop view if exists user_section_progress;
create or replace view user_section_progress as
select
    s.user_id,
    sec.id as section_id,
    sec.course,
    sec.chapter,
    sec.section,
    sec.title,
    count(distinct a.problem_id) as problems_attempted,
    count(distinct case when a.is_correct then a.problem_id end) as problems_correct,
    avg(case when a.is_correct then 1.0 else 0.0 end) as accuracy_rate,
    count(distinct se.id) as stuck_events,
    max(a.created_at) as last_activity
from learning_sessions s
join sections sec on s.section_id = sec.id
left join attempts a on a.user_id = s.user_id and a.problem_id in (
    select id from problems where section_id = sec.id
)
left join stuck_events se on se.user_id = s.user_id and se.section_id = sec.id
group by s.user_id, sec.id, sec.course, sec.chapter, sec.section, sec.title;

drop view if exists concept_mastery_summary;
create or replace view concept_mastery_summary as
select
    c.id as concept_id,
    c.name,
    m.user_id,
    m.mastery_score,
    m.attempts_count,
    m.correct_count,
    m.confidence_level,
    m.misconception_flags,
    m.last_practiced_at
from concepts c
left join mastery m on c.id = m.concept_id;

drop view if exists popular_highlights;
create or replace view popular_highlights as
select
    section_id,
    text_content,
    min(start_offset) as start_offset,
    max(end_offset) as end_offset,
    count(distinct user_id) as highlight_count,
    array_agg(distinct user_id) as user_ids
from highlights
group by section_id, text_content
having count(distinct user_id) >= 2;

drop view if exists session_event_sequence;
create or replace view session_event_sequence as
select
    s.id as session_id,
    s.user_id,
    s.started_at as session_start,
    e.sequence_num,
    e.event_type,
    e.event_target,
    e.event_data,
    e.section_id,
    e.client_ts,
    lag(e.event_type) over (partition by s.id order by e.sequence_num) as prev_event,
    lead(e.event_type) over (partition by s.id order by e.sequence_num) as next_event,
    e.client_ts - lag(e.client_ts) over (partition by s.id order by e.sequence_num) as time_since_prev
from user_sessions s
join event_logs e on s.id = e.session_id
order by s.id, e.sequence_num;

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

grant select on popular_highlights to authenticated;
grant select on session_event_sequence to authenticated;
grant select on research_trace_summary to authenticated;

select 'ALGET all-in-one schema ready' as status;
