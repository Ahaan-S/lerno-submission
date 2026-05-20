"use client";

import { useCallback, useState } from "react";

type Relationship = "none" | "friends" | "request_sent" | "request_received";

export function SendFriendRequestButton({
    targetUserId,
    allowFriendRequests = true,
    initialRelationship = "none",
    compact,
    onSent,
}: {
    targetUserId: string;
    allowFriendRequests?: boolean;
    initialRelationship?: Relationship;
    compact?: boolean;
    /** Called after a request is sent successfully */
    onSent?: () => void;
}) {
    const [relationship, setRelationship] = useState<Relationship>(initialRelationship);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const send = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/friends/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ recipientId: targetUserId }),
            });
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                setError(data.error ?? "Could not send request");
                return;
            }
            setRelationship("request_sent");
            onSent?.();
        } catch {
            setError("Network error");
        } finally {
            setLoading(false);
        }
    }, [targetUserId, onSent]);

    if (!allowFriendRequests) {
        return (
            <span
                className="text-[12px] text-[var(--base-500)]"
                style={{ fontFamily: "var(--font-inter)" }}
            >
                Not accepting requests
            </span>
        );
    }

    if (relationship === "friends") {
        return (
            <span
                className="text-[12px] font-medium text-[var(--base-600)]"
                style={{ fontFamily: "var(--font-inter)" }}
            >
                Friends
            </span>
        );
    }

    if (relationship === "request_sent") {
        return (
            <span
                className="text-[12px] font-medium text-[var(--base-500)]"
                style={{ fontFamily: "var(--font-inter)" }}
            >
                Request sent
            </span>
        );
    }

    if (relationship === "request_received") {
        return (
            <span
                className="text-[12px] text-[var(--base-500)]"
                style={{ fontFamily: "var(--font-inter)" }}
            >
                Sent you a request
            </span>
        );
    }

    return (
        <div className="flex flex-col items-start gap-1">
            <button
                type="button"
                onClick={() => void send()}
                disabled={loading}
                className={
                    compact
                        ? "px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--primary-400)] text-white hover:opacity-90 disabled:opacity-50 cursor-pointer transition-opacity"
                        : "px-4 py-2 rounded-xl text-[14px] font-medium bg-[var(--primary-400)] text-white hover:opacity-90 disabled:opacity-50 cursor-pointer transition-opacity"
                }
                style={{ fontFamily: "var(--font-inter)" }}
            >
                {loading ? "Sending…" : "Add friend"}
            </button>
            {error && (
                <p className="text-[11px] text-[#E02E2A]" style={{ fontFamily: "var(--font-inter)" }}>
                    {error}
                </p>
            )}
        </div>
    );
}
