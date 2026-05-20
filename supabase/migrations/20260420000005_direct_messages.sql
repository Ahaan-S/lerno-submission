-- ============================================================
-- MIGRATION 5: Direct Messages (Phase 5 prep)
-- ============================================================

CREATE TABLE public.direct_message_threads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_1   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id_2   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  last_message_at timestamptz,

  CONSTRAINT dm_threads_ordered CHECK (user_id_1 < user_id_2),
  CONSTRAINT dm_threads_unique UNIQUE (user_id_1, user_id_2)
);

CREATE TABLE public.direct_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid NOT NULL REFERENCES public.direct_message_threads(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     text NOT NULL,
  read_at     timestamptz,
  deleted_at  timestamptz,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX dm_messages_thread ON public.direct_messages (thread_id, created_at DESC);

ALTER TABLE public.direct_message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Thread participants can read threads"
  ON public.direct_message_threads FOR SELECT
  USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

CREATE POLICY "Thread participants can read messages"
  ON public.direct_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.direct_message_threads t
      WHERE t.id = thread_id
        AND (t.user_id_1 = auth.uid() OR t.user_id_2 = auth.uid())
    )
  );

CREATE POLICY "Sender can insert messages (friends only)"
  ON public.direct_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.direct_message_threads t
      WHERE t.id = thread_id
        AND public.are_friends(t.user_id_1, t.user_id_2)
        AND NOT public.is_blocked(t.user_id_1, t.user_id_2)
    )
  );
