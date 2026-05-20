-- AI Tutor & Unified Data Tables
-- Supports: ai tutor, study feed, calendar, and future features
-- Run after profiles table exists

-- 1. tutor_sessions — one row per conversation
create table public.tutor_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  chapter_name text,
  chapter_index text,
  title text, -- auto-generated from first message
  created_at timestamptz default now(),
  last_message_at timestamptz default now()
);

-- 2. tutor_messages — every message in every chat
create table public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.tutor_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  task_type text check (task_type in ('explain', 'notes', 'quiz', 'solve', 'summary')),
  citations jsonb, -- [{chunk_id, chapter, page, topic}]
  created_at timestamptz default now()
);

-- 3. student_ai_memory — the long-term memory layer per subject
create table public.student_ai_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  memory_summary text,
  weak_topics text[],
  strong_topics text[],
  common_mistakes text[],
  updated_at timestamptz default now(),
  unique(user_id, subject)
);

-- 4. student_topic_progress — replaces topic_strengths/weaknesses in profiles
create table public.student_topic_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  chapter_index text not null,
  topic_index text not null,
  topic_name text,
  mastery_level text default 'not_started' check (mastery_level in ('not_started', 'learning', 'weak', 'strong')),
  last_practiced_at timestamptz,
  unique(user_id, subject, topic_index)
);

-- 5. retrieved_chunks_log — for improving RAG over time
create table public.retrieved_chunks_log (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.tutor_messages(id) on delete cascade,
  chunk_id text not null,
  relevance_score float,
  was_used boolean default true,
  created_at timestamptz default now()
);

-- Indexes for common query patterns
create index idx_tutor_sessions_user_id on public.tutor_sessions(user_id);
create index idx_tutor_sessions_user_last_message on public.tutor_sessions(user_id, last_message_at desc);
create index idx_tutor_messages_session_id on public.tutor_messages(session_id);
create index idx_tutor_messages_session_created on public.tutor_messages(session_id, created_at);
create index idx_student_ai_memory_user_subject on public.student_ai_memory(user_id, subject);
create index idx_student_topic_progress_user_subject on public.student_topic_progress(user_id, subject);
create index idx_retrieved_chunks_log_message_id on public.retrieved_chunks_log(message_id);

-- Row Level Security
alter table public.tutor_sessions enable row level security;
alter table public.tutor_messages enable row level security;
alter table public.student_ai_memory enable row level security;
alter table public.student_topic_progress enable row level security;
alter table public.retrieved_chunks_log enable row level security;

-- tutor_sessions: users see only their own sessions
create policy "Users can view own tutor sessions" on public.tutor_sessions
  for select using (auth.uid() = user_id);

create policy "Users can insert own tutor sessions" on public.tutor_sessions
  for insert with check (auth.uid() = user_id);

create policy "Users can update own tutor sessions" on public.tutor_sessions
  for update using (auth.uid() = user_id);

create policy "Users can delete own tutor sessions" on public.tutor_sessions
  for delete using (auth.uid() = user_id);

-- tutor_messages: access via session ownership
create policy "Users can view own tutor messages" on public.tutor_messages
  for select using (
    exists (select 1 from public.tutor_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

create policy "Users can insert own tutor messages" on public.tutor_messages
  for insert with check (
    exists (select 1 from public.tutor_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

create policy "Users can update own tutor messages" on public.tutor_messages
  for update using (
    exists (select 1 from public.tutor_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

create policy "Users can delete own tutor messages" on public.tutor_messages
  for delete using (
    exists (select 1 from public.tutor_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

-- student_ai_memory: users see only their own
create policy "Users can view own ai memory" on public.student_ai_memory
  for select using (auth.uid() = user_id);

create policy "Users can insert own ai memory" on public.student_ai_memory
  for insert with check (auth.uid() = user_id);

create policy "Users can update own ai memory" on public.student_ai_memory
  for update using (auth.uid() = user_id);

-- student_topic_progress: users see only their own
create policy "Users can view own topic progress" on public.student_topic_progress
  for select using (auth.uid() = user_id);

create policy "Users can insert own topic progress" on public.student_topic_progress
  for insert with check (auth.uid() = user_id);

create policy "Users can update own topic progress" on public.student_topic_progress
  for update using (auth.uid() = user_id);

create policy "Users can delete own topic progress" on public.student_topic_progress
  for delete using (auth.uid() = user_id);

-- retrieved_chunks_log: access via message -> session ownership
create policy "Users can view own retrieved chunks" on public.retrieved_chunks_log
  for select using (
    exists (
      select 1 from public.tutor_messages m
      join public.tutor_sessions s on s.id = m.session_id
      where m.id = message_id and s.user_id = auth.uid()
    )
  );

create policy "Users can insert own retrieved chunks" on public.retrieved_chunks_log
  for insert with check (
    exists (
      select 1 from public.tutor_messages m
      join public.tutor_sessions s on s.id = m.session_id
      where m.id = message_id and s.user_id = auth.uid()
    )
  );
