-- ============================================================
-- MIGRATION 1: Core Social Graph
-- Creates: friend_requests, friendships, user_blocks, social_profiles, notifications
-- ============================================================

-- ── Enum types ─────────────────────────────────────────────
CREATE TYPE public.friend_request_status AS ENUM (
  'pending',
  'accepted',
  'declined',
  'cancelled',
  'expired'
);

CREATE TYPE public.privacy_level AS ENUM (
  'public',
  'friends_only',
  'private'
);

-- ── friend_requests ─────────────────────────────────────────
CREATE TABLE public.friend_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status          public.friend_request_status NOT NULL DEFAULT 'pending',
  message         text,
  created_at      timestamptz DEFAULT now() NOT NULL,
  actioned_at     timestamptz,
  expires_at      timestamptz DEFAULT (now() + interval '30 days') NOT NULL,

  CONSTRAINT friend_requests_no_self_request CHECK (sender_id != recipient_id)
);

-- One pending row per direction (re-request after decline uses a new row once prior is non-pending)
CREATE UNIQUE INDEX friend_requests_pending_sender_recipient
  ON public.friend_requests (sender_id, recipient_id)
  WHERE status = 'pending';

CREATE UNIQUE INDEX friend_requests_no_reverse_idx
  ON public.friend_requests (
    LEAST(sender_id::text, recipient_id::text),
    GREATEST(sender_id::text, recipient_id::text)
  )
  WHERE status = 'pending';

CREATE INDEX friend_requests_recipient_pending
  ON public.friend_requests (recipient_id, status, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX friend_requests_sender
  ON public.friend_requests (sender_id, created_at DESC);

-- ── friendships ─────────────────────────────────────────────
CREATE TABLE public.friendships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_1       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id_2       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id      uuid REFERENCES public.friend_requests(id) ON DELETE SET NULL,

  list_id         uuid,

  privacy_override public.privacy_level,

  created_at      timestamptz DEFAULT now() NOT NULL,
  deleted_at      timestamptz,

  CONSTRAINT friendships_no_self CHECK (user_id_1 != user_id_2),
  CONSTRAINT friendships_ordered CHECK (user_id_1 < user_id_2),
  CONSTRAINT friendships_unique_pair UNIQUE (user_id_1, user_id_2)
);

CREATE INDEX friendships_user1_active ON public.friendships (user_id_1, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX friendships_user2_active ON public.friendships (user_id_2, created_at DESC) WHERE deleted_at IS NULL;

-- ── user_blocks ─────────────────────────────────────────────
CREATE TABLE public.user_blocks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT user_blocks_no_self CHECK (blocker_id != blocked_id),
  CONSTRAINT user_blocks_unique UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX user_blocks_blocker ON public.user_blocks (blocker_id);
CREATE INDEX user_blocks_blocked ON public.user_blocks (blocked_id);

-- ── social_profiles ─────────────────────────────────────────
CREATE TABLE public.social_profiles (
  user_id           uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

  display_name      text,
  bio               text,
  avatar_emoji      text,

  profile_privacy         public.privacy_level DEFAULT 'public',
  analytics_privacy       public.privacy_level DEFAULT 'friends_only',
  activity_privacy        public.privacy_level DEFAULT 'friends_only',

  allow_friend_requests   boolean DEFAULT true,
  require_mutual_friend   boolean DEFAULT false,

  friend_count      int DEFAULT 0,
  streak_shared     boolean DEFAULT false,

  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- ── notifications ────────────────────────────────────────────
CREATE TYPE public.notification_type AS ENUM (
  'friend_request_received',
  'friend_request_accepted',
  'friend_request_declined',

  'friend_joined_lerno',
  'friend_milestone',

  'study_invite_received',
  'study_invite_accepted',
  'study_session_started',

  'leaderboard_overtaken',
  'challenge_received',

  'new_message',
  'message_reaction'
);

CREATE TABLE public.notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type            public.notification_type NOT NULL,
  title           text NOT NULL,
  body            text,
  data            jsonb DEFAULT '{}',
  read_at         timestamptz,
  actioned_at     timestamptz,
  created_at      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX notifications_user_all
  ON public.notifications (user_id, created_at DESC);

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE public.friend_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own requests (sent or received)"
  ON public.friend_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send friend requests"
  ON public.friend_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Sender can cancel their own pending request"
  ON public.friend_requests FOR UPDATE
  USING (auth.uid() = sender_id AND status = 'pending')
  WITH CHECK (status = 'cancelled');

CREATE POLICY "Recipient can accept or decline"
  ON public.friend_requests FOR UPDATE
  USING (auth.uid() = recipient_id AND status = 'pending')
  WITH CHECK (status IN ('accepted', 'declined'));

CREATE POLICY "Users can read their own friendships"
  ON public.friendships FOR SELECT
  USING (
    (auth.uid() = user_id_1 OR auth.uid() = user_id_2)
    AND deleted_at IS NULL
  );

CREATE POLICY "Public profiles are readable by authenticated users"
  ON public.social_profiles FOR SELECT
  TO authenticated
  USING (profile_privacy = 'public' OR auth.uid() = user_id);

CREATE POLICY "Users can manage their own social profile"
  ON public.social_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own blocks"
  ON public.user_blocks FOR ALL
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can read their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark their own notifications as read"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Optional: Supabase Dashboard → Database → Publications → supabase_realtime
-- add public.friend_requests and public.notifications for client Realtime subscriptions.
