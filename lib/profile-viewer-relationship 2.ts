import type { SupabaseClient } from "@supabase/supabase-js";
import { areFriends } from "@/lib/social/friend-api-helpers";

export type ProfileRelationship =
  | "self"
  | "friends"
  | "pending_outgoing"
  | "pending_incoming"
  | "none";

export async function getProfileRelationship(
  supabase: SupabaseClient,
  viewerId: string | null,
  profileUserId: string
): Promise<ProfileRelationship> {
  if (!viewerId) return "none";
  if (viewerId === profileUserId) return "self";
  if (await areFriends(supabase, viewerId, profileUserId)) return "friends";

  const { data: out } = await supabase
    .from("friend_requests")
    .select("id")
    .eq("sender_id", viewerId)
    .eq("recipient_id", profileUserId)
    .eq("status", "pending")
    .maybeSingle();
  if (out) return "pending_outgoing";

  const { data: inc } = await supabase
    .from("friend_requests")
    .select("id")
    .eq("sender_id", profileUserId)
    .eq("recipient_id", viewerId)
    .eq("status", "pending")
    .maybeSingle();
  if (inc) return "pending_incoming";

  return "none";
}
