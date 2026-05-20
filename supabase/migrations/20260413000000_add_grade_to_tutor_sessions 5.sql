-- Add grade column to tutor_sessions so history is separated per grade.
-- Existing sessions get null (treated as matching any grade by the API until backfilled).
alter table public.tutor_sessions add column if not exists grade smallint;

-- Index speeds up the WHERE user_id = ? AND grade = ? queries used by the sessions list API.
create index if not exists idx_tutor_sessions_user_grade
  on public.tutor_sessions(user_id, grade, last_message_at desc);
