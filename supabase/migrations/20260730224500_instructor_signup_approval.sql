-- Public instructor applications remain least-privileged until a course
-- administrator explicitly approves them.

alter table public.instructor_profiles
  drop constraint if exists instructor_profiles_status_check;
alter table public.instructor_profiles
  add constraint instructor_profiles_status_check
  check (status in ('pending_approval', 'invited', 'active', 'rejected', 'suspended'));

create or replace function public.handle_instructor_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data ->> 'requested_role', '');
  display_name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
begin
  if requested_role = 'instructor' then
    insert into public.instructor_profiles (user_id, email, display_name, status)
    values (new.id, lower(new.email), coalesce(display_name, split_part(new.email, '@', 1)), 'pending_approval')
    on conflict (user_id) do update
      set email = excluded.email,
          display_name = excluded.display_name;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_instructor_signup on auth.users;
create trigger on_auth_user_instructor_signup
  after insert on auth.users
  for each row execute function public.handle_instructor_signup();

drop policy if exists "instructors read own profile" on public.instructor_profiles;
create policy "instructors read own profile" on public.instructor_profiles
  for select to authenticated
  using (user_id = auth.uid());

revoke all on function public.handle_instructor_signup() from public;

