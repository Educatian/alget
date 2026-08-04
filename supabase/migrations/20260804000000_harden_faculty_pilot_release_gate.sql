-- The instructor UI exposes a deterministic release checklist, but a signed-in
-- client can still call PostgREST directly. Enforce the same human-release
-- contract in the database so a bypass cannot publish an incomplete draft.

alter table public.faculty_pilots
  alter column settings set default '{"student_visible":false,"automatic_publish":false,"automatic_messaging":false,"automatic_grading":false,"instructor_approval_required":true,"quality_warnings_acknowledged":false}'::jsonb;

create or replace function private.validate_faculty_pilot_release(p_pilot public.faculty_pilots)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft jsonb := coalesce(p_pilot.generation_draft, '{}'::jsonb);
  generated jsonb := coalesce(draft -> 'runtime_package' -> 'generated', '[]'::jsonb);
  required_runtime text[] := array['reading', 'activity', 'simulation', 'tutor', 'analytics', 'social_dynamics'];
  runtime_name text;
  warning_count integer := jsonb_array_length(coalesce(draft -> 'quality' -> 'warnings', '[]'::jsonb));
begin
  if coalesce(p_pilot.source_revision, '') = '' and coalesce(draft -> 'source' ->> 'sha256', '') = '' then
    raise exception 'faculty_pilot_source_checksum_required';
  end if;
  if jsonb_array_length(coalesce(draft -> 'sections', '[]'::jsonb)) = 0 then
    raise exception 'faculty_pilot_sections_required';
  end if;
  if coalesce(array_length(p_pilot.learning_objectives, 1), 0) = 0
     and jsonb_array_length(coalesce(draft -> 'learning_objectives', '[]'::jsonb)) = 0 then
    raise exception 'faculty_pilot_learning_objectives_required';
  end if;
  foreach runtime_name in array required_runtime loop
    if not (generated ? runtime_name) then
      raise exception 'faculty_pilot_runtime_surface_required:%', runtime_name;
    end if;
  end loop;
  if warning_count > 0
     and coalesce((draft -> 'quality' ->> 'warnings_acknowledged')::boolean, false) is not true
     and coalesce((p_pilot.settings ->> 'quality_warnings_acknowledged')::boolean, false) is not true then
    raise exception 'faculty_pilot_review_notes_must_be_acknowledged';
  end if;
  if coalesce((p_pilot.settings ->> 'student_visible')::boolean, true) is not false
     or coalesce((p_pilot.settings ->> 'automatic_publish')::boolean, true) is not false
     or coalesce((p_pilot.settings ->> 'automatic_messaging')::boolean, true) is not false
     or coalesce((p_pilot.settings ->> 'automatic_grading')::boolean, true) is not false
     or coalesce((p_pilot.settings ->> 'instructor_approval_required')::boolean, false) is not true then
    raise exception 'faculty_pilot_governance_gate_required';
  end if;
end;
$$;

create or replace function private.guard_faculty_pilot_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('ready', 'active') then
    perform private.validate_faculty_pilot_release(new);
  end if;
  return new;
end;
$$;

drop trigger if exists guard_faculty_pilot_release on public.faculty_pilots;
create trigger guard_faculty_pilot_release
before insert or update of status, generation_draft, learning_objectives, settings
on public.faculty_pilots
for each row execute function private.guard_faculty_pilot_release();

create or replace function private.guard_published_faculty_module()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pilot_row public.faculty_pilots;
begin
  select * into pilot_row
  from public.faculty_pilots
  where id = new.pilot_id;
  if pilot_row.id is null or pilot_row.status not in ('ready', 'active') then
    raise exception 'faculty_pilot_must_be_ready_before_publish';
  end if;
  if new.generation_draft <> pilot_row.generation_draft then
    raise exception 'published_faculty_module_draft_must_match_pilot';
  end if;
  perform private.validate_faculty_pilot_release(pilot_row);
  return new;
end;
$$;

drop trigger if exists guard_published_faculty_module on public.published_course_modules;
create trigger guard_published_faculty_module
before insert or update of pilot_id, generation_draft, status
on public.published_course_modules
for each row execute function private.guard_published_faculty_module();

revoke all on function private.validate_faculty_pilot_release(public.faculty_pilots) from public, anon;
revoke all on function private.guard_faculty_pilot_release() from public, anon;
revoke all on function private.guard_published_faculty_module() from public, anon;
