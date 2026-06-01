-- Optional social tables for highlight-level reactions and threaded replies.
-- These back the HighlightDiscussion component and keep social reading traces queryable.

create extension if not exists pgcrypto;

create table if not exists public.highlight_reactions (
  id uuid primary key default gen_random_uuid(),
  highlight_id uuid not null,
  user_id uuid references auth.users(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('insight', 'question', 'disagree', 'same')),
  created_at timestamptz not null default now()
);

create unique index if not exists highlight_reactions_unique_user_type_idx
  on public.highlight_reactions(highlight_id, user_id, reaction_type);
create index if not exists highlight_reactions_highlight_idx
  on public.highlight_reactions(highlight_id, created_at desc);
create index if not exists highlight_reactions_user_idx
  on public.highlight_reactions(user_id, created_at desc);

create table if not exists public.highlight_replies (
  id uuid primary key default gen_random_uuid(),
  highlight_id uuid not null,
  user_id uuid references auth.users(id) on delete cascade,
  alias text,
  color_token text,
  body text not null,
  parent_reply_id uuid references public.highlight_replies(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists highlight_replies_highlight_idx
  on public.highlight_replies(highlight_id, created_at);
create index if not exists highlight_replies_user_idx
  on public.highlight_replies(user_id, created_at desc);
create index if not exists highlight_replies_parent_idx
  on public.highlight_replies(parent_reply_id);

do $$
begin
  if to_regclass('public.highlights') is not null then
    if not exists (
      select 1 from pg_constraint
      where conname = 'highlight_reactions_highlight_id_fkey'
        and conrelid = 'public.highlight_reactions'::regclass
    ) then
      alter table public.highlight_reactions
        add constraint highlight_reactions_highlight_id_fkey
        foreign key (highlight_id) references public.highlights(id) on delete cascade;
    end if;

    if not exists (
      select 1 from pg_constraint
      where conname = 'highlight_replies_highlight_id_fkey'
        and conrelid = 'public.highlight_replies'::regclass
    ) then
      alter table public.highlight_replies
        add constraint highlight_replies_highlight_id_fkey
        foreign key (highlight_id) references public.highlights(id) on delete cascade;
    end if;
  end if;
end $$;

alter table public.highlight_reactions enable row level security;
alter table public.highlight_replies enable row level security;

grant select, insert, update, delete on public.highlight_reactions to authenticated;
grant select, insert, update, delete on public.highlight_replies to authenticated;
grant select on public.highlight_reactions to anon;
grant select on public.highlight_replies to anon;

drop policy if exists "Users can manage own highlight reactions" on public.highlight_reactions;
create policy "Users can manage own highlight reactions" on public.highlight_reactions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can read highlight reactions" on public.highlight_reactions;
create policy "Authenticated users can read highlight reactions" on public.highlight_reactions
  for select to authenticated
  using (true);

drop policy if exists "Users can manage own highlight replies" on public.highlight_replies;
create policy "Users can manage own highlight replies" on public.highlight_replies
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can read highlight replies" on public.highlight_replies;
create policy "Authenticated users can read highlight replies" on public.highlight_replies
  for select to authenticated
  using (true);
