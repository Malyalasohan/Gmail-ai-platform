-- AI-Powered Gmail Intelligence Platform — Initial Schema
-- Migration: 20260618000000_initial_schema

-- Enable pgvector extension for semantic search
create extension if not exists vector;

-- Users table: stores authenticated Gmail users
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  google_refresh_token text, -- Store encrypted at rest in production; never log this value
  created_at timestamptz default now()
);

-- Emails table: stores synced Gmail messages
create table emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  gmail_message_id text not null, -- Gmail's unique message ID
  thread_id text not null, -- Gmail thread ID for conversation grouping
  sender text,
  recipient text,
  subject text,
  body_text text, -- Plain text email body
  received_at timestamptz,
  category text, -- AI-assigned category (Work, Personal, Newsletter, Action Required, Other)
  summary text, -- Cached Gemini-generated summary (null until first generation)
  created_at timestamptz default now(),
  unique(user_id, gmail_message_id) -- Prevent duplicate syncs
);

-- Indexes for common query patterns
create index idx_emails_thread on emails(thread_id);
create index idx_emails_user on emails(user_id);
create index idx_emails_category on emails(category);
create index idx_emails_received on emails(received_at desc);

-- Email embeddings table: stores vector embeddings for semantic search
create table email_embeddings (
  id uuid primary key default gen_random_uuid(),
  email_id uuid references emails(id) on delete cascade,
  chunk_text text not null, -- The text chunk that was embedded
  embedding vector(768), -- Gemini embedding dimension (verify actual model output)
  created_at timestamptz default now()
);

-- Vector similarity search index (IVFFlat for cosine similarity)
create index on email_embeddings using ivfflat (embedding vector_cosine_ops);

-- Chat messages table: stores conversation history
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  source_email_ids uuid[], -- Attribution: which emails were used to generate this response
  created_at timestamptz default now()
);

create index idx_chat_messages_user on chat_messages(user_id, created_at desc);

-- Comments on design decisions:
comment on column users.google_refresh_token is 'OAuth refresh token for Gmail API. TODO: Encrypt at rest in production.';
comment on column emails.summary is 'Cached Gemini summary. Generated on first thread view, stored to avoid re-calling API.';
comment on column chat_messages.source_email_ids is 'Array of email IDs used for RAG retrieval. Simplified design vs join table for 20hr build scope.';
