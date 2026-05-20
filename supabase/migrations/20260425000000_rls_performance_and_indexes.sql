-- RLS performance: wrap auth.uid() in (select auth.uid()) so it is evaluated
-- once per statement rather than once per row. 5-10x faster on tables with many rows.
-- Also adds composite index for chapter_learn_progress used in Learn Mode queries.

-- ── tutor_sessions ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own tutor sessions"   ON public.tutor_sessions;
DROP POLICY IF EXISTS "Users can insert own tutor sessions" ON public.tutor_sessions;
DROP POLICY IF EXISTS "Users can update own tutor sessions" ON public.tutor_sessions;
DROP POLICY IF EXISTS "Users can delete own tutor sessions" ON public.tutor_sessions;

CREATE POLICY "Users can view own tutor sessions" ON public.tutor_sessions
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own tutor sessions" ON public.tutor_sessions
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own tutor sessions" ON public.tutor_sessions
  FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own tutor sessions" ON public.tutor_sessions
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ── tutor_messages ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own tutor messages"   ON public.tutor_messages;
DROP POLICY IF EXISTS "Users can insert own tutor messages" ON public.tutor_messages;
DROP POLICY IF EXISTS "Users can update own tutor messages" ON public.tutor_messages;
DROP POLICY IF EXISTS "Users can delete own tutor messages" ON public.tutor_messages;

CREATE POLICY "Users can view own tutor messages" ON public.tutor_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tutor_sessions s WHERE s.id = session_id AND s.user_id = (SELECT auth.uid()))
  );

CREATE POLICY "Users can insert own tutor messages" ON public.tutor_messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.tutor_sessions s WHERE s.id = session_id AND s.user_id = (SELECT auth.uid()))
  );

CREATE POLICY "Users can update own tutor messages" ON public.tutor_messages
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.tutor_sessions s WHERE s.id = session_id AND s.user_id = (SELECT auth.uid()))
  );

CREATE POLICY "Users can delete own tutor messages" ON public.tutor_messages
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.tutor_sessions s WHERE s.id = session_id AND s.user_id = (SELECT auth.uid()))
  );

-- ── student_ai_memory ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own ai memory"   ON public.student_ai_memory;
DROP POLICY IF EXISTS "Users can insert own ai memory" ON public.student_ai_memory;
DROP POLICY IF EXISTS "Users can update own ai memory" ON public.student_ai_memory;

CREATE POLICY "Users can view own ai memory" ON public.student_ai_memory
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own ai memory" ON public.student_ai_memory
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own ai memory" ON public.student_ai_memory
  FOR UPDATE USING ((select auth.uid()) = user_id);

-- ── student_topic_progress ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own topic progress"   ON public.student_topic_progress;
DROP POLICY IF EXISTS "Users can insert own topic progress" ON public.student_topic_progress;
DROP POLICY IF EXISTS "Users can update own topic progress" ON public.student_topic_progress;
DROP POLICY IF EXISTS "Users can delete own topic progress" ON public.student_topic_progress;

CREATE POLICY "Users can view own topic progress" ON public.student_topic_progress
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own topic progress" ON public.student_topic_progress
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own topic progress" ON public.student_topic_progress
  FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own topic progress" ON public.student_topic_progress
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ── retrieved_chunks_log ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own retrieved chunks"   ON public.retrieved_chunks_log;
DROP POLICY IF EXISTS "Users can insert own retrieved chunks" ON public.retrieved_chunks_log;

CREATE POLICY "Users can view own retrieved chunks" ON public.retrieved_chunks_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tutor_messages m
      JOIN public.tutor_sessions s ON s.id = m.session_id
      WHERE m.id = message_id AND s.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert own retrieved chunks" ON public.retrieved_chunks_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tutor_messages m
      JOIN public.tutor_sessions s ON s.id = m.session_id
      WHERE m.id = message_id AND s.user_id = (SELECT auth.uid())
    )
  );

-- ── message_feedback ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can insert own feedback" ON public.message_feedback;
DROP POLICY IF EXISTS "Users can update own feedback" ON public.message_feedback;
DROP POLICY IF EXISTS "Users can read own feedback"   ON public.message_feedback;
DROP POLICY IF EXISTS "Users can delete own feedback" ON public.message_feedback;

CREATE POLICY "Users can insert own feedback" ON public.message_feedback
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own feedback" ON public.message_feedback
  FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can read own feedback" ON public.message_feedback
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own feedback" ON public.message_feedback
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ── memory_entries ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can read own memory entries" ON public.memory_entries;

CREATE POLICY "Users can read own memory entries" ON public.memory_entries
  FOR SELECT USING ((select auth.uid()) = user_id);

-- ── study_feed_sessions ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can insert their own feed sessions" ON public.study_feed_sessions;
DROP POLICY IF EXISTS "Users can read their own feed sessions"   ON public.study_feed_sessions;
DROP POLICY IF EXISTS "Users can update their own feed sessions" ON public.study_feed_sessions;

CREATE POLICY "Users can insert their own feed sessions" ON public.study_feed_sessions
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can read their own feed sessions" ON public.study_feed_sessions
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own feed sessions" ON public.study_feed_sessions
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id);

-- ── study_attempts ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can insert their own attempts" ON public.study_attempts;
DROP POLICY IF EXISTS "Users can read their own attempts"   ON public.study_attempts;

CREATE POLICY "Users can insert their own attempts" ON public.study_attempts
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can read their own attempts" ON public.study_attempts
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

-- ── study_events / study_backlog / daily_study_stats ─────────────────────────

DROP POLICY IF EXISTS "Users manage own study events"       ON public.study_events;
DROP POLICY IF EXISTS "Users manage own study backlog"      ON public.study_backlog;
DROP POLICY IF EXISTS "Users manage own daily study stats"  ON public.daily_study_stats;

CREATE POLICY "Users manage own study events" ON public.study_events
  FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users manage own study backlog" ON public.study_backlog
  FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users manage own daily study stats" ON public.daily_study_stats
  FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- ── generated_docs ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can CRUD their own docs" ON public.generated_docs;

CREATE POLICY "Users can CRUD their own docs" ON public.generated_docs
  FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- ── Composite index for chapter_learn_progress ────────────────────────────────
-- This table was created directly in Supabase (not via migration).
-- The Learn Mode chat route queries by (user_id, subject, chapter_index) with
-- order by updated_at DESC limit 1, so this index covers the full query.

CREATE INDEX IF NOT EXISTS idx_chapter_learn_progress_user_subject_chapter
  ON public.chapter_learn_progress (user_id, subject, chapter_index, updated_at DESC);

-- ── Composite index for study_events range queries ────────────────────────────
-- /api/planner/events queries: WHERE user_id=$1 AND start_time < rangeEnd AND end_time > rangeStart
-- This covers the interval-overlap pattern efficiently.

CREATE INDEX IF NOT EXISTS idx_study_events_user_range
  ON public.study_events (user_id, start_time, end_time);
