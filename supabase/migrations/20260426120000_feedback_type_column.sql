-- Add type column to general_feedback (issue / suggestion / general)
ALTER TABLE general_feedback
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'general'
    CHECK (type IN ('issue', 'suggestion', 'general'));

CREATE INDEX IF NOT EXISTS general_feedback_type_created_at_idx
  ON general_feedback (type, created_at DESC);
