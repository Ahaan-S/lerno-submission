"use client";
import React, { useState, useEffect, useRef } from "react";
import { Frown, Meh, Smile, CheckCircle2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface SessionRatingModalProps {
  open: boolean;
  sessionId: string | null;
  onClose: () => void;
}

const RATINGS = [
  { value: 1, Icon: Frown,  label: "Struggled",   activeColor: "#ef4444", activeBg: "#fef2f2", activeBorder: "#fca5a5" },
  { value: 2, Icon: Meh,    label: "It was okay",  activeColor: "#f59e0b", activeBg: "#fffbeb", activeBorder: "#fcd34d" },
  { value: 3, Icon: Smile,  label: "Loved it!",    activeColor: "#22c55e", activeBg: "#f0fdf4", activeBorder: "#86efac" },
] as const;

export default function SessionRatingModal({ open, sessionId, onClose }: SessionRatingModalProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open) handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const canSubmit = selected !== null && comment.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || !sessionId) return;
    setSubmitting(true);
    try {
      await fetch("/api/feedback/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, rating: selected, comment: comment.trim() }),
      });
    } catch {}
    setSubmitting(false);
    setDone(true);
    setTimeout(() => { setSelected(null); setComment(""); setDone(false); onClose(); }, 1800);
  };

  const handleClose = () => { setSelected(null); setComment(""); setDone(false); onClose(); };

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 backdrop-blur-[3px] px-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ backgroundColor: "white", boxShadow: "0 24px 64px rgba(15,23,42,0.14), 0 4px 16px rgba(15,23,42,0.06)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center gap-3 py-10 px-8"
            >
              <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--primary-10)" }}>
                <CheckCircle2 className="w-5 h-5" style={{ color: "var(--primary-400)" }} />
              </div>
              <p className="text-[15px] font-semibold" style={{ fontFamily: "var(--font-inter)", color: "var(--base-700)" }}>Thanks — that really helps!</p>
            </motion.div>
          ) : (
            <motion.div key="form" className="p-6 flex flex-col gap-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-bold" style={{ fontFamily: "var(--font-inter)", color: "var(--base-800)" }}>How was this session?</h2>
                  <p className="text-[13px] mt-0.5" style={{ fontFamily: "var(--font-inter)", color: "var(--base-400)" }}>Your feedback shapes your next one</p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer mt-0.5"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Rating faces */}
              <div className="flex gap-2">
                {RATINGS.map(({ value, Icon, label, activeColor, activeBg, activeBorder }) => {
                  const isActive = selected === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => { setSelected(value); setTimeout(() => textareaRef.current?.focus(), 50); }}
                      className="flex-1 flex flex-col items-center gap-2 py-3.5 rounded-2xl border-2 transition-all duration-150 cursor-pointer"
                      style={{ borderColor: isActive ? activeBorder : "#e2e8f0", backgroundColor: isActive ? activeBg : "#f8fafc" }}
                    >
                      <Icon
                        className="w-7 h-7 transition-all duration-150"
                        style={{ color: isActive ? activeColor : "#94a3b8" }}
                        strokeWidth={isActive ? 2.5 : 1.75}
                      />
                      <span
                        className="text-[12px] font-medium leading-tight text-center"
                        style={{ fontFamily: "var(--font-inter)", color: isActive ? activeColor : "#94a3b8" }}
                      >
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Mandatory text box — always visible */}
              <textarea
                ref={textareaRef}
                placeholder="Tell us more — what happened in this session?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full rounded-xl text-[13px] resize-none focus:outline-none transition-all leading-relaxed"
                style={{
                  fontFamily: "var(--font-inter)",
                  color: "var(--base-700)",
                  backgroundColor: "white",
                  border: "1.5px solid var(--base-200)",
                  padding: "10px 14px",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--primary-300)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--base-200)"; }}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSubmit(); }}
              />

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="h-10 px-5 rounded-full text-[13px] font-medium transition-colors cursor-pointer"
                  style={{ fontFamily: "var(--font-inter)", color: "var(--base-500)", backgroundColor: "var(--base-100)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--base-200)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--base-100)"; }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitting}
                  className="flex-1 h-10 rounded-full text-[13px] font-semibold text-white transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "var(--base-700)", fontFamily: "var(--font-inter)" }}
                  onMouseEnter={(e) => { if (!((e.currentTarget as HTMLButtonElement).disabled)) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--base-800)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--base-700)"; }}
                >
                  {submitting ? "Saving…" : "Submit"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
