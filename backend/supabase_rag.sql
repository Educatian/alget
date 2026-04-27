-- pgvector-backed RAG store for ALGET.
-- Replaces the in-memory cosine search in rag_service.py with a durable
-- index that survives Render free-tier cold starts.

create extension if not exists vector;

create table if not exists rag_documents (
  doc_id text primary key,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(768),
  content_checksum text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rag_documents_embedding_idx
  on rag_documents using hnsw (embedding vector_cosine_ops);

create index if not exists rag_documents_metadata_gin
  on rag_documents using gin (metadata);

-- Cosine-similarity match RPC. Callers pass the query embedding and a
-- match_count; the function returns the top matches ordered by similarity.
create or replace function match_rag_documents(
  query_embedding vector(768),
  match_count int default 3
)
returns table (
  doc_id text,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    rag_documents.doc_id,
    rag_documents.content,
    rag_documents.metadata,
    1 - (rag_documents.embedding <=> query_embedding) as similarity
  from rag_documents
  where rag_documents.embedding is not null
  order by rag_documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Course content is shared, not user-specific, so RLS is disabled here.
-- (Inserts are server-side only; reads are anon-safe.)
alter table rag_documents disable row level security;
