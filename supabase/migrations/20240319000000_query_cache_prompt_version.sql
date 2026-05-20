-- Add prompt_version to query_cache so stale entries are not served after prompt changes
-- Bump PROMPT_VERSION in route.ts whenever the system prompt changes significantly

ALTER TABLE public.query_cache
  ADD COLUMN IF NOT EXISTS prompt_version INTEGER NOT NULL DEFAULT 1;

-- Index for the combined lookup (cache_key + prompt_version)
CREATE INDEX IF NOT EXISTS idx_query_cache_key_version
  ON public.query_cache (cache_key, prompt_version);
