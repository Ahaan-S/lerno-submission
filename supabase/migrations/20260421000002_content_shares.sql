-- ============================================================
-- Content sharing: enum values, DM message shape, thread upsert
-- Run after social graph + DM base migration (20260420000005).
-- If ALTER TYPE ... ADD VALUE fails inside a transaction, run those
-- two lines alone in the Supabase SQL editor, then run the rest.
-- ============================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'question_shared';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'session_shared';

ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text';

DO $$
BEGIN
  ALTER TABLE public.direct_messages
    ADD CONSTRAINT direct_messages_message_type_check
    CHECK (message_type IN ('text', 'question_share', 'session_share'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Server-side thread upsert (ordered pair); callable only after friendship check inside.
CREATE OR REPLACE FUNCTION public.upsert_dm_thread(p_user_a uuid, p_user_b uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_u1 uuid := LEAST(p_user_a, p_user_b);
  v_u2 uuid := GREATEST(p_user_a, p_user_b);
  v_id uuid;
BEGIN
  IF p_user_a = p_user_b THEN
    RAISE EXCEPTION 'invalid pair';
  END IF;

  IF NOT public.are_friends(p_user_a, p_user_b) THEN
    RAISE EXCEPTION 'not_friends';
  END IF;

  IF public.is_blocked(p_user_a, p_user_b) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  INSERT INTO public.direct_message_threads (user_id_1, user_id_2)
  VALUES (v_u1, v_u2)
  ON CONFLICT (user_id_1, user_id_2) DO NOTHING;

  SELECT id INTO v_id
  FROM public.direct_message_threads
  WHERE user_id_1 = v_u1 AND user_id_2 = v_u2;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'thread_missing';
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_dm_thread(uuid, uuid) TO authenticated;
