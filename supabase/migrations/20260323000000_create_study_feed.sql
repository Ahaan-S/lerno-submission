-- Study Feed: question bank, attempt tracking, and feed sessions
-- Three tables are created in dependency order:
--   1. study_questions  — the question bank (no FK deps)
--   2. study_feed_sessions — one row per scrolling session (refs profiles)
--   3. study_attempts   — every student interaction (refs all three above)

-- ============================================================
-- 1. study_questions
-- ============================================================

CREATE TABLE public.study_questions (
  -- Identity
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  question_code         text UNIQUE NOT NULL,

  -- Academic placement
  grade                 int NOT NULL CHECK (grade BETWEEN 6 AND 12),
  subject               text NOT NULL,
  chapter_index         int NOT NULL,
  chapter_name          text NOT NULL,
  topic_index           text NOT NULL,
  topic_name            text NOT NULL,

  -- Question content
  question_type         text NOT NULL CHECK (question_type IN (
                          'mcq',
                          'assertion_reasoning',
                          'true_false',
                          'fill_blank',
                          'match_following',
                          'short_ans',
                          'long_ans'
                        )),
  question_text         text NOT NULL,
  question_image_url    text,
  marks                 int NOT NULL CHECK (marks BETWEEN 1 AND 5),
  difficulty            text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  estimated_time_secs   int NOT NULL DEFAULT 60,
  bloom_level           text CHECK (bloom_level IN (
                          'remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'
                        )),

  -- MCQ / true_false / assertion_reasoning fields
  options               jsonb,
  -- Format: [{"id": "a", "text": "...", "is_correct": true}, ...]
  correct_option        text,
  -- 'a', 'b', 'c', 'd'. For true_false: 'a' = true, 'b' = false.

  -- Fill in blank fields
  blank_answer          text,
  blank_answers_alt     text[],
  blank_tolerance       text DEFAULT 'fuzzy' CHECK (blank_tolerance IN ('exact', 'fuzzy', 'numeric')),
  numeric_range         jsonb,
  -- For physics/math: {"min": 9.79, "max": 9.82}

  -- Match the following fields
  match_left            text[],
  match_right           text[],
  match_correct         jsonb,
  -- Mapping: {"0": 2, "1": 0, "2": 3, "3": 1} — left index maps to right index

  -- Short / long answer fields
  model_answer          text,
  key_points            text[],
  marking_scheme        jsonb,
  -- [{"point": "Defines photosynthesis correctly", "marks": 1}, ...]
  min_words             int,

  -- Hints (up to 3, progressive reveal)
  hints                 text[],

  -- Solution
  solution_text         text,
  solution_steps        jsonb,
  -- [{"step": 1, "text": "2x + 5 = 15", "explanation": "..."}]
  solution_image_url    text,
  common_mistakes       text[],

  -- Source and provenance
  source                text NOT NULL CHECK (source IN (
                          'ncert_exercise',
                          'ncert_exemplar',
                          'ncert_intext',
                          'pyq',
                          'ai_generated'
                        )),
  pyq_year              int,
  pyq_set_code          text,
  ncert_ref             text,

  -- Concept tags
  concept_tags          text[],

  -- Analytics (updated by backend, never by students directly)
  is_verified           bool NOT NULL DEFAULT false,
  is_active             bool NOT NULL DEFAULT true,
  difficulty_ai_set     bool NOT NULL DEFAULT true,
  times_served          int NOT NULL DEFAULT 0,
  times_attempted       int NOT NULL DEFAULT 0,
  times_correct         int NOT NULL DEFAULT 0,
  avg_time_secs         real,
  flag_count            int NOT NULL DEFAULT 0,
  quality_score         real,
  -- Computed periodically: (times_correct / times_attempted) * (1 - flag_rate).
  -- Null until times_attempted >= 5.

  -- Pipeline metadata
  pipeline_version      text DEFAULT 'v1',
  created_at            timestamptz DEFAULT now() NOT NULL,
  updated_at            timestamptz DEFAULT now() NOT NULL,
  created_by            text DEFAULT 'pipeline_v1'
);

CREATE INDEX study_questions_feed_core
  ON public.study_questions (grade, subject, chapter_index, is_active, difficulty);

CREATE INDEX study_questions_source
  ON public.study_questions (source, pyq_year DESC);

CREATE INDEX study_questions_topic
  ON public.study_questions (subject, topic_index, is_active);

CREATE INDEX study_questions_type_marks
  ON public.study_questions (question_type, marks, is_active);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER study_questions_updated_at
  BEFORE UPDATE ON public.study_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 2. study_feed_sessions
-- (created before study_attempts so the FK reference resolves)
-- ============================================================

CREATE TABLE public.study_feed_sessions (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  -- Snapshot of active filters when the session started
  filters_applied       jsonb NOT NULL DEFAULT '{}',

  -- Session stats (incremented by the attempt API)
  questions_served      int NOT NULL DEFAULT 0,
  questions_attempted   int NOT NULL DEFAULT 0,
  questions_correct     int NOT NULL DEFAULT 0,
  questions_skipped     int NOT NULL DEFAULT 0,
  questions_done_nb     int NOT NULL DEFAULT 0,
  total_hints_used      int NOT NULL DEFAULT 0,
  streak_peak           int NOT NULL DEFAULT 0,
  time_active_secs      int,

  -- Entry point
  entry_source          text NOT NULL DEFAULT 'sidebar' CHECK (entry_source IN (
                          'sidebar', 'tutor_redirect', 'diagnostic', 'dashboard'
                        )),

  started_at            timestamptz DEFAULT now() NOT NULL,
  ended_at              timestamptz
  -- Null while session is active.
);

CREATE INDEX study_feed_sessions_user
  ON public.study_feed_sessions (user_id, started_at DESC);


-- ============================================================
-- 3. study_attempts
-- ============================================================

CREATE TABLE public.study_attempts (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  question_id           uuid REFERENCES public.study_questions(id) ON DELETE CASCADE NOT NULL,
  feed_session_id       uuid REFERENCES public.study_feed_sessions(id) ON DELETE SET NULL,
  tutor_session_id      uuid REFERENCES public.tutor_sessions(id) ON DELETE SET NULL,

  -- What the student did
  interaction_type      text NOT NULL CHECK (interaction_type IN (
                          'answered',
                          'skipped',
                          'marked_as_done'
                        )),

  -- Answer data (null for skipped / marked_as_done)
  answer_given          text,
  selected_option       text,

  -- Result
  is_correct            bool,
  ai_score              int,
  keyword_score         real,
  -- 0.0–1.0; set for short_ans by keyword matching

  -- Self-assessment (long_ans and marked_as_done)
  self_assessed         bool NOT NULL DEFAULT false,
  self_assessed_result  text CHECK (self_assessed_result IN ('correct', 'partial', 'incorrect')),

  -- Engagement
  hints_used            int NOT NULL DEFAULT 0 CHECK (hints_used BETWEEN 0 AND 3),
  time_taken_secs       int,

  -- Context
  source                text NOT NULL DEFAULT 'feed' CHECK (source IN (
                          'feed',
                          'tutor_redirect',
                          'diagnostic'
                        )),
  attempted_at          timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX study_attempts_user_question
  ON public.study_attempts (user_id, question_id, attempted_at DESC);

CREATE INDEX study_attempts_user_recent
  ON public.study_attempts (user_id, attempted_at DESC);

CREATE INDEX study_attempts_feed_session
  ON public.study_attempts (feed_session_id);


-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.study_questions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_feed_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_attempts      ENABLE ROW LEVEL SECURITY;

-- study_questions: anyone authenticated can read active questions;
-- only service role (admin/pipeline) can write.
CREATE POLICY "Authenticated users can read active questions"
  ON public.study_questions FOR SELECT
  TO authenticated
  USING (is_active = true);

-- study_feed_sessions: users own their rows.
CREATE POLICY "Users can insert their own feed sessions"
  ON public.study_feed_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own feed sessions"
  ON public.study_feed_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own feed sessions"
  ON public.study_feed_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- study_attempts: users own their rows.
CREATE POLICY "Users can insert their own attempts"
  ON public.study_attempts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own attempts"
  ON public.study_attempts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
