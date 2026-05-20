-- Profile view: public avatars bucket + SECURITY DEFINER RPCs for public profile data.
-- Uses existing social_profiles (profile_privacy) and friendships (user_id_1, user_id_2, deleted_at).
-- Next.js passes p_viewer_id explicitly because service-role RPC calls have no JWT (auth.uid() is NULL).

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "profile_avatars_select" ON storage.objects;
DROP POLICY IF EXISTS "profile_avatars_insert" ON storage.objects;
DROP POLICY IF EXISTS "profile_avatars_update" ON storage.objects;
DROP POLICY IF EXISTS "profile_avatars_delete" ON storage.objects;

CREATE POLICY "profile_avatars_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "profile_avatars_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "profile_avatars_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "profile_avatars_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE OR REPLACE FUNCTION public.get_public_profile(
  p_profile_user_id uuid,
  p_viewer_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name       text;
  v_avatar_url      text;
  v_grade           text;
  v_joined          timestamptz;
  v_sp_display      text;
  v_bio             text;
  v_privacy         text;
  v_is_self         boolean;
  v_friends         boolean := false;
  v_show_full       boolean;
  v_display_name    text;
  v_total_questions bigint;
  v_total_minutes   bigint;
  v_active_days     int;
  v_chapters        jsonb;
  v_friends_count   int;
  v_chapters_done   int;
BEGIN
  SELECT p.full_name, p.avatar_url, p.grade::text, p.created_at
  INTO v_full_name, v_avatar_url, v_grade, v_joined
  FROM public.profiles p
  WHERE p.id = p_profile_user_id;

  IF v_joined IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT sp.display_name, sp.bio, sp.profile_privacy::text
  INTO v_sp_display, v_bio, v_privacy
  FROM public.social_profiles sp
  WHERE sp.user_id = p_profile_user_id;

  v_privacy := COALESCE(v_privacy, 'public');
  v_display_name := COALESCE(NULLIF(trim(v_sp_display), ''), v_full_name);
  v_bio := NULLIF(trim(COALESCE(v_bio, '')), '');

  v_is_self := (p_viewer_id IS NOT NULL AND p_viewer_id = p_profile_user_id);

  IF p_viewer_id IS NOT NULL AND NOT v_is_self THEN
    v_friends := public.are_friends(p_viewer_id, p_profile_user_id);
  END IF;

  v_show_full :=
    v_privacy = 'public'
    OR v_is_self
    OR (v_privacy = 'friends_only' AND v_friends);

  IF NOT v_show_full THEN
    RETURN jsonb_build_object(
      'id', p_profile_user_id,
      'is_visible', false,
      'visibility', CASE
        WHEN v_privacy = 'private' THEN 'private'
        WHEN v_privacy = 'friends_only' THEN 'friends_only'
        ELSE 'private'
      END,
      'display_name', v_display_name,
      'avatar_url', v_avatar_url,
      'grade', v_grade
    );
  END IF;

  SELECT COUNT(*)
  INTO v_total_questions
  FROM public.study_attempts sa
  WHERE sa.user_id = p_profile_user_id
    AND sa.is_correct IS NOT NULL;

  SELECT COALESCE(SUM(uda.minutes_active), 0)::bigint
  INTO v_total_minutes
  FROM public.user_daily_activity uda
  WHERE uda.user_id = p_profile_user_id;

  SELECT COUNT(*)::int
  INTO v_active_days
  FROM (
    SELECT uda.activity_date AS d
    FROM public.user_daily_activity uda
    WHERE uda.user_id = p_profile_user_id
      AND uda.questions_answered > 0
    UNION
    SELECT (sa.attempted_at AT TIME ZONE 'UTC')::date AS d
    FROM public.study_attempts sa
    WHERE sa.user_id = p_profile_user_id
      AND sa.is_correct IS NOT NULL
      AND sa.attempted_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - interval '400 days'
  ) active_days;

  SELECT COUNT(*)::int
  INTO v_chapters_done
  FROM public.chapter_learn_progress clp
  WHERE clp.user_id = p_profile_user_id
    AND clp.status = 'completed';

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'subject', x.subject,
        'chapter_name', x.chapter_name,
        'status', x.status,
        'completed_at', x.completed_at
      )
      ORDER BY x.completed_at DESC NULLS LAST
    ),
    '[]'::jsonb
  )
  INTO v_chapters
  FROM (
    SELECT clp.subject, clp.chapter_name, clp.status, clp.completed_at
    FROM public.chapter_learn_progress clp
    WHERE clp.user_id = p_profile_user_id
      AND clp.status = 'completed'
    ORDER BY clp.completed_at DESC NULLS LAST
    LIMIT 5
  ) x;

  SELECT COUNT(*)::int
  INTO v_friends_count
  FROM public.friendships f
  WHERE f.deleted_at IS NULL
    AND (f.user_id_1 = p_profile_user_id OR f.user_id_2 = p_profile_user_id);

  RETURN jsonb_build_object(
    'id', p_profile_user_id,
    'is_visible', true,
    'visibility', v_privacy,
    'display_name', v_display_name,
    'full_name', v_full_name,
    'avatar_url', v_avatar_url,
    'bio', v_bio,
    'grade', v_grade,
    'joined_at', v_joined,
    'stats', jsonb_build_object(
      'total_questions', v_total_questions,
      'total_minutes', v_total_minutes,
      'active_days', v_active_days,
      'chapters_completed', v_chapters_done
    ),
    'recent_chapters', COALESCE(v_chapters, '[]'::jsonb),
    'friends_count', v_friends_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_profile_hover_card(
  p_user_id uuid,
  p_viewer_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name    text;
  v_avatar_url   text;
  v_grade        text;
  v_sp_display   text;
  v_privacy      text;
  v_is_self      boolean;
  v_friends      boolean := false;
  v_show         boolean;
  v_display_name text;
  v_chapter      text;
BEGIN
  SELECT p.full_name, p.avatar_url, p.grade::text
  INTO v_full_name, v_avatar_url, v_grade
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT sp.display_name, sp.profile_privacy::text
  INTO v_sp_display, v_privacy
  FROM public.social_profiles sp
  WHERE sp.user_id = p_user_id;

  v_privacy := COALESCE(v_privacy, 'public');
  v_display_name := COALESCE(NULLIF(trim(v_sp_display), ''), v_full_name);

  v_is_self := (p_viewer_id IS NOT NULL AND p_viewer_id = p_user_id);

  IF p_viewer_id IS NOT NULL AND NOT v_is_self THEN
    v_friends := public.are_friends(p_viewer_id, p_user_id);
  END IF;

  v_show :=
    v_privacy = 'public'
    OR v_is_self
    OR (v_privacy = 'friends_only' AND v_friends);

  IF NOT v_show THEN
    RETURN NULL;
  END IF;

  SELECT clp.chapter_name INTO v_chapter
  FROM public.chapter_learn_progress clp
  WHERE clp.user_id = p_user_id
    AND clp.status = 'in_progress'
  ORDER BY clp.updated_at DESC NULLS LAST
  LIMIT 1;

  RETURN jsonb_build_object(
    'id', p_user_id,
    'display_name', v_display_name,
    'avatar_url', v_avatar_url,
    'grade', v_grade,
    'current_chapter', v_chapter
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_profile_hover_card(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_hover_card(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_profile_hover_card(uuid, uuid) TO authenticated;
