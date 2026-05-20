-- Expand student_ai_memory and tutor_messages for full memory system

-- student_ai_memory: add cross-session memory columns
ALTER TABLE public.student_ai_memory
  ADD COLUMN IF NOT EXISTS learning_pace        text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS preferred_style      text DEFAULT 'explanation',
  ADD COLUMN IF NOT EXISTS struggle_patterns    jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS total_sessions       integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_messages       integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_session_at      timestamptz,
  ADD COLUMN IF NOT EXISTS chapters_visited     text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at          timestamptz DEFAULT now();

-- tutor_messages: add signals for memory extraction
ALTER TABLE public.tutor_messages
  ADD COLUMN IF NOT EXISTS was_confused         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS follow_up_count      integer DEFAULT 0;

-- tutor_sessions: track when memory was last updated (avoids double-processing)
ALTER TABLE public.tutor_sessions
  ADD COLUMN IF NOT EXISTS memory_updated_at    timestamptz;
