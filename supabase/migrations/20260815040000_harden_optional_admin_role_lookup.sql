-- Keep the legacy admin helper fail-closed when the optional user_roles table
-- is absent, without embedding a statically invalid relation in the function.

create or replace function public.is_admin(uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result boolean := false;
  role_relation regclass;
begin
  if (select auth.uid()) is null or uid is distinct from (select auth.uid()) then
    return false;
  end if;

  role_relation := to_regclass('public.user_roles');
  if role_relation is null then
    return false;
  end if;

  execute format(
    'select exists (select 1 from %s where user_id = $1 and role::text = ''admin'')',
    role_relation
  )
  into result
  using uid;

  return coalesce(result, false);
end;
$$;

revoke all on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated;
