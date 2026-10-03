-- Staff-only access (2026-10-03). Run once in the Supabase SQL editor.
--
-- 1. Only Stephen (seabu@crimson.ua.edu) stays on the admin allowlist; Dr. Moon keeps his
--    access through his active instructor profile. Former entries are revoked, not deleted,
--    so they can be restored with status = 'active'.
-- 2. The allowlist now matches the signed-in account's own email in auth.users and requires
--    that email to be confirmed, instead of trusting the email inside the login token.

update public.alget_operator_allowlist
set status = 'revoked'
where email in ('idawoyemi@crimson.ua.edu', 'awoyemidavid2020@gmail.com', 'steve.emmy1990@gmail.com');

create or replace function public.is_alget_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'course_admin')
    or exists (
      select 1
      from public.alget_operator_allowlist a
      join auth.users u on lower(u.email) = a.email
      where u.id = auth.uid()
        and u.email_confirmed_at is not null
        and a.role in ('admin', 'course_admin')
        and a.status = 'active'
    ),
    false
  );
$$;

-- Check: should list only seabu@crimson.ua.edu as active.
select email, role, status from public.alget_operator_allowlist order by status, email;
