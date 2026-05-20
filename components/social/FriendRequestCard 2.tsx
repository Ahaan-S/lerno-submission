"use client";

import { useCallback, useState } from "react";

export type IncomingRequest = {
    id: string;
    message: string | null;
    createdAt: string;
    sender: { id: string; fullName: string | null; email: string | null; grade: string | number | null } | null;
};

export function FriendRequestCard({
    request,
    onChanged,
}: {
    request: IncomingRequest;
    onChanged: () => void;
}) {
    const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
    const label = request.sender?.fullName?.trim() || "Someone";

    const act = useCallback(
        async (action: "accept" | "decline") => {
            setBusy(action);
            try {
                const url =
                    action === "accept"
                        ? `/api/friends/requests/${request.id}/accept`
                        : `/api/friends/requests/${request.id}/decline`;
                const res = await fetch(url, { method: "POST", credentials: "include" });
                if (res.ok) onChanged();
            } finally {
                setBusy(null);
            }
        },
        [request.id, onChanged]
    );

    return (
        <div
            className="group flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-[var(--base-100)] transition-colors"
            style={{ fontFamily: "var(--font-inter)" }}
        >
            {/* Avatar with status dot */}
            <div className="relative shrink-0">
                <div className="size-9 rounded-full bg-[var(--base-100)] border border-[var(--base-200)] flex items-center justify-center text-base leading-none">
                    🙂
                </div>
                <div
                    className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-white"
                    style={{ backgroundColor: "var(--base-300)" }}
                />
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-[var(--base-800)] truncate leading-tight">
                    {label}
                </p>
                <p className="text-[12px] text-[var(--base-400)] leading-tight">
                    {request.sender?.grade != null
                        ? `Grade ${String(request.sender.grade)} · Incoming Request`
                        : "Incoming Friend Request"}
                </p>
                {request.message && (
                    <p className="text-[12px] text-[var(--base-600)] mt-0.5 truncate italic">
                        &ldquo;{request.message}&rdquo;
                    </p>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 opacity-100 transition-opacity">
                <button
                    type="button"
                    onClick={() => void act("accept")}
                    disabled={busy !== null}
                    title="Accept"
                    aria-label="Accept friend request"
                    className="size-9 rounded-full flex items-center justify-center text-[var(--primary-400)] hover:bg-[var(--primary-400)] hover:text-white cursor-pointer disabled:opacity-50 transition-all"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-[18px] h-[18px]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                </button>
                <button
                    type="button"
                    onClick={() => void act("decline")}
                    disabled={busy !== null}
                    title="Decline"
                    aria-label="Decline friend request"
                    className="size-9 rounded-full flex items-center justify-center text-[var(--base-500)] hover:bg-[var(--red-10)] hover:text-[var(--red-100)] cursor-pointer disabled:opacity-50 transition-all"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-[18px] h-[18px]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
