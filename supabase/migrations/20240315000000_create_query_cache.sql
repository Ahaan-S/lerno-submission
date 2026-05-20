-- Semantic cache for repeated questions (e.g. "What is photosynthesis")
-- Keyed by hash(query + grade + subject + chapter_index) — saves 60-70% LLM cost at scale

create table public.query_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  query_text text not null,
  grade text not null,
  subject text not null,
  chapter_index text,
  task_type text not null,
  response_content text not null,
  citations jsonb,
  hit_count int default 1,
  created_at timestamptz default now()
);

create index idx_query_cache_key on public.query_cache(cache_key);

alter table public.query_cache enable row level security;

-- Anyone can read (cache is keyed by content, not user — same Q gets same A)
create policy "Anyone can read query cache" on public.query_cache for select using (true);

-- Inserts/updates via API using createAdminClient (service role bypasses RLS)
-- Restrict write to service_role for defense in depth
create policy "Service role can insert cache" on public.query_cache
  for insert with check (auth.role() = 'service_role');
create policy "Service role can update cache" on public.query_cache
  for update using (auth.role() = 'service_role');
