"use client";

import { useCallback, useEffect, useState } from "react";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { SendFriendRequestButton } from "@/components/social/SendFriendRequestButton";

type SearchUser = {
    id: string;
    displayName: string;
    fullName: string | null;
    grade: string | number | null;
    avatarUrl: string | null;
    allowFriendRequests: boolean;
};

export function UserSearchModal({
    open,
    onClose,
    onFriendListChanged,
}: {
    open: boolean;
    onClose: () => void;
    /** Refresh friends / requests lists after sending a request */
    onFriendListChanged?: () => void;
}) {
    const [q, setQ] = useState("");
    const [debounced, setDebounced] = useState("");
    const [users, setUsers] = useState<SearchUser[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setDebounced(q.trim()), 300);
        return () => clearTimeout(t);
    }, [q]);

    const runSearch = useCallback(async () => {
        if (debounced.length < 2) {
            setUsers([]);
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(
                `/api/users/search?q=${encodeURIComponent(debounced)}`,
                { credentials: "include" }
            );
            const data = (await res.json()) as { users?: SearchUser[] };
            setUsers(data.users ?? []);
        } catch {
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, [debounced]);

    useEffect(() => {
        if (open) void runSearch();
    }, [open, runSearch]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4 bg-black/30"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[min(70vh,520px)] flex flex-col overflow-hidden border border-[var(--base-200)]"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal
                aria-label="Find people"
            >
                <div className="p-4 border-b border-[var(--base-200)] shrink-0">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <h2
                            className="text-[16px] font-semibold text-[var(--base-800)]"
                            style={{ fontFamily: "var(--font-inter)" }}
                        >
                            Find people
                        </h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-[13px] text-[var(--base-500)] hover:text-[var(--base-800)] px-2 py-1 cursor-pointer"
                            style={{ fontFamily: "var(--font-inter)" }}
                        >
                            Close
                        </button>
                    </div>
                    <input
                        autoFocus
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search by name…"
                        className="w-full border border-[var(--base-200)] rounded-xl px-3 py-2.5 text-[14px] outline-none focus:border-[var(--base-400)]"
                        style={{ fontFamily: "var(--font-inter)" }}
                    />
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {loading && <p className="text-[13px] text-[var(--base-500)] px-1">Searching…</p>}
                    {!loading && debounced.length >= 2 && users.length === 0 && (
                        <p className="text-[13px] text-[var(--base-500)] px-1">No users found.</p>
                    )}
                    {debounced.length < 2 && (
                        <p className="text-[13px] text-[var(--base-500)] px-1">Type at least 2 characters.</p>
                    )}
                    {users.map((u) => (
                        <div
                            key={u.id}
                            className="flex items-center gap-3 p-3 rounded-xl border border-[var(--base-100)] bg-[#fafafa]"
                        >
                            <div className="size-10 shrink-0 overflow-hidden rounded-full border border-[var(--base-200)] bg-white">
                                <ProfileAvatar
                                    avatarUrl={u.avatarUrl}
                                    displayName={u.displayName}
                                    fullName={u.fullName}
                                    size={40}
                                    className="!border-0 rounded-none"
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p
                                    className="text-[14px] font-medium text-[var(--base-800)] truncate"
                                    style={{ fontFamily: "var(--font-inter)" }}
                                >
                                    {u.displayName}
                                </p>
                                {u.grade != null && (
                                    <p className="text-[11px] text-[var(--base-500)]">Grade {String(u.grade)}</p>
                                )}
                            </div>
                            <SendFriendRequestButton
                                targetUserId={u.id}
                                allowFriendRequests={u.allowFriendRequests}
                                compact
                                onSent={onFriendListChanged}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
