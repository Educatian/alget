-- 1–3 year agentic textbook roadmap contracts.
-- These tables make evidence, agency decisions, interoperability, privacy,
-- and incident response durable instead of leaving them in browser storage.
-- API contract identifiers: privacy-deletion-v1, incident-v1,
-- evaluation-manifest-v1, agent-decision-v1.

create table if not exists public.course_runtime_packages (
  id uuid primary key default gen_random_uuid(),
  course_id text not null check (course_id ~ '^[a-z0-9][a-z0-9-]*$'),
  version integer not null default 1 check (version > 0),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  package jsonb not null,
  status text not null default 'shadow_draft' check (status in ('shadow_draft', 'review', 'published', 'rolled_back')),
  student_visible boolean not null default false,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(course_id, version)
);

create table if not exists public.agent_decision_ledger (
  id uuid primary key default gen_random_uuid(),
  course_id text not null,
  proposal_id text not null,
  actor_id uuid not null references auth.users(id) on delete cascade,
  actor_role text not null check (actor_role in ('learner', 'instructor', 'course_admin', 'admin')),
  decision text not null check (decision in ('accept', 'modify', 'reject', 'defer')),
  original jsonb not null,
  revised jsonb,
  rationale text not null default '',
  evidence_ids text[] not null default '{}'::text[],
  event_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.roadmap_interop_events (
  id bigint generated always as identity primary key,
  course_id text not null,
  standard text not null check (standard in ('caliper', 'oneroster', 'case', 'lti13')),
  payload jsonb not null,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_model_registry (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model_id text not null,
  version text not null,
  capabilities text[] not null default '{}'::text[],
  status text not null default 'draft' check (status in ('draft', 'production', 'retired')),
  approved_by uuid references auth.users(id) on delete set null,
  registered_by uuid references auth.users(id) on delete set null,
  registered_at timestamptz not null default now(),
  retired_at timestamptz,
  unique(provider, model_id, version)
);

create table if not exists public.roadmap_incidents (
  id uuid primary key default gen_random_uuid(),
  course_id text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  category text not null,
  summary text not null,
  status text not null default 'open' check (status in ('open', 'triaged', 'contained', 'resolved')),
  detected_by uuid references auth.users(id) on delete set null,
  timeline jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roadmap_privacy_requests (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('export', 'delete')),
  status text not null default 'requested' check (status in ('requested', 'ready_for_confirmation', 'processing', 'completed', 'rejected')),
  record_ids text[] not null default '{}'::text[],
  requested_by uuid not null references auth.users(id) on delete cascade,
  confirmed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.roadmap_evaluation_manifests (
  id uuid primary key default gen_random_uuid(),
  course_id text not null,
  intervention text not null,
  comparison text not null,
  primary_outcome text not null,
  secondary_outcomes text[] not null default '{}'::text[],
  preregistered boolean not null default false,
  causal_claim_status text not null default 'not_established',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.set_roadmap_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists set_roadmap_incident_updated_at on public.roadmap_incidents;
create trigger set_roadmap_incident_updated_at before update on public.roadmap_incidents
for each row execute function public.set_roadmap_updated_at();

alter table public.course_runtime_packages enable row level security;
alter table public.agent_decision_ledger enable row level security;
alter table public.roadmap_interop_events enable row level security;
alter table public.agent_model_registry enable row level security;
alter table public.roadmap_incidents enable row level security;
alter table public.roadmap_privacy_requests enable row level security;
alter table public.roadmap_evaluation_manifests enable row level security;

drop policy if exists "staff manage runtime packages" on public.course_runtime_packages;
create policy "staff manage runtime packages" on public.course_runtime_packages for all to authenticated
using (public.is_alget_instructor()) with check (public.is_alget_instructor());

drop policy if exists "staff manage decision ledger" on public.agent_decision_ledger;
create policy "staff manage decision ledger" on public.agent_decision_ledger for all to authenticated
using (public.is_alget_instructor()) with check (public.is_alget_instructor() and actor_id = auth.uid());

drop policy if exists "staff manage interop events" on public.roadmap_interop_events;
create policy "staff manage interop events" on public.roadmap_interop_events for all to authenticated
using (public.is_alget_instructor()) with check (public.is_alget_instructor());

drop policy if exists "operators manage model registry" on public.agent_model_registry;
create policy "operators manage model registry" on public.agent_model_registry for all to authenticated
using (public.is_alget_operator()) with check (public.is_alget_operator());

drop policy if exists "operators manage incidents" on public.roadmap_incidents;
create policy "operators manage incidents" on public.roadmap_incidents for all to authenticated
using (public.is_alget_operator()) with check (public.is_alget_operator());

drop policy if exists "users manage own privacy requests" on public.roadmap_privacy_requests;
create policy "users manage own privacy requests" on public.roadmap_privacy_requests for all to authenticated
using (subject_id = auth.uid() or requested_by = auth.uid())
with check (subject_id = auth.uid() and requested_by = auth.uid());
drop policy if exists "operators read privacy requests" on public.roadmap_privacy_requests;
create policy "operators read privacy requests" on public.roadmap_privacy_requests for select to authenticated
using (public.is_alget_operator());

drop policy if exists "staff manage evaluation manifests" on public.roadmap_evaluation_manifests;
create policy "staff manage evaluation manifests" on public.roadmap_evaluation_manifests for all to authenticated
using (public.is_alget_instructor()) with check (public.is_alget_instructor());

grant select, insert, update on public.course_runtime_packages to authenticated;
grant select, insert on public.agent_decision_ledger to authenticated;
grant select, insert on public.roadmap_interop_events to authenticated;
grant select, insert, update on public.agent_model_registry to authenticated;
grant select, insert, update on public.roadmap_incidents to authenticated;
grant select, insert, update on public.roadmap_privacy_requests to authenticated;
grant select, insert, update on public.roadmap_evaluation_manifests to authenticated;

create index if not exists idx_runtime_packages_course_status on public.course_runtime_packages(course_id, status, version desc);
create index if not exists idx_decision_ledger_course_created on public.agent_decision_ledger(course_id, created_at desc);
create index if not exists idx_interop_events_course_standard on public.roadmap_interop_events(course_id, standard, created_at desc);
create index if not exists idx_model_registry_status on public.agent_model_registry(status, provider, model_id);
create index if not exists idx_roadmap_incidents_course_status on public.roadmap_incidents(course_id, status, created_at desc);
create index if not exists idx_privacy_requests_subject_status on public.roadmap_privacy_requests(subject_id, status, created_at desc);
create index if not exists idx_evaluation_manifests_course on public.roadmap_evaluation_manifests(course_id, created_at desc);
