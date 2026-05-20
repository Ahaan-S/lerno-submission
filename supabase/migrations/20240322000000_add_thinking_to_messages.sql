-- Add thinking data column to tutor_messages
-- Stores the RAG step events (rephrased query, chunks found, elapsed time)
-- so the thought-process block persists on page reload.

alter table public.tutor_messages
  add column if not exists thinking jsonb;
