-- Add sqp_year and sqp_set_code columns to study_questions.
-- SQP (Sample Question Paper) questions have their own year and set code
-- distinct from PYQ (Previous Year Questions).

ALTER TABLE public.study_questions
  ADD COLUMN IF NOT EXISTS sqp_year     int,
  ADD COLUMN IF NOT EXISTS sqp_set_code text;

CREATE INDEX IF NOT EXISTS idx_study_questions_sqp_year
  ON public.study_questions (source, sqp_year DESC)
  WHERE source = 'sqp';
