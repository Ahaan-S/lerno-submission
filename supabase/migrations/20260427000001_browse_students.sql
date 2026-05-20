-- Migration: browse_students_for_user RPC
-- Returns paginated students from the same grade, excluding existing friends and blocked users.
-- Includes a mutual_count field: number of friends shared between the current user and the candidate.

CREATE OR REPLACE FUNCTION browse_students_for_user(
    p_user_id   uuid,
    p_grade     text,
    p_limit     int DEFAULT 20,
    p_offset    int DEFAULT 0
)
RETURNS TABLE(
    id                    uuid,
    full_name             text,
    display_name          text,
    grade                 text,
    avatar_url            text,
    allow_friend_requests boolean,
    mutual_count          bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    WITH my_friends AS (
        SELECT CASE
            WHEN user_id_1 = p_user_id THEN user_id_2
            ELSE user_id_1
        END AS friend_id
        FROM friendships
        WHERE (user_id_1 = p_user_id OR user_id_2 = p_user_id)
          AND deleted_at IS NULL
    ),
    blocked AS (
        SELECT blocked_id AS uid FROM user_blocks WHERE blocker_id = p_user_id
        UNION
        SELECT blocker_id AS uid FROM user_blocks WHERE blocked_id = p_user_id
    )
    SELECT
        pr.id,
        pr.full_name::text,
        sp.display_name::text,
        pr.grade::text,
        pr.avatar_url::text,
        COALESCE(sp.allow_friend_requests, true) AS allow_friend_requests,
        COUNT(DISTINCT cf.friend_id) AS mutual_count
    FROM profiles pr
    LEFT JOIN social_profiles sp ON sp.user_id = pr.id
    -- exclude already-friends
    LEFT JOIN my_friends mf ON mf.friend_id = pr.id
    -- exclude blocked
    LEFT JOIN blocked bl ON bl.uid = pr.id
    -- join candidate's friendships to find overlap with my_friends
    LEFT JOIN friendships cf_raw
        ON (cf_raw.user_id_1 = pr.id OR cf_raw.user_id_2 = pr.id)
        AND cf_raw.deleted_at IS NULL
    -- overlap check: candidate's friend is also in my_friends
    LEFT JOIN my_friends cf
        ON cf.friend_id = CASE
            WHEN cf_raw.user_id_1 = pr.id THEN cf_raw.user_id_2
            ELSE cf_raw.user_id_1
        END
    WHERE pr.id <> p_user_id
      AND pr.grade::text = p_grade
      AND mf.friend_id IS NULL          -- not already a friend
      AND bl.uid IS NULL                -- not blocked
      AND COALESCE(sp.profile_privacy, 'public') <> 'private'
    GROUP BY pr.id, pr.full_name, sp.display_name, pr.grade, pr.avatar_url, sp.allow_friend_requests
    ORDER BY mutual_count DESC, pr.full_name NULLS LAST
    LIMIT  p_limit
    OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION browse_students_for_user(uuid, text, int, int) TO authenticated;
