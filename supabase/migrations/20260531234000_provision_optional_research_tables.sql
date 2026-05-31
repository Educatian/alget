-- Provision the optional ALGET research tables that live smoke checks expect.
-- These tables support social annotations and artifact-revision score mirrors.

create extension if not exists pgcrypto;

create table if not exists public.section_annotations (
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
  on public.section_annotations(section_id, created_at desc);
create index if not exists idx_section_annotations_user
  on public.section_annotations(user_id, created_at desc);
create index if not exists idx_section_annotations_type
  on public.section_annotations(annotation_type);
create index if not exists idx_section_annotations_quote_hash
  on public.section_annotations(quote_hash);

create table if not exists public.annotation_replies (
  id uuid primary key default gen_random_uuid(),
  annotation_id uuid not null references public.section_annotations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_annotation_replies_annotation
  on public.annotation_replies(annotation_id, created_at);

create table if not exists public.annotation_reactions (
  annotation_id uuid not null references public.section_annotations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  reaction_type text not null default 'helpful' check (reaction_type in ('helpful', 'same_question', 'resolved')),
  created_at timestamptz not null default now(),
  primary key (annotation_id, user_id, reaction_type)
);

create table if not exists public.annotation_read_states (
  annotation_id uuid not null references public.section_annotations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (annotation_id, user_id)
);

create table if not exists public.artifact_revision_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  section_id text not null,
  course_id text,
  artifact_type text,
  studio_mode text,
  trace_event_id uuid references public.interaction_events(id) on delete set null,
  judgment text check (judgment in ('accept', 'modify', 'reject', 'defer')),
  trace_score integer not null default 0,
  trace_denominator integer not null default 8,
  claim_clarity double precision not null default 0,
  evidence_alignment double precision not null default 0,
  revision_depth double precision not null default 0,
  judgment_quality double precision not null default 0,
  transfer_readiness double precision not null default 0,
  specificity_delta double precision not null default 0,
  overall_revision_quality double precision not null default 0,
  diagnostics jsonb not null default '{}'::jsonb,
  privacy_policy text not null default 'score-derived-only-v1',
  scorer_version text not null default 'artifact-revision-scorer-v1',
  instructor_override jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists artifact_revision_scores_section_idx
  on public.artifact_revision_scores(section_id, created_at desc);
create index if not exists artifact_revision_scores_user_idx
  on public.artifact_revision_scores(user_id, created_at desc);

alter table public.section_annotations enable row level security;
alter table public.annotation_replies enable row level security;
alter table public.annotation_reactions enable row level security;
alter table public.annotation_read_states enable row level security;
alter table public.artifact_revision_scores enable row level security;

grant select, insert, update, delete on public.section_annotations to authenticated;
grant select, insert, update, delete on public.annotation_replies to authenticated;
grant select, insert, update, delete on public.annotation_reactions to authenticated;
grant select, insert, update, delete on public.annotation_read_states to authenticated;
grant select, insert, update, delete on public.artifact_revision_scores to authenticated;

grant select on public.section_annotations to anon;
grant select on public.annotation_replies to anon;
grant select on public.annotation_reactions to anon;
grant select on public.artifact_revision_scores to anon;

drop policy if exists "Users can manage own section annotations" on public.section_annotations;
create policy "Users can manage own section annotations" on public.section_annotations
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can read course annotations" on public.section_annotations;
create policy "Authenticated users can read course annotations" on public.section_annotations
  for select to authenticated
  using (visibility = 'course' or auth.uid() = user_id);

drop policy if exists "Users can manage own annotation replies" on public.annotation_replies;
create policy "Users can manage own annotation replies" on public.annotation_replies
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can read annotation replies" on public.annotation_replies;
create policy "Authenticated users can read annotation replies" on public.annotation_replies
  for select to authenticated
  using (true);

drop policy if exists "Users can manage own annotation reactions" on public.annotation_reactions;
create policy "Users can manage own annotation reactions" on public.annotation_reactions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can read annotation reactions" on public.annotation_reactions;
create policy "Authenticated users can read annotation reactions" on public.annotation_reactions
  for select to authenticated
  using (true);

drop policy if exists "Users can manage own annotation read states" on public.annotation_read_states;
create policy "Users can manage own annotation read states" on public.annotation_read_states
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own artifact revision scores" on public.artifact_revision_scores;
create policy "Users can manage own artifact revision scores" on public.artifact_revision_scores
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop view if exists public.section_annotation_summary;
create or replace view public.section_annotation_summary
with (security_invoker = true) as
select
  ann.section_id,
  ann.annotation_type,
  count(*) as annotation_count,
  count(distinct ann.user_id) as contributor_count,
  count(reactions.annotation_id) filter (where reactions.reaction_type = 'helpful') as helpful_count,
  max(ann.created_at) as last_annotation_at
from public.section_annotations ann
left join public.annotation_reactions reactions
  on reactions.annotation_id = ann.id
group by ann.section_id, ann.annotation_type;

drop view if exists public.annotation_network_edges;
create or replace view public.annotation_network_edges
with (security_invoker = true) as
select
  a1.section_id,
  a1.user_id as source_user_id,
  a2.user_id as target_user_id,
  count(*) as shared_quote_count
from public.section_annotations a1
join public.section_annotations a2
  on a1.section_id = a2.section_id
 and a1.quote_hash is not null
 and a1.quote_hash = a2.quote_hash
 and a1.user_id <> a2.user_id
group by a1.section_id, a1.user_id, a2.user_id;

drop view if exists public.artifact_revision_cohort_summary;
create or replace view public.artifact_revision_cohort_summary
with (security_invoker = true) as
select
  course_id,
  section_id,
  studio_mode,
  artifact_type,
  count(*) as score_count,
  count(distinct user_id) as learner_count,
  avg(claim_clarity) as avg_claim_clarity,
  avg(evidence_alignment) as avg_evidence_alignment,
  avg(revision_depth) as avg_revision_depth,
  avg(judgment_quality) as avg_judgment_quality,
  avg(transfer_readiness) as avg_transfer_readiness,
  avg(specificity_delta) as avg_specificity_delta,
  avg(overall_revision_quality) as avg_overall_revision_quality,
  count(*) filter (where evidence_alignment < 0.5) as weak_evidence_count,
  count(*) filter (where revision_depth < 0.5) as shallow_revision_count,
  count(*) filter (where judgment_quality < 0.5) as judgment_risk_count,
  count(*) filter (where transfer_readiness >= 0.7) as transfer_ready_count,
  max(created_at) as latest_score_at
from public.artifact_revision_scores
group by course_id, section_id, studio_mode, artifact_type;

grant select on public.section_annotation_summary to authenticated;
grant select on public.annotation_network_edges to authenticated;
grant select on public.artifact_revision_cohort_summary to authenticated;

revoke all on public.artifact_revision_cohort_summary from anon;
