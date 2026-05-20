-- Study planner / calendar: events, backlog, daily aggregates (see docs/calendar_plan.md)

CREATE TABLE IF NOT EXISTS public.study_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapter_index INTEGER,
  chapter_name TEXT,
  topic TEXT,
  related_exam TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  notes TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'skipped', 'in_progress')),
  completed_at TIMESTAMPTZ,
  google_event_id TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_backlog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  estimated_minutes INTEGER DEFAULT 45,
  due_date DATE,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_study_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_minutes INTEGER NOT NULL DEFAULT 0,
  subjects_covered TEXT[] NOT NULL DEFAULT '{}',
  events_completed INTEGER NOT NULL DEFAULT 0,
  backlog_reduced INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_study_events_user_time ON public.study_events(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_study_events_user_status ON public.study_events(user_id, status);
CREATE INDEX IF NOT EXISTS idx_study_backlog_user ON public.study_backlog(user_id, completed, priority);
CREATE INDEX IF NOT EXISTS idx_daily_stats_user_date ON public.daily_study_stats(user_id, date);

ALTER TABLE public.study_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_backlog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_study_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own study events" ON public.study_events;
DROP POLICY IF EXISTS "Users manage own study backlog" ON public.study_backlog;
DROP POLICY IF EXISTS "Users manage own daily study stats" ON public.daily_study_stats;

CREATE POLICY "Users manage own study events" ON public.study_events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own study backlog" ON public.study_backlog
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own daily study stats" ON public.daily_study_stats
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
