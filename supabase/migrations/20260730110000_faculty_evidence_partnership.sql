-- Instructor-facing adoption layer for low-risk faculty design partnerships.
-- Shadow pilots are never student-visible and all artifacts remain instructor-owned.

create table if not exists public.faculty_pilots (
  id uuid primary key default gen_random_uuid(),
  course_id text not null check (course_id ~ '^[a-z0-9][a-z0-9-]*$'),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 180),
  module_name text not null check (char_length(module_name) between 2 and 240),
  source_name text,
  source_url text,
  source_revision text,
  generation_draft jsonb not null default '{}'::jsonb,
  learning_objectives text[] not null default '{}'::text[],
  status text not null default 'shadow' check (status in ('shadow', 'ready', 'active', 'completed', 'cancelled')),
  settings jsonb not null default '{"student_visible":false,"automatic_messaging":false,"automatic_grading":false,"instructor_approval_required":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (coalesce((settings ->> 'automatic_messaging')::boolean, false) is false),
  check (coalesce((settings ->> 'automatic_grading')::boolean, false) is false)
);

create table if not exists public.instructor_evidence_briefs (
  id uuid primary key default gen_random_uuid(),
  course_id text not null check (course_id ~ '^[a-z0-9][a-z0-9-]*$'),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'archived')),
  summary jsonb not null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id, period_start, period_end),
  check (period_end >= period_start),
  check (coalesce((summary -> 'safeguards' ->> 'automatic_message')::boolean, false) is false),
  check (coalesce((summary -> 'safeguards' ->> 'automatic_grade')::boolean, false) is false)
);

create table if not exists public.course_impact_reports (
  id uuid primary key default gen_random_uuid(),
  course_id text not null check (course_id ~ '^[a-z0-9][a-z0-9-]*$'),
  pilot_id uuid references public.faculty_pilots(id) on delete set null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'exported', 'archived')),
  report jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (coalesce((report -> 'safeguards' ->> 'deidentified_export')::boolean, false) is true),
  check (coalesce((report -> 'safeguards' ->> 'causal_claim')::boolean, true) is false)
);

drop trigger if exists set_faculty_pilots_updated_at on public.faculty_pilots;
create trigger set_faculty_pilots_updated_at before update on public.faculty_pilots
for each row execute function public.set_agentic_updated_at();
drop trigger if exists set_evidence_briefs_updated_at on public.instructor_evidence_briefs;
create trigger set_evidence_briefs_updated_at before update on public.instructor_evidence_briefs
for each row execute function public.set_agentic_updated_at();
drop trigger if exists set_impact_reports_updated_at on public.course_impact_reports;
create trigger set_impact_reports_updated_at before update on public.course_impact_reports
for each row execute function public.set_agentic_updated_at();

alter table public.faculty_pilots enable row level security;
alter table public.instructor_evidence_briefs enable row level security;
alter table public.course_impact_reports enable row level security;

drop policy if exists "instructors manage own faculty pilots" on public.faculty_pilots;
create policy "instructors manage own faculty pilots" on public.faculty_pilots for all to authenticated
using (public.is_alget_instructor() and owner_id = auth.uid())
with check (public.is_alget_instructor() and owner_id = auth.uid());

drop policy if exists "instructors manage own evidence briefs" on public.instructor_evidence_briefs;
create policy "instructors manage own evidence briefs" on public.instructor_evidence_briefs for all to authenticated
using (public.is_alget_instructor() and created_by = auth.uid())
with check (public.is_alget_instructor() and created_by = auth.uid());

drop policy if exists "instructors manage own impact reports" on public.course_impact_reports;
create policy "instructors manage own impact reports" on public.course_impact_reports for all to authenticated
using (public.is_alget_instructor() and created_by = auth.uid())
with check (public.is_alget_instructor() and created_by = auth.uid());

grant select, insert, update on public.faculty_pilots to authenticated;
grant select, insert, update on public.instructor_evidence_briefs to authenticated;
grant select, insert, update on public.course_impact_reports to authenticated;

create index if not exists idx_faculty_pilots_owner_course on public.faculty_pilots(owner_id, course_id, updated_at desc);
create index if not exists idx_evidence_briefs_course_period on public.instructor_evidence_briefs(course_id, period_end desc);
create index if not exists idx_impact_reports_course_created on public.course_impact_reports(course_id, created_at desc);
