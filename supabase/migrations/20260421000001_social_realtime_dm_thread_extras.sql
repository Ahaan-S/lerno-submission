-- ============================================================
-- AFTER the 5 social migrations: Realtime + DM threads + touch
-- Run in Supabase SQL Editor (or merge into your workflow).
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS where needed.
-- ============================================================

-- ── 1) Supabase Realtime: add tables to publication ────────
-- If a line errors with "already member of publication", skip that line.

ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_message_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- Optional for co-study later:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.social_study_sessions;

-- ── 2) DM threads: allow friends to create a thread ─────────
-- Migration 5 only had SELECT on threads; without INSERT, clients cannot
-- create (user_id_1, user_id_2) rows. Inserts must satisfy ordered pair.

DROP POLICY IF EXISTS "Friends can create DM threads" ON public.direct_message_threads;

CREATE POLICY "Friends can create DM threads"
  ON public.direct_message_threads FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = user_id_1 OR auth.uid() = user_id_2)
    AND public.are_friends(user_id_1, user_id_2)
    AND NOT public.is_blocked(user_id_1, user_id_2)
  );

-- ── 3) Keep last_message_at in sync (RLS has no thread UPDATE) ─
CREATE OR REPLACE FUNCTION public.touch_dm_thread_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.direct_message_threads
  SET last_message_at = NEW.created_at
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_dm_touch_thread ON public.direct_messages;

CREATE TRIGGER tr_dm_touch_thread
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_dm_thread_last_message();
