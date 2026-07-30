-- ALGET agentic LMS runtime.
-- Durable, RLS-governed workflows for learner-owned plans and instructor-
-- approved interventions.  High-risk actions remain proposals only.

create or replace function public.is_alget_instructor()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    public.is_alget_operator()
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'instructor'
    or exists (
      select 1 from public.instructor_profiles
      where user_id = auth.uid() and status = 'active'
    );
$$;

create table if not exists public.agent_workflows (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  course_id text not null check (course_id ~ '^[a-z0-9][a-z0-9-]*$'),
  workflow_type text not null check (workflow_type in ('learner_plan', 'instructor_intervention', 'course_operation')),
  status text not null default 'draft' check (status in ('draft', 'awaiting_approval', 'active', 'paused', 'blocked', 'completed', 'cancelled')),
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  goal text not null,
  plan jsonb not null default '{}'::jsonb,
  tool_scopes text[] not null default '{}'::text[],
  budget jsonb not null default '{"max_actions":20,"max_runtime_seconds":300}'::jsonb,
  approval jsonb not null default '{}'::jsonb,
  current_step integer not null default 0 check (current_step >= 0),
  parent_workflow_id uuid references public.agent_workflows(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_workflow_events (
  id bigint generated always as identity primary key,
  workflow_id uuid not null references public.agent_workflows(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.learner_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null check (course_id ~ '^[a-z0-9][a-z0-9-]*$'),
  title text not null check (char_length(title) between 3 and 240),
  target_date date not null,
  target_mastery numeric(4,3) not null default 0.8 check (target_mastery between 0.5 and 1.0),
  weekly_minutes integer not null default 180 check (weekly_minutes between 60 and 1200),
  preferences jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learner_study_plans (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.learner_goals(id) on delete cascade,
  workflow_id uuid not null unique references public.agent_workflows(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  status text not null default 'awaiting_approval' check (status in ('awaiting_approval', 'active', 'paused', 'completed', 'cancelled')),
  plan jsonb not null,
  evidence jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(goal_id, version)
);

create table if not exists public.instructor_intervention_queue (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null unique references public.agent_workflows(id) on delete cascade,
  course_id text not null check (course_id ~ '^[a-z0-9][a-z0-9-]*$'),
  concept_id text not null,
  title text not null,
  proposal jsonb not null,
  evidence jsonb not null default '{}'::jsonb,
  target_user_ids uuid[] not null default '{}'::uuid[],
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high')),
  status text not null default 'awaiting_approval' check (status in ('awaiting_approval', 'approved', 'rejected', 'scheduled', 'completed', 'cancelled')),
  created_by uuid not null references auth.users(id) on delete cascade,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_agentic_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_agent_workflows_updated_at on public.agent_workflows;
create trigger set_agent_workflows_updated_at before update on public.agent_workflows
for each row execute function public.set_agentic_updated_at();
drop trigger if exists set_learner_goals_updated_at on public.learner_goals;
create trigger set_learner_goals_updated_at before update on public.learner_goals
for each row execute function public.set_agentic_updated_at();
drop trigger if exists set_learner_study_plans_updated_at on public.learner_study_plans;
create trigger set_learner_study_plans_updated_at before update on public.learner_study_plans
for each row execute function public.set_agentic_updated_at();
drop trigger if exists set_instructor_intervention_updated_at on public.instructor_intervention_queue;
create trigger set_instructor_intervention_updated_at before update on public.instructor_intervention_queue
for each row execute function public.set_agentic_updated_at();

alter table public.agent_workflows enable row level security;
alter table public.agent_workflow_events enable row level security;
alter table public.learner_goals enable row level security;
alter table public.learner_study_plans enable row level security;
alter table public.instructor_intervention_queue enable row level security;

drop policy if exists "learners manage own workflows" on public.agent_workflows;
create policy "learners manage own workflows" on public.agent_workflows for all to authenticated
using (owner_id = auth.uid() and workflow_type = 'learner_plan')
with check (owner_id = auth.uid() and created_by = auth.uid() and workflow_type = 'learner_plan' and risk_level = 'low');
drop policy if exists "staff manage governed workflows" on public.agent_workflows;
create policy "staff manage governed workflows" on public.agent_workflows for all to authenticated
using (public.is_alget_instructor()) with check (public.is_alget_instructor());

drop policy if exists "workflow owners read events" on public.agent_workflow_events;
create policy "workflow owners read events" on public.agent_workflow_events for select to authenticated
using (exists (select 1 from public.agent_workflows where id = workflow_id and owner_id = auth.uid()));
drop policy if exists "workflow owners append events" on public.agent_workflow_events;
create policy "workflow owners append events" on public.agent_workflow_events for insert to authenticated
with check (actor_id = auth.uid() and exists (select 1 from public.agent_workflows where id = workflow_id and owner_id = auth.uid()));
drop policy if exists "staff manage workflow events" on public.agent_workflow_events;
create policy "staff manage workflow events" on public.agent_workflow_events for all to authenticated
using (public.is_alget_instructor()) with check (public.is_alget_instructor() and actor_id = auth.uid());

drop policy if exists "learners manage own goals" on public.learner_goals;
create policy "learners manage own goals" on public.learner_goals for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "learners manage own study plans" on public.learner_study_plans;
create policy "learners manage own study plans" on public.learner_study_plans for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "staff manage intervention queue" on public.instructor_intervention_queue;
create policy "staff manage intervention queue" on public.instructor_intervention_queue for all to authenticated
using (public.is_alget_instructor()) with check (public.is_alget_instructor());

grant select on public.agent_workflows to authenticated;
grant select on public.agent_workflow_events to authenticated;
grant select on public.learner_goals to authenticated;
grant select on public.learner_study_plans to authenticated;
grant select on public.instructor_intervention_queue to authenticated;
revoke all on function public.is_alget_instructor() from public;
grant execute on function public.is_alget_instructor() to authenticated;

create index if not exists idx_agent_workflows_owner_status on public.agent_workflows(owner_id, status, updated_at desc);
create index if not exists idx_agent_workflows_course_type on public.agent_workflows(course_id, workflow_type, status);
create index if not exists idx_workflow_events_workflow on public.agent_workflow_events(workflow_id, created_at desc);
create index if not exists idx_learner_goals_user on public.learner_goals(user_id, status, target_date);
create index if not exists idx_study_plans_user on public.learner_study_plans(user_id, status, updated_at desc);
create index if not exists idx_intervention_queue_course on public.instructor_intervention_queue(course_id, status, created_at desc);

create or replace function public.transition_agent_workflow(
  p_workflow_id uuid,
  p_target_status text,
  p_reason text default null,
  p_approval jsonb default '{}'::jsonb
)
returns public.agent_workflows
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_row public.agent_workflows;
  previous_status text;
  transition_allowed boolean := false;
begin
  select * into current_row from public.agent_workflows where id = p_workflow_id for update;
  if current_row.id is null then raise exception 'workflow_not_found'; end if;
  if current_row.owner_id <> auth.uid() and not public.is_alget_instructor() then
    raise exception 'workflow_access_denied';
  end if;
  if current_row.workflow_type = 'learner_plan' and current_row.owner_id <> auth.uid() then
    raise exception 'learner_plan_owner_required';
  end if;
  previous_status := current_row.status;

  transition_allowed := case current_row.status
    when 'draft' then p_target_status in ('awaiting_approval', 'cancelled')
    when 'awaiting_approval' then p_target_status in ('active', 'cancelled', 'blocked')
    when 'active' then p_target_status in ('paused', 'completed', 'blocked', 'cancelled')
    when 'paused' then p_target_status in ('active', 'cancelled')
    when 'blocked' then p_target_status in ('awaiting_approval', 'cancelled')
    else false
  end;
  if not transition_allowed then raise exception 'invalid_workflow_transition'; end if;
  if current_row.status = 'awaiting_approval' and p_target_status = 'active'
     and coalesce((p_approval ->> 'approved')::boolean, false) is not true then
    raise exception 'workflow_approval_required';
  end if;

  update public.agent_workflows
  set status = p_target_status,
      approval = case when p_approval = '{}'::jsonb then approval else p_approval end
  where id = p_workflow_id returning * into current_row;

  insert into public.agent_workflow_events(workflow_id, actor_id, event_type, from_status, to_status, detail)
  values (p_workflow_id, auth.uid(), 'status_transition', previous_status, p_target_status,
          jsonb_build_object('reason', p_reason, 'approval', p_approval));
  return current_row;
end;
$$;

revoke all on function public.transition_agent_workflow(uuid, text, text, jsonb) from public;
grant execute on function public.transition_agent_workflow(uuid, text, text, jsonb) to authenticated;

create or replace function public.create_learner_plan_workflow(
  p_course_id text,
  p_title text,
  p_target_date date,
  p_target_mastery numeric,
  p_weekly_minutes integer,
  p_plan jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  goal_row public.learner_goals;
  workflow_row public.agent_workflows;
  plan_row public.learner_study_plans;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  insert into public.learner_goals(user_id, course_id, title, target_date, target_mastery, weekly_minutes)
  values (auth.uid(), p_course_id, p_title, p_target_date, p_target_mastery, p_weekly_minutes)
  returning * into goal_row;

  insert into public.agent_workflows(owner_id, created_by, course_id, workflow_type, status, risk_level, goal, plan, tool_scopes)
  values (auth.uid(), auth.uid(), p_course_id, 'learner_plan', 'awaiting_approval', 'low', p_title, p_plan,
          array['course.read', 'mastery.read_own', 'study_plan.write_own'])
  returning * into workflow_row;

  insert into public.learner_study_plans(goal_id, workflow_id, user_id, plan, evidence)
  values (goal_row.id, workflow_row.id, auth.uid(), p_plan, coalesce(p_plan -> 'evidence', '{}'::jsonb))
  returning * into plan_row;

  insert into public.agent_workflow_events(workflow_id, actor_id, event_type, to_status, detail)
  values (workflow_row.id, auth.uid(), 'plan_drafted', 'awaiting_approval', jsonb_build_object('goal_id', goal_row.id));
  return jsonb_build_object('goal', to_jsonb(goal_row), 'workflow', to_jsonb(workflow_row), 'study_plan', to_jsonb(plan_row));
end;
$$;

create or replace function public.review_learner_plan(
  p_plan_id uuid,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  plan_row public.learner_study_plans;
  workflow_row public.agent_workflows;
  target_workflow_status text;
  target_plan_status text;
begin
  select * into plan_row from public.learner_study_plans where id = p_plan_id and user_id = auth.uid() for update;
  if plan_row.id is null then raise exception 'study_plan_not_found'; end if;
  if plan_row.status <> 'awaiting_approval' then raise exception 'study_plan_already_reviewed'; end if;
  if p_decision not in ('approve', 'cancel') then raise exception 'invalid_plan_decision'; end if;
  target_workflow_status := case when p_decision = 'approve' then 'active' else 'cancelled' end;
  target_plan_status := case when p_decision = 'approve' then 'active' else 'cancelled' end;

  update public.agent_workflows
  set status = target_workflow_status,
      approval = jsonb_build_object('approved', p_decision = 'approve', 'actor_id', auth.uid(), 'reviewed_at', now())
  where id = plan_row.workflow_id and owner_id = auth.uid() and status = 'awaiting_approval'
  returning * into workflow_row;
  if workflow_row.id is null then raise exception 'workflow_not_awaiting_approval'; end if;

  update public.learner_study_plans
  set status = target_plan_status,
      approved_at = case when p_decision = 'approve' then now() else null end
  where id = p_plan_id returning * into plan_row;

  insert into public.agent_workflow_events(workflow_id, actor_id, event_type, from_status, to_status, detail)
  values (workflow_row.id, auth.uid(), 'learner_plan_reviewed', 'awaiting_approval', target_workflow_status,
          jsonb_build_object('decision', p_decision));
  return jsonb_build_object('workflow', to_jsonb(workflow_row), 'study_plan', to_jsonb(plan_row));
end;
$$;

create or replace function public.create_instructor_intervention_workflow(
  p_course_id text,
  p_concept_id text,
  p_title text,
  p_proposal jsonb,
  p_target_user_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  workflow_row public.agent_workflows;
  queue_row public.instructor_intervention_queue;
begin
  if not public.is_alget_instructor() then raise exception 'instructor_role_required'; end if;
  insert into public.agent_workflows(owner_id, created_by, course_id, workflow_type, status, risk_level, goal, plan, tool_scopes)
  values (auth.uid(), auth.uid(), p_course_id, 'instructor_intervention', 'awaiting_approval', 'medium', p_title, p_proposal,
          array['cohort.aggregate.read', 'intervention.draft'])
  returning * into workflow_row;

  insert into public.instructor_intervention_queue(
    workflow_id, course_id, concept_id, title, proposal, evidence, target_user_ids, created_by
  ) values (
    workflow_row.id, p_course_id, p_concept_id, p_title, p_proposal,
    coalesce(p_proposal -> 'evidence', '{}'::jsonb), p_target_user_ids, auth.uid()
  ) returning * into queue_row;

  insert into public.agent_workflow_events(workflow_id, actor_id, event_type, to_status, detail)
  values (workflow_row.id, auth.uid(), 'intervention_drafted', 'awaiting_approval', jsonb_build_object('queue_id', queue_row.id));
  return jsonb_build_object('workflow', to_jsonb(workflow_row), 'intervention', to_jsonb(queue_row));
end;
$$;

create or replace function public.review_instructor_intervention(
  p_intervention_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  queue_row public.instructor_intervention_queue;
  workflow_row public.agent_workflows;
  target_queue_status text;
  target_workflow_status text;
begin
  if not public.is_alget_instructor() then raise exception 'instructor_role_required'; end if;
  if p_decision not in ('approve', 'reject') then raise exception 'invalid_intervention_decision'; end if;
  select * into queue_row from public.instructor_intervention_queue where id = p_intervention_id for update;
  if queue_row.id is null then raise exception 'intervention_not_found'; end if;
  if queue_row.status <> 'awaiting_approval' then raise exception 'intervention_already_reviewed'; end if;
  target_queue_status := case when p_decision = 'approve' then 'approved' else 'rejected' end;
  target_workflow_status := case when p_decision = 'approve' then 'active' else 'cancelled' end;

  update public.instructor_intervention_queue
  set status = target_queue_status, reviewed_by = auth.uid(), review_note = p_note, reviewed_at = now()
  where id = p_intervention_id returning * into queue_row;
  update public.agent_workflows
  set status = target_workflow_status,
      approval = jsonb_build_object('approved', p_decision = 'approve', 'actor_id', auth.uid(), 'reviewed_at', now(), 'note', p_note)
  where id = queue_row.workflow_id returning * into workflow_row;

  insert into public.agent_workflow_events(workflow_id, actor_id, event_type, from_status, to_status, detail)
  values (workflow_row.id, auth.uid(), 'intervention_reviewed', 'awaiting_approval', target_workflow_status,
          jsonb_build_object('decision', p_decision, 'note', p_note, 'delivery_executed', false));
  return jsonb_build_object('workflow', to_jsonb(workflow_row), 'intervention', to_jsonb(queue_row));
end;
$$;

revoke all on function public.create_learner_plan_workflow(text, text, date, numeric, integer, jsonb) from public;
grant execute on function public.create_learner_plan_workflow(text, text, date, numeric, integer, jsonb) to authenticated;
revoke all on function public.review_learner_plan(uuid, text) from public;
grant execute on function public.review_learner_plan(uuid, text) to authenticated;
revoke all on function public.create_instructor_intervention_workflow(text, text, text, jsonb, uuid[]) from public;
grant execute on function public.create_instructor_intervention_workflow(text, text, text, jsonb, uuid[]) to authenticated;
revoke all on function public.review_instructor_intervention(uuid, text, text) from public;
grant execute on function public.review_instructor_intervention(uuid, text, text) to authenticated;
