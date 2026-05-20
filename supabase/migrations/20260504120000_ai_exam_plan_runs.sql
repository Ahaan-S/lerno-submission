-- AI exam planner draft/review flow.

CREATE TABLE IF NOT EXISTS public.exam_plan_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exam_event_id UUID NOT NULL REFERENCES public.study_events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'questioning'
    CHECK (status IN ('questioning', 'drafted', 'committed', 'cancelled')),
  context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  question_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  draft_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.study_events
  ADD COLUMN IF NOT EXISTS plan_run_id UUID REFERENCES public.exam_plan_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exam_plan_runs_user_exam
  ON public.exam_plan_runs(user_id, exam_event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_study_events_plan_run
  ON public.study_events(user_id, plan_run_id);

ALTER TABLE public.exam_plan_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own exam plan runs" ON public.exam_plan_runs;

CREATE POLICY "Users manage own exam plan runs" ON public.exam_plan_runs
  FOR ALL
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
