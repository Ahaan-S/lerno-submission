-- Best-effort presence for friends / DM ("Active now" / "Last seen")
-- Read via existing server routes (service role or friendship-scoped API).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dm_last_seen_at timestamptz;

COMMENT ON COLUMN public.profiles.dm_last_seen_at IS 'Client heartbeat while using the app; used for friends chat online/last seen.';

CREATE OR REPLACE FUNCTION public.bump_dm_presence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.profiles
  SET dm_last_seen_at = now()
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.bump_dm_presence() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_dm_presence() TO authenticated;
