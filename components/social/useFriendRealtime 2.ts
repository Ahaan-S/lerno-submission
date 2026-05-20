"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";

/**
 * Subscribe to friend request + notification inserts for the current user.
 * Requires `friend_requests` and `notifications` added to the `supabase_realtime` publication in Supabase.
 */
export function useFriendRealtime(userId: string | null, onRefresh: () => void) {
    const cbRef = useRef(onRefresh);

    useEffect(() => {
        cbRef.current = onRefresh;
    }, [onRefresh]);

    useEffect(() => {
        if (!userId) return;
        const supabase = createClient();

        const channel = supabase
            .channel(`friend-realtime:${userId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "friend_requests",
                    filter: `recipient_id=eq.${userId}`,
                },
                () => {
                    cbRef.current?.();
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "friend_requests",
                    filter: `sender_id=eq.${userId}`,
                },
                () => {
                    cbRef.current?.();
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "friend_requests",
                    filter: `recipient_id=eq.${userId}`,
                },
                () => {
                    cbRef.current?.();
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${userId}`,
                },
                () => {
                    cbRef.current?.();
                }
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [userId, onRefresh]);
}
