"use client";
import React, { useState, useRef } from "react";
import { Bug, Lightbulb, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type FeedbackType = "issue" | "suggestion";

interface FeedbackPageProps {
  name: string;
  email: string;
  grade: string | null;
}

export default function FeedbackPage({ name, email, grade }: FeedbackPageProps) {
  const [type, setType] = useState<FeedbackType>("issue");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/feedback/general", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), type, grade }),
      });
      setDone(true);
    } catch {
      setSubmitting(false);
    }
  };

  const switchType = (t: FeedbackType) => {
    setType(t);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const interStyle = { fontFamily: "var(--font-inter)" };

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ backgroundColor: "#fafafa" }}
    >
      {/* Outer centering shell */}
      <div className="min-h-full flex items-start justify-center px-4 py-8 sm:py-12 sm:px-6">
        {/* Card — shadow on desktop, flat on mobile */}
        <div className="w-full max-w-[520px]">
          <AnimatePresence mode="wait">
            {done ? (
              /* ── Success state ── */
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center text-center gap-5 py-16 px-6"
              >
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.06, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: "var(--primary-10)" }}
                >
                  <CheckCircle2 className="w-8 h-8" style={{ color: "var(--primary-400)" }} />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.14, duration: 0.2 }}
                >
                  <p className="text-[22px] font-bold" style={{ ...interStyle, color: "var(--base-800)" }}>
                    Thanks — got it!
                  </p>
                  <p className="text-[14px] mt-2 leading-relaxed max-w-[300px] mx-auto" style={{ ...interStyle, color: "var(--base-400)" }}>
                    We read every message and use it to make Lerno better.
                  </p>
                </motion.div>

                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.22 }}
                  type="button"
                  onClick={() => { setDone(false); setMessage(""); setType("issue"); }}
                  className="h-9 px-5 rounded-full text-[13px] font-medium cursor-pointer transition-colors"
                  style={{ ...interStyle, backgroundColor: "var(--base-100)", color: "var(--base-500)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--base-200)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--base-100)"; }}
                >
                  Send another
                </motion.button>
              </motion.div>
            ) : (
              /* ── Form ── */
              <motion.form
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                onSubmit={handleSubmit}
                className="flex flex-col gap-0"
              >
                {/* White card */}
                <div
                  className="rounded-2xl sm:rounded-3xl overflow-hidden"
                  style={{
                    backgroundColor: "white",
                    border: "1px solid var(--base-200)",
                    boxShadow: "0 2px 12px rgba(15,23,42,0.05)",
                  }}
                >
                  {/* Header strip */}
                  <div
                    className="px-5 sm:px-7 pt-6 sm:pt-7 pb-5 sm:pb-6"
                    style={{ borderBottom: "1px solid var(--base-200)" }}
                  >
                    <h1
                      className="text-[21px] sm:text-[24px] font-bold leading-tight"
                      style={{ ...interStyle, color: "var(--base-800)" }}
                    >
                      Help us improve
                    </h1>
                    <p
                      className="text-[13px] sm:text-[14px] mt-1"
                      style={{ ...interStyle, color: "var(--base-400)" }}
                    >
                      We read every message.
                    </p>
                  </div>

                  {/* Body */}
                  <div className="px-5 sm:px-7 py-5 sm:py-6 flex flex-col gap-5">

                    {/* Type toggle */}
                    <div
                      className="flex rounded-xl p-1 gap-1"
                      style={{ backgroundColor: "var(--base-100)" }}
                    >
                      {([
                        { value: "issue" as FeedbackType, Icon: Bug, label: "Report an issue" },
                        { value: "suggestion" as FeedbackType, Icon: Lightbulb, label: "Give a suggestion" },
                      ] as const).map(({ value, Icon, label }) => {
                        const active = type === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => switchType(value)}
                            className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-[13px] font-medium cursor-pointer transition-all duration-200"
                            style={{
                              ...interStyle,
                              backgroundColor: active ? "white" : "transparent",
                              color: active ? "var(--base-700)" : "var(--base-400)",
                              boxShadow: active ? "0 1px 4px rgba(15,23,42,0.08)" : "none",
                            }}
                          >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="hidden xs:inline sm:inline">{label}</span>
                            <span className="xs:hidden sm:hidden">{value === "issue" ? "Issue" : "Suggestion"}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Textarea */}
                    <div className="flex flex-col gap-1.5">
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={type}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.12 }}
                          className="text-[13px] font-medium"
                          style={{ ...interStyle, color: "var(--base-600)" }}
                        >
                          {type === "issue" ? "Describe what's not working" : "Share your idea"}
                        </motion.p>
                      </AnimatePresence>

                      <textarea
                        ref={textareaRef}
                        placeholder={
                          type === "issue"
                            ? "What happened? What did you expect instead?"
                            : "What would make Lerno better for you?"
                        }
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={5}
                        maxLength={2000}
                        autoFocus
                        required
                        className="w-full rounded-xl text-[14px] resize-none focus:outline-none transition-all duration-150 leading-relaxed"
                        style={{
                          ...interStyle,
                          color: "var(--base-700)",
                          backgroundColor: "var(--base-100)",
                          border: "1.5px solid transparent",
                          padding: "12px 14px",
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.backgroundColor = "white";
                          e.currentTarget.style.borderColor = "var(--primary-200)";
                          e.currentTarget.style.boxShadow = "0 0 0 3px var(--primary-10)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.backgroundColor = "var(--base-100)";
                          e.currentTarget.style.borderColor = "transparent";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                        onKeyDown={(e) => {
                          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") e.currentTarget.form?.requestSubmit();
                        }}
                      />

                      {/* Bottom hint row */}
                      <div className="flex items-center justify-between px-0.5">
                        <span className="text-[11px] hidden sm:block" style={{ ...interStyle, color: "var(--base-300)" }}>
                          ⌘↵ to submit
                        </span>
                        <span
                          className="text-[11px] ml-auto"
                          style={{ ...interStyle, color: message.length > 1800 ? "var(--red-100)" : "var(--base-300)" }}
                        >
                          {message.length}/2000
                        </span>
                      </div>
                    </div>

                    {/* Submitting as */}
                    <div
                      className="flex items-center gap-3 rounded-xl px-3.5 py-2.5"
                      style={{ backgroundColor: "var(--base-100)" }}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[12px] font-bold shrink-0"
                        style={{ backgroundColor: "var(--primary-400)" }}
                      >
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium truncate" style={{ ...interStyle, color: "var(--base-700)" }}>
                          {name}
                        </p>
                        <p className="text-[11px] truncate" style={{ ...interStyle, color: "var(--base-400)" }}>
                          {email}{grade ? ` · Grade ${grade}` : ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Footer / submit */}
                  <div
                    className="px-5 sm:px-7 py-4 sm:py-5 flex items-center gap-3"
                    style={{ borderTop: "1px solid var(--base-200)", backgroundColor: "var(--base-100)" }}
                  >
                    <button
                      type="submit"
                      disabled={!message.trim() || submitting}
                      className="flex-1 sm:flex-none sm:w-auto h-10 px-7 rounded-full text-[13px] font-semibold text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ ...interStyle, backgroundColor: "var(--primary-400)" }}
                      onMouseEnter={(e) => {
                        if (!(e.currentTarget as HTMLButtonElement).disabled)
                          (e.currentTarget as HTMLElement).style.backgroundColor = "var(--primary-500)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = "var(--primary-400)";
                      }}
                    >
                      {submitting ? "Sending…" : "Submit feedback"}
                    </button>
                    <span className="text-[12px] hidden sm:block" style={{ ...interStyle, color: "var(--base-300)" }}>
                      Anonymous to other students
                    </span>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
