-- ============================================================
-- MIGRATION 3: Friend Lists (Phase 2 prep)
-- ============================================================

CREATE TABLE public.friend_lists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        text NOT NULL,
  emoji       text,
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT friend_lists_max_per_user UNIQUE (owner_id, name)
);

ALTER TABLE public.friendships
  ADD CONSTRAINT friendships_list_fk
  FOREIGN KEY (list_id) REFERENCES public.friend_lists(id) ON DELETE SET NULL;

ALTER TABLE public.friend_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own lists"
  ON public.friend_lists FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
