-- Legacy views were created with owner privileges and broad anon grants. Make
-- them obey the underlying tables' RLS and expose read-only access to signed-in
-- users only.
alter view public.user_section_progress set (security_invoker = true);
alter view public.concept_mastery_summary set (security_invoker = true);
alter view public.popular_highlights set (security_invoker = true);
alter view public.session_event_sequence set (security_invoker = true);
alter view public.research_trace_summary set (security_invoker = true);

revoke all on table public.user_section_progress from public, anon, authenticated;
revoke all on table public.concept_mastery_summary from public, anon, authenticated;
revoke all on table public.popular_highlights from public, anon, authenticated;
revoke all on table public.session_event_sequence from public, anon, authenticated;
revoke all on table public.research_trace_summary from public, anon, authenticated;

grant select on table public.user_section_progress to authenticated;
grant select on table public.concept_mastery_summary to authenticated;
grant select on table public.popular_highlights to authenticated;
grant select on table public.session_event_sequence to authenticated;
grant select on table public.research_trace_summary to authenticated;

-- This helper is referenced by RLS policies. Permit only a signed-in caller to
-- test its own identity, and pin the search path for its definer context.
create or replace function public.is_admin(uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result boolean := false;
begin
  if (select auth.uid()) is null or uid is distinct from (select auth.uid()) then
    return false;
  end if;
  if to_regclass('public.user_roles') is not null then
    execute
      'select exists (
         select 1 from public.user_roles
         where user_id = $1 and role::text = ''admin''
       )'
    into result
    using uid;
  end if;
  return coalesce(result, false);
end;
$$;

revoke all on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated;
