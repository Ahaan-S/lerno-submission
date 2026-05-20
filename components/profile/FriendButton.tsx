"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ProfileRelationship } from "@/lib/profile-viewer-relationship";

const transition =
  "transition-[background-color,border-color,box-shadow,transform,opacity,color] duration-200 ease-out";

export function FriendButton({
  targetUserId,
  relationship,
  relationshipMeta,
  compact,
  onChanged,
}: {
  targetUserId: string;
  relationship: ProfileRelationship;
  relationshipMeta?: { incoming_request_id?: string | null; outgoing_request_id?: string | null };
  compact?: boolean;
  onChanged?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [unfriendConfirm, setUnfriendConfirm] = useState(false);

  useEffect(() => {
    if (relationship !== "friends") setUnfriendConfirm(false);
  }, [relationship]);

  useEffect(() => {
    if (!unfriendConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUnfriendConfirm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [unfriendConfirm]);

  const baseBtn =
    compact
      ? `px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${transition}`
      : `px-3 py-1.5 rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${transition}`;

  const sendRequest = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recipientId: targetUserId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Could not send");
        return;
      }
      onChanged?.();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }, [targetUserId, onChanged]);

  const cancelOutgoing = useCallback(async () => {
    const id = relationshipMeta?.outgoing_request_id;
    if (!id) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/friends/requests/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) onChanged?.();
      else setErr("Could not cancel");
    } finally {
      setBusy(false);
    }
  }, [relationshipMeta?.outgoing_request_id, onChanged]);

  const accept = useCallback(async () => {
    const id = relationshipMeta?.incoming_request_id;
    if (!id) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/friends/requests/${id}/accept`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) onChanged?.();
      else setErr("Could not accept");
    } finally {
      setBusy(false);
    }
  }, [relationshipMeta?.incoming_request_id, onChanged]);

  const decline = useCallback(async () => {
    const id = relationshipMeta?.incoming_request_id;
    if (!id) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/friends/requests/${id}/decline`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) onChanged?.();
      else setErr("Could not decline");
    } finally {
      setBusy(false);
    }
  }, [relationshipMeta?.incoming_request_id, onChanged]);

  const unfriend = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/friends/${targetUserId}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        setUnfriendConfirm(false);
        onChanged?.();
      } else setErr("Could not unfriend");
    } finally {
      setBusy(false);
    }
  }, [targetUserId, onChanged]);

  if (relationship === "self") {
    return (
      <Link
        href="/settings/profile"
        className={`${baseBtn} border border-[color-mix(in_srgb,var(--physics)_25%,var(--base-200))] bg-white text-[var(--base-700)] shadow-sm hover:bg-[color-mix(in_srgb,var(--physics)_10%,white)] hover:border-[color-mix(in_srgb,var(--physics)_40%,var(--base-200))] hover:shadow-[0_6px_20px_-6px_rgba(99,102,241,0.22)] hover:-translate-y-px`}
        style={{ fontFamily: "var(--font-inter)" }}
      >
        Edit profile
      </Link>
    );
  }

  if (relationship === "friends") {
    const unfriendIdleBtnClass = `${baseBtn} border border-[color-mix(in_srgb,var(--chemistry)_28%,var(--base-200))] bg-white text-[color-mix(in_srgb,var(--chemistry)_38%,var(--base-800))] shadow-sm hover:bg-[color-mix(in_srgb,var(--chemistry)_10%,white)] hover:border-[color-mix(in_srgb,var(--chemistry)_45%,var(--base-200))] hover:text-[color-mix(in_srgb,var(--chemistry)_55%,var(--base-900))] hover:shadow-[0_8px_22px_-6px_rgba(236,72,153,0.2)] hover:-translate-y-px`;

    return (
      <div className="relative shrink-0 self-start" style={{ fontFamily: "var(--font-inter)" }}>
        {!unfriendConfirm ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setUnfriendConfirm(true)}
            className={unfriendIdleBtnClass}
          >
            Unfriend
          </button>
        ) : (
          <>
            <button
              type="button"
              tabIndex={-1}
              aria-hidden
              className={`${unfriendIdleBtnClass} invisible pointer-events-none`}
            >
              Unfriend
            </button>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="unfriend-confirm-title"
              className={`absolute right-0 top-full z-[100] mt-2 rounded-xl border border-[var(--base-200)] bg-white p-3 shadow-[0_16px_48px_-8px_rgba(15,23,42,0.2)] ${compact ? "w-[200px]" : "w-[min(calc(100vw-2.5rem),17rem)]"}`}
            >
              <p id="unfriend-confirm-title" className="text-[12px] text-[var(--base-600)] leading-snug mb-2.5">
                Remove this person from your friends? This cannot be undone.
              </p>
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setUnfriendConfirm(false)}
                  className={`${baseBtn} border border-[color-mix(in_srgb,var(--science)_28%,var(--base-200))] bg-white text-[var(--base-700)] shadow-sm hover:bg-[color-mix(in_srgb,var(--science)_10%,white)] hover:border-[color-mix(in_srgb,var(--science)_42%,var(--base-200))] hover:shadow-[0_6px_18px_-6px_rgba(59,130,246,0.18)] hover:-translate-y-px`}
                >
                  Never mind
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void unfriend()}
                  className={`${baseBtn} border border-[color-mix(in_srgb,var(--social-history)_45%,transparent)] bg-[color-mix(in_srgb,var(--social-history)_12%,white)] text-[color-mix(in_srgb,var(--social-history)_55%,var(--base-900))] shadow-sm hover:bg-[color-mix(in_srgb,var(--social-history)_18%,white)] hover:border-[color-mix(in_srgb,var(--social-history)_55%,transparent)] hover:shadow-[0_8px_22px_-6px_rgba(239,68,68,0.2)] hover:-translate-y-px`}
                >
                  {busy ? "…" : "Remove friend"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  if (relationship === "pending_outgoing") {
    return (
      <button
        type="button"
        disabled={busy || !relationshipMeta?.outgoing_request_id}
        onClick={() => void cancelOutgoing()}
        className={`${baseBtn} border border-[color-mix(in_srgb,var(--science)_30%,var(--base-200))] bg-white text-[var(--base-700)] shadow-sm hover:bg-[color-mix(in_srgb,var(--science)_11%,white)] hover:border-[color-mix(in_srgb,var(--science)_48%,var(--base-200))] hover:text-[color-mix(in_srgb,var(--science)_25%,var(--base-900))] hover:shadow-[0_8px_22px_-6px_rgba(59,130,246,0.22)] hover:-translate-y-px`}
        style={{ fontFamily: "var(--font-inter)" }}
      >
        {busy ? "…" : "Cancel request"}
      </button>
    );
  }

  if (relationship === "pending_incoming") {
    return (
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={busy || !relationshipMeta?.incoming_request_id}
          onClick={() => void accept()}
          className={`${baseBtn} bg-[var(--primary-400)] text-white shadow-sm hover:bg-[color-mix(in_srgb,white_14%,var(--primary-400))] hover:shadow-[0_8px_26px_-6px_rgba(0,119,237,0.45)] hover:-translate-y-px`}
          style={{ fontFamily: "var(--font-inter)" }}
        >
          Accept
        </button>
        <button
          type="button"
          disabled={busy || !relationshipMeta?.incoming_request_id}
          onClick={() => void decline()}
          className={`${baseBtn} border border-[color-mix(in_srgb,var(--math)_30%,var(--base-200))] bg-white text-[var(--base-700)] shadow-sm hover:bg-[color-mix(in_srgb,var(--math)_10%,white)] hover:border-[color-mix(in_srgb,var(--math)_48%,var(--base-200))] hover:shadow-[0_6px_20px_-6px_rgba(139,92,246,0.2)] hover:-translate-y-px`}
          style={{ fontFamily: "var(--font-inter)" }}
        >
          Decline
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      <button
        type="button"
        disabled={busy}
        onClick={() => void sendRequest()}
        className={`${baseBtn} bg-[var(--primary-400)] text-white shadow-sm hover:bg-[color-mix(in_srgb,white_12%,var(--primary-400))] hover:shadow-[0_10px_28px_-6px_rgba(0,119,237,0.42),0_0_0_1px_color-mix(in_srgb,var(--physics)_35%,transparent)] hover:-translate-y-px`}
        style={{ fontFamily: "var(--font-inter)" }}
      >
        {busy ? "…" : "Add friend"}
      </button>
      {err && (
        <span
          className="text-[10px] text-[var(--red-100)] max-w-[200px] leading-tight"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          {err}
        </span>
      )}
    </div>
  );
}
