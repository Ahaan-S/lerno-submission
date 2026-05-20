import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/utils/supabase/admin";

/** Escape `%` and `_` for Postgres ILIKE */
export function escapeIlikePattern(q: string): string {
    return q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export async function isBlockedBetween(
    supabase: SupabaseClient,
    userA: string,
    userB: string
): Promise<boolean> {
    const { data, error } = await supabase.rpc("is_blocked", {
        user_a: userA,
        user_b: userB,
    });
    if (error) {
        console.error("[social] is_blocked rpc error", error);
        return true;
    }
    return Boolean(data);
}

export async function areFriends(
    supabase: SupabaseClient,
    userA: string,
    userB: string
): Promise<boolean> {
    const { data, error } = await supabase.rpc("are_friends", {
        user_a: userA,
        user_b: userB,
    });
    if (error) {
        console.error("[social] are_friends rpc error", error);
        return false;
    }
    return Boolean(data);
}

export function getAdminOrNull() {
    return createAdminClient();
}
