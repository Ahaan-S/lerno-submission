-- Performance indexes for study planner queries

-- Range query: start_time < rangeEnd AND end_time > rangeStart
-- The existing (user_id, start_time) index covers the first condition;
-- this covers the second and avoids a sequential scan on end_time.
CREATE INDEX IF NOT EXISTS idx_study_events_user_end_time
  ON public.study_events(user_id, end_time);

-- Recurring event bulk operations (DELETE/PATCH WHERE recurrence_group_id = ?)
-- Without this, bulk deletes/updates scan the full table.
CREATE INDEX IF NOT EXISTS idx_study_events_recurrence_group
  ON public.study_events(recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;

-- Completed backlog items filtered by completed_at date range
-- (used by fetchCompletedBacklogToday)
CREATE INDEX IF NOT EXISTS idx_study_backlog_completed_at
  ON public.study_backlog(user_id, completed_at)
  WHERE completed = true;

-- Exam-plan events lookup (used by exam plan engine and upcoming exams fetch)
CREATE INDEX IF NOT EXISTS idx_study_events_plan_run
  ON public.study_events(plan_run_id)
  WHERE plan_run_id IS NOT NULL;
