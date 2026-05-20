-- Memory system redesign
-- Part 1: memory_entries log table (discrete insights per session/event)
-- Part 2: new columns on student_ai_memory
-- Part 3: new columns on student_topic_progress

-- ─────────────────────────────────────────────
-- 1. memory_entries — append-only insight log
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.memory_entries (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subject             text NOT NULL, -- subject key e.g. 'science', 'maths', or 'global' for cross-subject
  entry_type          text NOT NULL CHECK (entry_type IN (
                        'recently_discussed',  -- topic came up in chat
                        'confusion_signal',    -- student showed confusion (follow-ups, was_confused flag)
                        'style_preference',    -- student responded well to a certain explanation style
                        'mistake_pattern',     -- specific recurring error observed in chat
                        'onboarding_fact'      -- self-reported at onboarding
                      )),
  content             text NOT NULL,
  confidence          text NOT NULL DEFAULT 'observed_once' CHECK (confidence IN (
                        'onboarding',          -- self-reported, lower trust
                        'observed_once',       -- seen in one session
                        'observed_multiple',   -- confirmed across multiple sessions
                        'quiz_verified'        -- backed by quiz result (highest trust)
                      )),
  source              text NOT NULL CHECK (source IN ('onboarding', 'chat_session', 'quiz')),
  session_id          uuid REFERENCES public.tutor_sessions(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now() NOT NULL,
  last_confirmed_at   timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS memory_entries_user_subject ON public.memory_entries(user_id, subject);
CREATE INDEX IF NOT EXISTS memory_entries_user_type    ON public.memory_entries(user_id, entry_type);

ALTER TABLE public.memory_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own memory entries"
  ON public.memory_entries FOR SELECT USING (auth.uid() = user_id);

-- Service role (used by edge functions + admin client) has full access via Supabase default behaviour.
-- Explicit policy keeps the intent clear:
CREATE POLICY "Service role full access on memory_entries"
  ON public.memory_entries FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 2. student_ai_memory — new columns
-- ─────────────────────────────────────────────

-- recently_discussed_topics: topics that came up in chat — NOT mastery signals
ALTER TABLE public.student_ai_memory
  ADD COLUMN IF NOT EXISTS recently_discussed_topics text[] DEFAULT '{}';

-- Track whether the memory row has been bootstrapped from onboarding data
ALTER TABLE public.student_ai_memory
  ADD COLUMN IF NOT EXISTS onboarding_seeded boolean DEFAULT false;

-- ─────────────────────────────────────────────
-- 3. student_topic_progress — new columns
-- ─────────────────────────────────────────────

-- Track the source of mastery assessment so quiz-verified > ai_inferred
ALTER TABLE public.student_topic_progress
  ADD COLUMN IF NOT EXISTS mastery_source text DEFAULT 'unassessed'
    CHECK (mastery_source IN ('unassessed', 'quiz_verified', 'ai_inferred'));

-- Quiz performance tracking per topic
ALTER TABLE public.student_topic_progress
  ADD COLUMN IF NOT EXISTS quiz_attempts integer DEFAULT 0;

ALTER TABLE public.student_topic_progress
  ADD COLUMN IF NOT EXISTS quiz_correct integer DEFAULT 0;
