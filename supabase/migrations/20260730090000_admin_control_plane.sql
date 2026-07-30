-- ALGET administrator control plane: role-bound instructors, courses,
-- document ingestion, approval-gated agent runs, and append-only audit events.

create or replace function public.is_alget_operator()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('admin', 'course_admin');
$$;

create table if not exists public.instructor_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  email text not null unique,
  display_name text not null,
  status text not null default 'invited' check (status in ('invited', 'active', 'suspended')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.managed_courses (
  id uuid primary key default gen_random_uuid(),
  course_key text not null unique check (course_key ~ '^[a-z0-9][a-z0-9-]*$'),
  title text not null,
  domain text not null default 'general',
  owner_instructor_id uuid references public.instructor_profiles(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'ingesting', 'review', 'ready', 'published', 'archived')),
  release_policy text not null default 'human_approval_required',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.managed_courses(id) on delete cascade,
  source_type text not null check (source_type in ('pdf', 'docx', 'html', 'markdown')),
  source_name text not null,
  source_sha256 text,
  page_count integer,
  status text not null default 'queued' check (status in ('queued', 'converting', 'needs_review', 'approved', 'failed')),
  quality_report jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_control_runs (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.managed_courses(id) on delete cascade,
  ingestion_job_id uuid references public.content_ingestion_jobs(id) on delete set null,
  status text not null default 'planned' check (status in ('planned', 'awaiting_approval', 'approved', 'running', 'review', 'completed', 'blocked', 'cancelled')),
  current_stage text,
  plan jsonb not null default '{}'::jsonb,
  approval jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.instructor_profiles enable row level security;
alter table public.managed_courses enable row level security;
alter table public.content_ingestion_jobs enable row level security;
alter table public.agent_control_runs enable row level security;
alter table public.admin_audit_events enable row level security;

grant select, insert, update, delete on table public.instructor_profiles to authenticated;
grant select, insert, update, delete on table public.managed_courses to authenticated;
grant select, insert, update, delete on table public.content_ingestion_jobs to authenticated;
grant select, insert, update, delete on table public.agent_control_runs to authenticated;
grant select, insert on table public.admin_audit_events to authenticated;
grant usage, select on sequence public.admin_audit_events_id_seq to authenticated;
revoke all on function public.is_alget_operator() from public;
grant execute on function public.is_alget_operator() to authenticated;

drop policy if exists "operators manage instructors" on public.instructor_profiles;
create policy "operators manage instructors" on public.instructor_profiles for all to authenticated
using (public.is_alget_operator()) with check (public.is_alget_operator());

drop policy if exists "operators manage courses" on public.managed_courses;
create policy "operators manage courses" on public.managed_courses for all to authenticated
using (public.is_alget_operator()) with check (public.is_alget_operator());

drop policy if exists "instructors read owned courses" on public.managed_courses;
create policy "instructors read owned courses" on public.managed_courses for select to authenticated
using (owner_instructor_id in (select id from public.instructor_profiles where user_id = auth.uid()));

drop policy if exists "operators manage ingestion" on public.content_ingestion_jobs;
create policy "operators manage ingestion" on public.content_ingestion_jobs for all to authenticated
using (public.is_alget_operator()) with check (public.is_alget_operator());

drop policy if exists "operators manage agent runs" on public.agent_control_runs;
create policy "operators manage agent runs" on public.agent_control_runs for all to authenticated
using (public.is_alget_operator()) with check (public.is_alget_operator());

drop policy if exists "operators read audit" on public.admin_audit_events;
create policy "operators read audit" on public.admin_audit_events for select to authenticated
using (public.is_alget_operator());

drop policy if exists "operators append audit" on public.admin_audit_events;
create policy "operators append audit" on public.admin_audit_events for insert to authenticated
with check (public.is_alget_operator() and actor_id = auth.uid());

create index if not exists idx_managed_courses_owner on public.managed_courses(owner_instructor_id, status);
create index if not exists idx_ingestion_course_status on public.content_ingestion_jobs(course_id, status, created_at desc);
create index if not exists idx_agent_runs_course_status on public.agent_control_runs(course_id, status, created_at desc);
create index if not exists idx_admin_audit_entity on public.admin_audit_events(entity_type, entity_id, created_at desc);
