-- Pre-generated diagnostic quiz questions cache.
-- Keyed by (grade, subject, chapter_index) — seeded via scripts/seed-diagnostic-questions.ts.
-- API route checks this first before calling Gemini, making diagnostics instant.

CREATE TABLE IF NOT EXISTS diagnostic_questions_cache (
  id          bigserial PRIMARY KEY,
  grade       smallint  NOT NULL,
  subject     text      NOT NULL,
  chapter_index smallint NOT NULL,
  chapter_name  text    NOT NULL,
  questions   jsonb     NOT NULL,
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT diagnostic_questions_cache_unique UNIQUE (grade, subject, chapter_index)
);

CREATE INDEX IF NOT EXISTS diagnostic_questions_cache_lookup_idx
  ON diagnostic_questions_cache (grade, subject, chapter_index);

ALTER TABLE diagnostic_questions_cache ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read (needed by the API route via createClient)
CREATE POLICY "Authenticated users can read diagnostic questions"
  ON diagnostic_questions_cache FOR SELECT
  TO authenticated
  USING (true);
