-- ============================================================
-- MIGRATION 2: Functions & Triggers for Social Graph
-- ============================================================

CREATE OR REPLACE FUNCTION public.are_friends(user_a uuid, user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE deleted_at IS NULL
      AND user_id_1 = LEAST(user_a, user_b)
      AND user_id_2 = GREATEST(user_a, user_b)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_blocked(user_a uuid, user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = user_a AND blocked_id = user_b)
       OR (blocker_id = user_b AND blocked_id = user_a)
  );
$$;

CREATE OR REPLACE FUNCTION public.accept_friend_request(p_request_id uuid, p_recipient_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.friend_requests;
BEGIN
  SELECT * INTO v_request
  FROM public.friend_requests
  WHERE id = p_request_id
    AND recipient_id = p_recipient_id
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already actioned';
  END IF;

  UPDATE public.friend_requests
  SET status = 'accepted', actioned_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.friendships (user_id_1, user_id_2, request_id)
  VALUES (
    LEAST(v_request.sender_id, v_request.recipient_id),
    GREATEST(v_request.sender_id, v_request.recipient_id),
    p_request_id
  )
  ON CONFLICT (user_id_1, user_id_2) DO UPDATE SET deleted_at = NULL, request_id = EXCLUDED.request_id;

  UPDATE public.social_profiles
  SET friend_count = friend_count + 1
  WHERE user_id IN (v_request.sender_id, v_request.recipient_id);

  INSERT INTO public.notifications (user_id, actor_id, type, title, body, data)
  VALUES
    (v_request.sender_id, v_request.recipient_id,
     'friend_request_accepted',
     'Friend request accepted',
     NULL,
     jsonb_build_object('request_id', p_request_id, 'friendship_with', v_request.recipient_id)),
    (v_request.recipient_id, v_request.sender_id,
     'friend_request_accepted',
     'You are now friends',
     NULL,
     jsonb_build_object('request_id', p_request_id, 'friendship_with', v_request.sender_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_friend_request(p_request_id uuid, p_recipient_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n int;
BEGIN
  UPDATE public.friend_requests
  SET status = 'declined', actioned_at = now()
  WHERE id = p_request_id
    AND recipient_id = p_recipient_id
    AND status = 'pending';

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Request not found or already actioned';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.unfriend(p_user_id uuid, p_friend_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n int;
BEGIN
  UPDATE public.friendships
  SET deleted_at = now()
  WHERE user_id_1 = LEAST(p_user_id, p_friend_id)
    AND user_id_2 = GREATEST(p_user_id, p_friend_id)
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF v_n > 0 THEN
    UPDATE public.social_profiles
    SET friend_count = GREATEST(0, friend_count - 1)
    WHERE user_id IN (p_user_id, p_friend_id);
  END IF;
END;
$$;

-- Insert notification when someone receives a pending friend request
CREATE OR REPLACE FUNCTION public.notify_friend_request_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, actor_id, type, title, body, data)
    VALUES (
      NEW.recipient_id,
      NEW.sender_id,
      'friend_request_received',
      'New friend request',
      NULLIF(trim(COALESCE(NEW.message, '')), ''),
      jsonb_build_object('request_id', NEW.id, 'sender_id', NEW.sender_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_friend_requests_notify_insert
  AFTER INSERT ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_friend_request_received();

CREATE OR REPLACE FUNCTION public.create_social_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.social_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_create_social
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_social_profile();

INSERT INTO public.social_profiles (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_blocked(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_friend_request(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unfriend(uuid, uuid) TO authenticated;
