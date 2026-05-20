"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/** Pending incoming friend requests count (sidebar). */
export function FriendRequestBadge({
    className,
    minimal,
}: {
    className?: string;
    /** Small dot only (e.g. collapsed sidebar rail) */
    minimal?: boolean;
}) {
    const [count, setCount] = useState(0);
    const channelRef = useRef<RealtimeChannel | null>(null);

    const refresh = useCallback(async () => {
        const supabase = createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            setCount(0);
            return;
        }
        const { count: c, error } = await supabase
            .from("friend_requests")
            .select("id", { count: "exact", head: true })
            .eq("recipient_id", user.id)
            .eq("status", "pending");

        if (error) {
            console.warn("[FriendRequestBadge]", error.message);
            setCount(0);
            return;
        }
        setCount(c ?? 0);
    }, []);

    useEffect(() => {
        queueMicrotask(() => {
            void refresh();
        });
    }, [refresh]);

    useEffect(() => {
        const supabase = createClient();
        let cancelled = false;

        void supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user || cancelled) return;

            const channel = supabase
                .channel(`friend-badge:${user.id}`)
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "friend_requests",
                        filter: `recipient_id=eq.${user.id}`,
                    },
                    () => {
                        void refresh();
                    }
                )
                .subscribe();

            channelRef.current = channel;
        });

        return () => {
            cancelled = true;
            const ch = channelRef.current;
            channelRef.current = null;
            if (ch) void supabase.removeChannel(ch);
        };
    }, [refresh]);

    if (count <= 0) return null;

    if (minimal) {
        return (
            <span
                className="absolute -top-0.5 -right-0.5 size-2 rounded-full shrink-0"
                style={{ backgroundColor: "#E02E2A" }}
                aria-label={`${count} pending friend requests`}
            />
        );
    }

    return (
        <span
            className={
                className ??
                "ml-auto min-w-[18px] h-[18px] px-[5px] rounded-full text-[10px] font-semibold flex items-center justify-center text-white shrink-0"
            }
            style={{
                fontFamily: "var(--font-inter)",
                backgroundColor: "#E02E2A",
            }}
            aria-label={`${count} pending friend requests`}
        >
            {count > 99 ? "99+" : count}
        </span>
    );
}
