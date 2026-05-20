-- Friend discovery search by name only (profiles.full_name + social_profiles.display_name).
-- SECURITY DEFINER bypasses restrictive profiles RLS so authenticated users can discover others
-- without exposing email; the Next.js route still applies block + privacy filtering.

CREATE OR REPLACE FUNCTION public.search_profiles_for_friends(
  p_exclude_user_id uuid,
  p_ilike_pattern text
)
RETURNS TABLE (
  id uuid,
  full_name text,
  grade text,
  display_name text,
  profile_privacy public.privacy_level,
  allow_friend_requests boolean,
  avatar_emoji text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.full_name,
    p.grade::text,
    sp.display_name,
    COALESCE(sp.profile_privacy, 'public'::public.privacy_level),
    COALESCE(sp.allow_friend_requests, true),
    sp.avatar_emoji
  FROM public.profiles p
  LEFT JOIN public.social_profiles sp ON sp.user_id = p.id
  WHERE p.id <> p_exclude_user_id
    AND (
      (
        p.full_name IS NOT NULL
        AND trim(p.full_name) <> ''
        AND p.full_name ILIKE p_ilike_pattern ESCAPE '\'
      )
      OR (
        sp.display_name IS NOT NULL
        AND trim(sp.display_name) <> ''
        AND sp.display_name ILIKE p_ilike_pattern ESCAPE '\'
      )
    )
  ORDER BY
    lower(
      trim(
        COALESCE(
          NULLIF(trim(sp.display_name), ''),
          NULLIF(trim(p.full_name), ''),
          ''
        )
      )
    ) ASC NULLS LAST
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.search_profiles_for_friends(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_profiles_for_friends(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_profiles_for_friends(uuid, text) TO service_role;
