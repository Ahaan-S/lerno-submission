-- Add session rating to tutor_sessions
ALTER TABLE tutor_sessions
  ADD COLUMN IF NOT EXISTS session_rating smallint CHECK (session_rating BETWEEN 1 AND 3),
  ADD COLUMN IF NOT EXISTS session_rating_comment text;

-- General feedback (feature requests, bug reports, suggestions)
CREATE TABLE IF NOT EXISTS general_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  type text NOT NULL DEFAULT 'general' CHECK (type IN ('issue', 'suggestion', 'general')),
  message text NOT NULL,
  grade text,
  created_at timestamptz DEFAULT now()
);

-- Index for admin queries by type and time
CREATE INDEX IF NOT EXISTS general_feedback_type_created_at_idx
  ON general_feedback (type, created_at DESC);

ALTER TABLE general_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own general feedback"
  ON general_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own general feedback"
  ON general_feedback FOR SELECT
  USING (auth.uid() = user_id);
