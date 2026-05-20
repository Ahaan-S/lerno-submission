-- Persisted notes/summary documents from Ask Mode generate-doc pipeline.

CREATE TABLE IF NOT EXISTS public.generated_docs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id    UUID REFERENCES public.tutor_sessions(id) ON DELETE SET NULL,
  subject       TEXT NOT NULL,
  chapter_index TEXT,
  task_type     TEXT NOT NULL CHECK (task_type IN ('notes', 'summary')),
  title         TEXT NOT NULL,
  content       JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS generated_docs_user_task_idx
  ON public.generated_docs (user_id, task_type, created_at DESC);

ALTER TABLE public.generated_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own docs"
  ON public.generated_docs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
