-- Personal, one-time Study IDs for the research study (see backend/study_enrollment.py).
-- Additive only: creates one new table. Holds no names or emails; the research
-- team keeps the name/email <-> Study ID key outside ALGET.
-- Only the backend (service role) reads or writes it: RLS is on with no policies,
-- and table privileges are revoked from anon and authenticated.

create table if not exists public.study_invites (
  study_id    text primary key
              check (study_id ~ '^(BAS|BIO)-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$'),
  track       text not null check (track in ('basic', 'bio')),
  redeemed_by uuid unique references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint study_invites_prefix_matches_track
    check ((track = 'basic' and study_id like 'BAS-%') or (track = 'bio' and study_id like 'BIO-%'))
);

alter table public.study_invites enable row level security;
revoke all on public.study_invites from anon, authenticated;
grant select, insert, update on public.study_invites to service_role;

comment on table public.study_invites is
  'Pre-generated personal Study IDs (one per invited participant). Redeemed once via /api/study/enroll.';
