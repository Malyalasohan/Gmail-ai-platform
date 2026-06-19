-- Vector search function for RAG retrieval
-- Migration: 20260618000001_vector_search_function

-- Function to search emails by semantic similarity
-- Returns ONE row per email (highest similarity chunk only)
create or replace function search_emails(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  user_id_param uuid
)
returns table (
  id uuid,
  gmail_message_id text,
  thread_id text,
  sender text,
  recipient text,
  subject text,
  body_text text,
  received_at timestamptz,
  category text,
  similarity float,
  chunk_text text
)
language plpgsql
as $$
begin
  return query
  select distinct on (e.id)
    e.id,
    e.gmail_message_id,
    e.thread_id,
    e.sender,
    e.recipient,
    e.subject,
    e.body_text,
    e.received_at,
    e.category,
    1 - (emb.embedding <=> query_embedding) as similarity,
    emb.chunk_text
  from email_embeddings emb
  join emails e on e.id = emb.email_id
  where 
    e.user_id = user_id_param
    and 1 - (emb.embedding <=> query_embedding) > match_threshold
  order by e.id, (emb.embedding <=> query_embedding) asc
  limit match_count;
end;
$$;

-- Add index for user_id + vector search performance
create index if not exists idx_email_embeddings_email_id on email_embeddings(email_id);

comment on function search_emails is 'Semantic search over email embeddings using cosine similarity. Returns ONE row per email with highest similarity chunk. No duplicates.';
