-- Opaque share links for AI tutor sessions (read-only via API; fork on first message).
-- Access is mediated by Next.js routes using the service role — no RLS policies on this table.

CREATE TABLE public.tutor_session_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.tutor_sessions(id) ON DELETE CASCADE,
  share_token text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tutor_session_shares_session_unique UNIQUE (session_id),
  CONSTRAINT tutor_session_shares_token_unique UNIQUE (share_token)
);

CREATE INDEX tutor_session_shares_token_idx ON public.tutor_session_shares (share_token);

ALTER TABLE public.tutor_session_shares ENABLE ROW LEVEL SECURITY;
