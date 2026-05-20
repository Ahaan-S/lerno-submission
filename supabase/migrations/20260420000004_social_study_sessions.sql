-- ============================================================
-- MIGRATION 4: Social Study Sessions (Phase 3 prep)
-- ============================================================

CREATE TYPE public.social_session_status AS ENUM (
  'invite_sent',
  'active',
  'completed',
  'cancelled'
);

CREATE TABLE public.social_study_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  subject           text NOT NULL,
  chapter_index     int,
  chapter_name      text,
  grade             smallint,

  status            public.social_session_status DEFAULT 'invite_sent',

  host_session_id   uuid REFERENCES public.tutor_sessions(id) ON DELETE SET NULL,
  guest_session_id  uuid REFERENCES public.tutor_sessions(id) ON DELETE SET NULL,

  host_progress     jsonb DEFAULT '{}',
  guest_progress    jsonb DEFAULT '{}',

  started_at        timestamptz,
  ended_at          timestamptz,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE public.social_study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their sessions"
  ON public.social_study_sessions FOR SELECT
  USING (auth.uid() = host_id OR auth.uid() = guest_id);

CREATE POLICY "Host can create and update sessions"
  ON public.social_study_sessions FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Participants can update sessions"
  ON public.social_study_sessions FOR UPDATE
  USING (auth.uid() = host_id OR auth.uid() = guest_id);
