-- ============================================================================
-- ALGET Social Annotation Research Layer
-- Execute after supabase_schema.sql and supabase_logging.sql.
-- This upgrades the local Perusall-style prototype into a cross-user,
-- research-instrumented annotation subsystem.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists section_annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  course_id text,
  section_id text not null,
  concept_ids text[] not null default '{}',
  quote_text text,
  quote_hash text,
  start_offset integer,
  end_offset integer,
  annotation_type text not null check (annotation_type in ('question', 'confusion', 'insight', 'connection')),
  body text not null,
  visibility text not null default 'course' check (visibility in ('private', 'course')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_section_annotations_section
  on section_annotations(section_id, created_at desc);

create index if not exists idx_section_annotations_user
  on section_annotations(user_id, created_at desc);

create index if not exists idx_section_annotations_type
  on section_annotations(annotation_type);

create index if not exists idx_section_annotations_quote_hash
  on section_annotations(quote_hash);

create table if not exists annotation_replies (
  id uuid primary key default gen_random_uuid(),
  annotation_id uuid not null references section_annotations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_annotation_replies_annotation
  on annotation_replies(annotation_id, created_at);

create table if not exists annotation_reactions (
  annotation_id uuid not null references section_annotations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  reaction_type text not null default 'helpful' check (reaction_type in ('helpful', 'same_question', 'resolved')),
  created_at timestamptz not null default now(),
  primary key (annotation_id, user_id, reaction_type)
);

create table if not exists annotation_read_states (
  annotation_id uuid not null references section_annotations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (annotation_id, user_id)
);

alter table section_annotations enable row level security;
alter table annotation_replies enable row level security;
alter table annotation_reactions enable row level security;
alter table annotation_read_states enable row level security;

drop policy if exists "Users can manage own section annotations" on section_annotations;
create policy "Users can manage own section annotations" on section_annotations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can read course annotations" on section_annotations;
create policy "Authenticated users can read course annotations" on section_annotations
  for select to authenticated using (visibility = 'course' or auth.uid() = user_id);

drop policy if exists "Users can manage own annotation replies" on annotation_replies;
create policy "Users can manage own annotation replies" on annotation_replies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can read annotation replies" on annotation_replies;
create policy "Authenticated users can read annotation replies" on annotation_replies
  for select to authenticated using (true);

drop policy if exists "Users can manage own annotation reactions" on annotation_reactions;
create policy "Users can manage own annotation reactions" on annotation_reactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can read annotation reactions" on annotation_reactions;
create policy "Authenticated users can read annotation reactions" on annotation_reactions
  for select to authenticated using (true);

drop policy if exists "Users can manage own annotation read states" on annotation_read_states;
create policy "Users can manage own annotation read states" on annotation_read_states
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop view if exists section_annotation_summary;
create or replace view section_annotation_summary
with (security_invoker = true) as
select
  ann.section_id,
  ann.annotation_type,
  count(*) as annotation_count,
  count(distinct ann.user_id) as contributor_count,
  count(reactions.annotation_id) filter (where reactions.reaction_type = 'helpful') as helpful_count,
  max(ann.created_at) as last_annotation_at
from section_annotations ann
left join annotation_reactions reactions
  on reactions.annotation_id = ann.id
group by ann.section_id, ann.annotation_type;

drop view if exists annotation_network_edges;
create or replace view annotation_network_edges
with (security_invoker = true) as
select
  a1.section_id,
  a1.user_id as source_user_id,
  a2.user_id as target_user_id,
  count(*) as shared_quote_count
from section_annotations a1
join section_annotations a2
  on a1.section_id = a2.section_id
 and a1.quote_hash is not null
 and a1.quote_hash = a2.quote_hash
 and a1.user_id <> a2.user_id
group by a1.section_id, a1.user_id, a2.user_id;

grant select on section_annotation_summary to authenticated;
grant select on annotation_network_edges to authenticated;

select 'ALGET social annotation research schema ready' as status;
