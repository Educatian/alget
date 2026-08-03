-- OpenStax reference index.
--
-- Holds one row per OpenStax book section so generated modules can cite open
-- textbook passages and link back to them. Retrieval is Postgres full-text
-- search rather than vector similarity: the edge runtime has no embedding
-- binding, and lexical search over section titles and prose is enough to
-- surface the right sections and their canonical links.
--
-- Licences differ per book (CC BY, CC BY-NC-SA, ...). The licence is stored on
-- every row so a caller can filter by what it is allowed to reuse.

create table if not exists public.openstax_sections (
  id uuid primary key default gen_random_uuid(),
  book_slug text not null,
  book_title text not null,
  license_url text not null,
  license_name text,
  page_uuid text not null,
  page_slug text not null,
  title text not null,
  url text not null,
  content text not null,
  characters integer not null default 0,
  archive_version text not null,
  book_version text not null,
  updated_at timestamptz not null default now(),
  unique (book_slug, page_uuid)
);

create index if not exists openstax_sections_book_idx on public.openstax_sections (book_slug);

-- Weighted document: a title match should outrank a passing mention in prose.
create index if not exists openstax_sections_fts_idx on public.openstax_sections
  using gin (
    (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(content, '')), 'B')
    )
  );

alter table public.openstax_sections enable row level security;

-- Open textbook content is public reference material; any signed-in reader may
-- search it. Writes are reserved for the service role that runs ingestion.
drop policy if exists "authenticated read openstax sections" on public.openstax_sections;
create policy "authenticated read openstax sections" on public.openstax_sections
  for select to authenticated using (true);

revoke all on table public.openstax_sections from public, anon, authenticated;
grant select on table public.openstax_sections to authenticated;

-- An assigned instructor may reuse a source already ingested for one of their
-- courses, but may not enumerate the administrator's ingestion queue.
drop policy if exists "instructors read assigned ingestion sources" on public.content_ingestion_jobs;
create policy "instructors read assigned ingestion sources" on public.content_ingestion_jobs
  for select to authenticated
  using (
    exists (
      select 1
      from public.managed_courses mc
      where mc.id = content_ingestion_jobs.course_id
        and private.can_manage_course(mc.course_key)
    )
  );

-- Ranked lexical search. Returns a short excerpt rather than the whole section
-- so a caller can put it straight into a prompt without truncating blindly.
create or replace function public.search_openstax_sections(
  p_query text,
  p_limit integer default 5,
  p_licenses text[] default null
)
returns table (
  book_slug text,
  book_title text,
  title text,
  url text,
  license_url text,
  excerpt text,
  rank real
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.book_slug,
    s.book_title,
    s.title,
    s.url,
    s.license_url,
    left(regexp_replace(s.content, '\s+', ' ', 'g'), 1200) as excerpt,
    ts_rank(
      setweight(to_tsvector('english', coalesce(s.title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(s.content, '')), 'B'),
      websearch_to_tsquery('english', p_query)
    ) as rank
  from public.openstax_sections s
  where websearch_to_tsquery('english', p_query) @@ (
      setweight(to_tsvector('english', coalesce(s.title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(s.content, '')), 'B')
    )
    and (p_licenses is null or s.license_url = any (p_licenses))
  order by rank desc
  limit greatest(1, least(coalesce(p_limit, 5), 20));
$$;

revoke all on function public.search_openstax_sections(text, integer, text[]) from public, anon;
grant execute on function public.search_openstax_sections(text, integer, text[]) to authenticated;
