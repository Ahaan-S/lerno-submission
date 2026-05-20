"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Link2, X, Loader2 } from "lucide-react";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import type { FriendRow } from "@/components/social/FriendCard";
import { track } from "@/lib/analytics";
import { buildExternalShareUrl } from "@/lib/social/build-external-share-url";

export function FriendPickerModal({
    open,
    onClose,
    shareKind,
    resourceId,
}: {
    open: boolean;
    onClose: () => void;
    shareKind: "question" | "session";
    resourceId: string;
}) {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    const [friends, setFriends] = useState<FriendRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [q, setQ] = useState("");
    const [note, setNote] = useState("");
    const [sending, setSending] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [sessionShareToken, setSessionShareToken] = useState<string | null>(null);
    const [shareLinkLoading, setShareLinkLoading] = useState(false);
    const [shareLinkError, setShareLinkError] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const externalShareUrl = useMemo(() => {
        if (typeof window === "undefined") return "";
        return buildExternalShareUrl({
            origin: window.location.origin,
            pathname,
            shareKind,
            resourceId,
            sessionShareToken: shareKind === "session" ? sessionShareToken : null,
        });
    }, [pathname, shareKind, resourceId, sessionShareToken]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/friends", { credentials: "include" });
            const data = (await res.json()) as { friends?: FriendRow[] };
            if (!res.ok) {
                setError("Could not load friends");
                setFriends([]);
                return;
            }
            setFriends(data.friends ?? []);
        } catch {
            setError("Network error");
            setFriends([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (open) {
            setQ("");
            setNote("");
            setError(null);
            setCopied(false);
            setSessionShareToken(null);
            setShareLinkError(null);
            void load();
        }
    }, [open, load]);

    useEffect(() => {
        if (!open || shareKind !== "session") return;
        let cancelled = false;
        setShareLinkLoading(true);
        setShareLinkError(null);
        void (async () => {
            try {
                const res = await fetch("/api/tutor/share-link", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ session_id: resourceId }),
                });
                const data = (await res.json().catch(() => ({}))) as { share_token?: string; error?: string };
                if (cancelled) return;
                if (!res.ok) {
                    setShareLinkError(data.error ?? "Could not create link");
                    setSessionShareToken(null);
                    return;
                }
                if (data.share_token) {
                    setSessionShareToken(data.share_token);
                }
            } catch {
                if (!cancelled) {
                    setShareLinkError("Network error");
                    setSessionShareToken(null);
                }
            } finally {
                if (!cancelled) setShareLinkLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, shareKind, resourceId]);

    const copyLink = useCallback(async () => {
        if (!externalShareUrl || (shareKind === "session" && shareLinkLoading)) return;
        try {
            await navigator.clipboard.writeText(externalShareUrl);
            setCopied(true);
            track("content_shared", { kind: shareKind, channel: "external_link_copy" });
            window.setTimeout(() => setCopied(false), 2200);
        } catch {
            setError("Could not copy — try selecting the link manually.");
        }
    }, [externalShareUrl, shareKind, shareLinkLoading]);

    const filtered = useMemo(() => {
        const t = q.trim().toLowerCase();
        if (!t) return friends;
        return friends.filter(
            (f) =>
                f.displayName.toLowerCase().includes(t) ||
                (f.fullName && f.fullName.toLowerCase().includes(t))
        );
    }, [friends, q]);

    const send = useCallback(
        async (recipientId: string) => {
            setSending(recipientId);
            setError(null);
            const url =
                shareKind === "question"
                    ? "/api/friends/share/question"
                    : "/api/friends/share/session";
            const body =
                shareKind === "question"
                    ? { questionId: resourceId, recipientId, note: note || undefined }
                    : { sessionId: resourceId, recipientId, note: note || undefined };
            try {
                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(body),
                });
                const data = (await res.json().catch(() => ({}))) as { error?: string };
                if (!res.ok) {
                    setError(data.error ?? "Send failed");
                    return;
                }
                track("content_shared", { kind: shareKind, recipient_id: recipientId, channel: "dm" });
                onClose();
            } catch {
                setError("Network error");
            } finally {
                setSending(null);
            }
        },
        [shareKind, resourceId, note, onClose]
    );

    const linkReady = !(shareKind === "session" && shareLinkLoading);
    const showUrl = externalShareUrl && linkReady && !shareLinkError;

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    key="share-modal-root"
                    className="fixed inset-0 z-[10040] flex items-center justify-center p-4 sm:p-6 overflow-y-auto overscroll-contain"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    role="presentation"
                >
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/30 backdrop-blur-[2px] cursor-default"
                        aria-label="Close share"
                        onClick={onClose}
                    />
                    <motion.div
                        role="dialog"
                        aria-modal
                        aria-labelledby="share-modal-title"
                        initial={{ opacity: 0, scale: 0.97, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: 10 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="relative w-full max-w-[440px] max-h-[min(82vh,600px)] flex flex-col rounded-2xl border border-[var(--base-200)] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.14)] overflow-hidden"
                        style={{ fontFamily: "var(--font-inter)" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-[var(--base-100)] bg-white">
                            <div className="min-w-0">
                                <h2
                                    id="share-modal-title"
                                    className="text-[18px] font-semibold text-[var(--base-900)] tracking-tight"
                                >
                                    Share
                                </h2>
                                <p className="text-[13px] text-[var(--base-500)] mt-1 leading-snug">
                                    Copy a link or send to friends on Lerno.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="shrink-0 p-2 rounded-xl text-[var(--base-400)] hover:bg-[var(--base-100)] hover:text-[var(--base-700)] transition-colors cursor-pointer"
                                aria-label="Close"
                            >
                                <X className="w-5 h-5" strokeWidth={2} />
                            </button>
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-5 bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)]">
                            {/* Copy link — URL only */}
                            <section className="space-y-2.5">
                                <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--base-600)]">
                                    <Link2 className="w-3.5 h-3.5 text-[var(--primary-400)] shrink-0" strokeWidth={2} />
                                    <span>Link</span>
                                </div>
                                <div className="flex gap-2 min-w-0">
                                    <div className="relative flex-1 min-w-0">
                                        <input
                                            readOnly
                                            value={showUrl ? externalShareUrl : ""}
                                            placeholder={
                                                shareKind === "session" && shareLinkLoading
                                                    ? "Preparing link…"
                                                    : "Link unavailable"
                                            }
                                            className="w-full min-w-0 rounded-xl border border-[var(--base-200)] bg-white px-3.5 py-2.5 text-[13px] font-mono text-[var(--base-800)] outline-none ring-0 focus:border-[var(--primary-400)] focus:ring-2 focus:ring-[var(--primary-400)]/20 transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--base-400)] placeholder:font-sans"
                                            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
                                            onFocus={(e) => e.target.select()}
                                        />
                                        {shareKind === "session" && shareLinkLoading && (
                                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                                                <Loader2 className="w-4 h-4 animate-spin text-[var(--base-400)]" />
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => void copyLink()}
                                        disabled={!showUrl || (shareKind === "session" && (!!shareLinkError || shareLinkLoading))}
                                        className="shrink-0 px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-[var(--primary-400)] text-white hover:opacity-[0.96] active:scale-[0.98] cursor-pointer transition-all duration-200 disabled:opacity-45 disabled:cursor-not-allowed disabled:active:scale-100"
                                    >
                                        {shareKind === "session" && shareLinkLoading
                                            ? "…"
                                            : copied
                                              ? "Copied"
                                              : "Copy"}
                                    </button>
                                </div>
                                {shareKind === "session" && shareLinkError && (
                                    <p className="text-[12px] text-[#E02E2A] leading-snug">{shareLinkError}</p>
                                )}
                                <p className="text-[12px] text-[var(--base-500)] leading-relaxed">
                                    {shareKind === "session"
                                        ? "Recipients signed in to Lerno can read this chat. Their first reply saves a copy in their own history."
                                        : "Recipients need a Lerno account to open this link."}
                                </p>
                            </section>

                            {/* Note + search */}
                            <section className="space-y-3">
                                <label className="block text-[12px] font-medium text-[var(--base-600)]">
                                    Message to friends
                                </label>
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value.slice(0, 300))}
                                    placeholder="Optional note (max 300 characters)"
                                    rows={2}
                                    className="w-full rounded-xl border border-[var(--base-200)] bg-white px-3.5 py-2.5 text-[13px] text-[var(--base-800)] outline-none resize-none transition-[border-color,box-shadow] duration-200 focus:border-[var(--primary-400)] focus:ring-2 focus:ring-[var(--primary-400)]/20 placeholder:text-[var(--base-400)]"
                                />
                                <input
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Search friends"
                                    className="w-full rounded-xl border border-[var(--base-200)] bg-white px-3.5 py-2.5 text-[14px] text-[var(--base-800)] outline-none transition-[border-color,box-shadow] duration-200 focus:border-[var(--primary-400)] focus:ring-2 focus:ring-[var(--primary-400)]/20 placeholder:text-[var(--base-400)]"
                                />
                            </section>

                            {loading && (
                                <p className="text-[13px] text-[var(--base-500)] py-1">Loading friends…</p>
                            )}
                            {error && (
                                <p className="text-[13px] text-[#E02E2A] py-1">{error}</p>
                            )}
                            {!loading && filtered.length === 0 && (
                                <p className="text-[13px] text-[var(--base-500)] py-2">
                                    {friends.length === 0
                                        ? "Add friends first to share inside Lerno."
                                        : "No matches."}
                                </p>
                            )}
                            {filtered.length > 0 && (
                                <ul className="rounded-xl border border-[var(--base-200)] bg-white overflow-hidden divide-y divide-[var(--base-100)] shadow-sm">
                                    {filtered.map((f) => (
                                        <li key={f.userId}>
                                            <button
                                                type="button"
                                                disabled={sending !== null}
                                                onClick={() => void send(f.userId)}
                                                className="w-full flex items-center gap-3 px-3 py-3 text-left cursor-pointer disabled:opacity-50 hover:bg-[var(--base-50)] transition-colors duration-150"
                                            >
                                                <span className="size-10 shrink-0 overflow-hidden rounded-full border border-[var(--primary-400)]/25 bg-[var(--primary-400)]/10">
                                                    <ProfileAvatar
                                                        avatarUrl={f.avatarUrl}
                                                        displayName={f.displayName}
                                                        fullName={f.fullName}
                                                        size={40}
                                                        className="!border-0 rounded-none"
                                                    />
                                                </span>
                                                <span className="flex-1 min-w-0">
                                                    <span className="block text-[15px] font-medium text-[var(--base-800)] truncate">
                                                        {f.displayName}
                                                    </span>
                                                    {f.grade != null && (
                                                        <span className="text-[12px] text-[var(--base-500)]">
                                                            Grade {String(f.grade)}
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="text-[13px] font-semibold text-[var(--primary-400)] shrink-0 tabular-nums">
                                                    {sending === f.userId ? "Sending…" : "Send"}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
