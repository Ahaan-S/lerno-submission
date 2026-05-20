"use server";

import { createClient } from "@/utils/supabase/server";

export async function checkUserExists(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
        return { exists: false as const };
    }

    try {
        const supabase = await createClient();
        const { data, error } = await supabase.rpc("get_user_auth_info", { p_email: normalized });

        if (error) {
            console.error("[checkUserExists] RPC error:", error.message);
            return { error: error.message };
        }

        const result = data as { exists: boolean; isOAuthOnly?: boolean } | null;
        if (!result?.exists) {
            console.log(`[checkUserExists] Email: ${email}, Exists: false`);
            return { exists: false as const };
        }

        console.log(`[checkUserExists] Email: ${email}, Exists: true, isOAuthOnly: ${result.isOAuthOnly}`);
        return {
            exists: true as const,
            isOAuthOnly: result.isOAuthOnly ?? false,
        };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[checkUserExists] Exception:", message);
        return { error: message };
    }
}
