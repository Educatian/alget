-- Highlight-level social: reactions, replies, kindred-reader overlap.
-- Closes the gap surfaced by the annotation/social audit:
--   * R1: per-highlight reactions + threaded replies
--   * R3: overlap-based "kindred reader" view
-- R2 (cohort-wide live map) reuses existing social_presence; no new table needed.

-- ====================================================================
-- R1.a — highlight_reactions
-- ====================================================================
create table if not exists highlight_reactions (
    id uuid primary key default gen_random_uuid(),
    highlight_id uuid not null references highlights(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    reaction_type text not null check (reaction_type in ('insight','question','disagree','same')),
    created_at timestamptz default now(),
    unique (highlight_id, user_id, reaction_type)
);

create index if not exists idx_highlight_reactions_highlight on highlight_reactions(highlight_id);
create index if not exists idx_highlight_reactions_user on highlight_reactions(user_id);

alter table highlight_reactions enable row level security;

drop policy if exists "Users can manage own reactions" on highlight_reactions;
create policy "Users can manage own reactions" on highlight_reactions
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can read reactions" on highlight_reactions;
create policy "Authenticated users can read reactions" on highlight_reactions
    for select to authenticated using (true);

-- ====================================================================
-- R1.b — highlight_replies (threaded; depth-2 capped in UI)
-- ====================================================================
create table if not exists highlight_replies (
    id uuid primary key default gen_random_uuid(),
    highlight_id uuid not null references highlights(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    alias text,
    color_token text,
    body text not null check (length(body) between 1 and 1200),
    parent_reply_id uuid references highlight_replies(id) on delete cascade,
    created_at timestamptz default now()
);

create index if not exists idx_highlight_replies_highlight on highlight_replies(highlight_id, created_at);
create index if not exists idx_highlight_replies_user on highlight_replies(user_id);
create index if not exists idx_highlight_replies_parent on highlight_replies(parent_reply_id);

alter table highlight_replies enable row level security;

drop policy if exists "Users can manage own replies" on highlight_replies;
create policy "Users can manage own replies" on highlight_replies
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can read replies" on highlight_replies;
create policy "Authenticated users can read replies" on highlight_replies
    for select to authenticated using (true);

-- ====================================================================
-- R1.c — reaction-summary view (count by type per highlight)
-- ====================================================================
drop view if exists highlight_reaction_summary;
create or replace view highlight_reaction_summary as
select
    highlight_id,
    reaction_type,
    count(*) as count
from highlight_reactions
group by highlight_id, reaction_type;

grant select on highlight_reaction_summary to authenticated;

-- ====================================================================
-- R3 — highlight_overlap: pairwise kindred-reader view.
-- For each (user_a, user_b, section), how many quasi-identical highlights
-- they share. Used by the StudentDashboard "kindred readers" card.
-- ====================================================================
drop view if exists highlight_overlap;
create or replace view highlight_overlap as
select
    h1.user_id as user_a,
    h2.user_id as user_b,
    h1.section_id,
    count(*) as overlap_count,
    array_agg(distinct h1.text_content) as shared_texts
from highlights h1
join highlights h2
  on h1.section_id = h2.section_id
 and h1.text_content = h2.text_content
 and h1.user_id < h2.user_id
group by h1.user_id, h2.user_id, h1.section_id
having count(*) >= 2;

grant select on highlight_overlap to authenticated;

-- Per-user kindred summary: top peers by total overlap count.
drop view if exists kindred_readers;
create or replace view kindred_readers as
select
    user_a,
    user_b as peer_user_id,
    sum(overlap_count) as total_overlap,
    array_agg(distinct section_id) as shared_sections
from highlight_overlap
group by user_a, user_b
union all
select
    user_b,
    user_a as peer_user_id,
    sum(overlap_count) as total_overlap,
    array_agg(distinct section_id) as shared_sections
from highlight_overlap
group by user_b, user_a;

grant select on kindred_readers to authenticated;

-- ====================================================================
-- Notes
-- ====================================================================
-- * Aliases on replies are denormalized so the UI can render a peer's
--   chosen alias even if their auth row is deleted (FERPA exit path).
-- * Reaction types are intentionally a small set (insight, question,
--   disagree, same). Larger taxonomies invite emoji-soup; 4 is enough.
-- * The overlap view uses exact text match; future iteration can use
--   fuzzy match (trigram) for highlights that overlap but are not byte-
--   identical, at the cost of pg_trgm + index.
