-- ── message_feedback ─────────────────────────────────────────────────────────
-- Stores thumbs up / down feedback left on AI tutor messages.
-- One row per (user, message) — upsert on conflict to allow updating.

create table if not exists message_feedback (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  message_id   uuid not null references tutor_messages(id) on delete cascade,
  session_id   uuid not null references tutor_sessions(id) on delete cascade,
  type         text not null check (type in ('up', 'down')),
  comment      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- one feedback entry per user per message
  unique (user_id, message_id)
);

-- Index for querying all feedback on a session (admin / analytics)
create index message_feedback_session_idx on message_feedback (session_id);
-- Index for querying all feedback by a user
create index message_feedback_user_idx on message_feedback (user_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table message_feedback enable row level security;

-- Users can insert their own feedback
create policy "Users can insert own feedback"
  on message_feedback for insert
  with check (auth.uid() = user_id);

-- Users can update their own feedback (change up→down or edit comment)
create policy "Users can update own feedback"
  on message_feedback for update
  using (auth.uid() = user_id);

-- Users can read their own feedback (e.g. to re-hydrate the UI state)
create policy "Users can read own feedback"
  on message_feedback for select
  using (auth.uid() = user_id);

-- Users can delete (un-react) their own feedback
create policy "Users can delete own feedback"
  on message_feedback for delete
  using (auth.uid() = user_id);

-- ── updated_at trigger ────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger message_feedback_updated_at
  before update on message_feedback
  for each row execute procedure set_updated_at();
