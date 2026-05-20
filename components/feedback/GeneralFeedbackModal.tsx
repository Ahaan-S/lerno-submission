"use client";
import React, { useState, useEffect, useRef } from "react";
import { X, Bug, Lightbulb, CheckCircle2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type FeedbackType = "issue" | "suggestion";

interface GeneralFeedbackModalProps {
  open: boolean;
  grade?: string | null;
  onClose: () => void;
}

export default function GeneralFeedbackModal({ open, grade, onClose }: GeneralFeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>("issue");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && !done) setTimeout(() => textareaRef.current?.focus(), 120);
  }, [open, done]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open) handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!message.trim() || submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/feedback/general", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), type, grade: grade ?? undefined }),
      });
    } catch {}
    setSubmitting(false);
    setDone(true);
    setTimeout(() => { setMessage(""); setType("issue"); setDone(false); onClose(); }, 2000);
  };

  const handleClose = () => { setMessage(""); setType("issue"); setDone(false); onClose(); };

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 backdrop-blur-[3px] px-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.99 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[460px] rounded-2xl overflow-hidden"
        style={{ backgroundColor: "white", boxShadow: "0 24px 64px rgba(15,23,42,0.14), 0 4px 16px rgba(15,23,42,0.06)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center gap-3 py-12 px-8"
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "var(--primary-10)" }}
              >
                <CheckCircle2 className="w-5 h-5" style={{ color: "var(--primary-400)" }} />
              </div>
              <p className="text-[15px] font-semibold" style={{ fontFamily: "var(--font-inter)", color: "var(--base-700)" }}>
                Thanks — we got it!
              </p>
            </motion.div>
          ) : (
            <motion.div key="form" className="p-6 flex flex-col gap-4">

              {/* Header row */}
              <div className="flex items-center justify-between">
                <h2
                  className="text-[20px] font-bold leading-tight"
                  style={{ fontFamily: "var(--font-inter)", color: "var(--base-800)" }}
                >
                  Help us improve
                </h2>
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-1.5 rounded-lg transition-colors cursor-pointer"
                  style={{ color: "var(--base-400)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--base-200)"; (e.currentTarget as HTMLElement).style.color = "var(--base-600)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--base-400)"; }}
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Type toggle */}
              <div className="flex gap-2">
                {([
                  { value: "issue" as FeedbackType, Icon: Bug, label: "Report an issue" },
                  { value: "suggestion" as FeedbackType, Icon: Lightbulb, label: "Give a suggestion" },
                ]).map(({ value, Icon, label }) => {
                  const active = type === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setType(value)}
                      className="flex-1 flex items-center justify-center gap-2 h-11 rounded-full text-[13px] font-semibold transition-all duration-150 cursor-pointer"
                      style={{
                        fontFamily: "var(--font-inter)",
                        backgroundColor: active ? "var(--primary-10)" : "var(--base-100)",
                        color: active ? "var(--primary-500)" : "var(--base-500)",
                        border: active ? "1.5px solid var(--primary-200)" : "1.5px solid transparent",
                      }}
                    >
                      <Icon className="w-[15px] h-[15px] shrink-0" />
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Text area */}
              <textarea
                ref={textareaRef}
                placeholder={type === "issue" ? "Describe what happened and what you expected…" : "What would make Lerno better for you?"}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={1000}
                className="w-full rounded-xl text-[14px] resize-none focus:outline-none transition-all leading-relaxed"
                style={{
                  fontFamily: "var(--font-inter)",
                  color: "var(--base-700)",
                  backgroundColor: "white",
                  border: "1.5px solid var(--base-200)",
                  padding: "12px 14px",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--primary-300)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--base-200)"; }}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSubmit(); }}
              />

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="h-10 px-5 rounded-full text-[13px] font-medium transition-colors cursor-pointer"
                  style={{
                    fontFamily: "var(--font-inter)",
                    color: "var(--base-500)",
                    backgroundColor: "var(--base-100)",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--base-200)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--base-100)"; }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!message.trim() || submitting}
                  className="h-10 px-6 rounded-full text-[13px] font-semibold text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ fontFamily: "var(--font-inter)", backgroundColor: "var(--primary-400)" }}
                  onMouseEnter={(e) => { if (!((e.currentTarget as HTMLButtonElement).disabled)) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--primary-500)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--primary-400)"; }}
                >
                  {submitting ? "Sending…" : "Submit"}
                </button>
                <span
                  className="ml-auto text-[11px] hidden sm:block"
                  style={{ fontFamily: "var(--font-inter)", color: "var(--base-300)" }}
                >
                  ⌘↵
                </span>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
