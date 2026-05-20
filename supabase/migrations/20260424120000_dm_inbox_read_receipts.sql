-- DM inbox summary (one round-trip) + safe bulk read receipts
-- Run after direct_messages + content_shares migrations.

-- ── 1) Mark all incoming messages in a thread as read (SECURITY DEFINER) ───
CREATE OR REPLACE FUNCTION public.mark_dm_thread_read(p_thread_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.direct_message_threads t
    WHERE t.id = p_thread_id
      AND (t.user_id_1 = me OR t.user_id_2 = me)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.direct_messages dm
  SET read_at = now()
  WHERE dm.thread_id = p_thread_id
    AND dm.sender_id IS DISTINCT FROM me
    AND dm.read_at IS NULL
    AND dm.deleted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_dm_thread_read(uuid) TO authenticated;

-- ── 2) Inbox rows for the current user ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dm_inbox_for_user()
RETURNS TABLE (
  thread_id uuid,
  peer_id uuid,
  sort_at timestamptz,
  last_content text,
  last_message_type text,
  last_sender_id uuid,
  unread_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT auth.uid() AS id),
  peer AS (
    SELECT t.id AS thread_id,
           CASE WHEN t.user_id_1 = me.id THEN t.user_id_2 ELSE t.user_id_1 END AS peer_id,
           t.last_message_at,
           t.created_at AS thread_created_at
    FROM public.direct_message_threads t
    CROSS JOIN me
    WHERE t.user_id_1 = me.id OR t.user_id_2 = me.id
  ),
  latest AS (
    SELECT DISTINCT ON (d.thread_id)
      d.thread_id,
      d.content,
      d.message_type,
      d.created_at,
      d.sender_id
    FROM public.direct_messages d
    INNER JOIN peer p ON p.thread_id = d.thread_id
    WHERE d.deleted_at IS NULL
    ORDER BY d.thread_id, d.created_at DESC
  ),
  unread AS (
    SELECT d.thread_id, COUNT(*)::bigint AS c
    FROM public.direct_messages d
    INNER JOIN me ON true
    INNER JOIN peer p ON p.thread_id = d.thread_id
    WHERE d.deleted_at IS NULL
      AND d.sender_id IS DISTINCT FROM me.id
      AND d.read_at IS NULL
    GROUP BY d.thread_id
  )
  SELECT p.thread_id,
         p.peer_id,
         COALESCE(l.created_at, p.last_message_at, p.thread_created_at) AS sort_at,
         l.content AS last_content,
         COALESCE(l.message_type, 'text'::text) AS last_message_type,
         l.sender_id AS last_sender_id,
         COALESCE(u.c, 0::bigint) AS unread_count
  FROM peer p
  LEFT JOIN latest l ON l.thread_id = p.thread_id
  LEFT JOIN unread u ON u.thread_id = p.thread_id
  ORDER BY COALESCE(l.created_at, p.last_message_at, p.thread_created_at) DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.dm_inbox_for_user() TO authenticated;

-- ── 3) Optional index for unread aggregates ────────────────────────────────
CREATE INDEX IF NOT EXISTS dm_unread_lookup
  ON public.direct_messages (thread_id)
  WHERE read_at IS NULL AND deleted_at IS NULL;
