"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { AiSuggestion } from "@/lib/planner/types";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  suggestion: AiSuggestion | null;
  loading: boolean;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onScheduleNow: (subject: string, durationMinutes: number) => void;
}

export default function AiSuggestionCard({ suggestion, loading, expanded, onExpand, onCollapse, onScheduleNow }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Seed assistant bubble when expanding (suggestion may load after expand).
  useEffect(() => {
    if (!expanded || !suggestion?.suggestion) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed from async-loaded suggestion when opening chat
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      return [{ role: "assistant", content: suggestion.suggestion }];
    });
  }, [expanded, suggestion?.suggestion]);

  useEffect(() => {
    if (expanded) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 100);
    }
  }, [expanded, messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || chatLoading) return;
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user" as const, content: text }];
    setMessages(newMessages);
    setChatLoading(true);

    try {
      const res = await fetch("/api/planner/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (res.ok) {
        const data = await res.json() as { content?: string };
        setMessages((prev) => [...prev, { role: "assistant", content: data.content ?? "Sorry, I couldn't generate a response." }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
    }
    setChatLoading(false);
  };

  const urgencyColor = {
    high: "#EF4444",
    medium: "#F59E0B",
    low: "#10B981",
  }[suggestion?.urgency ?? "low"];

  if (expanded) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col flex-1 min-h-0"
        style={{ fontFamily: "var(--font-inter)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ backgroundColor: "var(--primary-400)" }}>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
            </svg>
            <span className="text-[14px] font-semibold text-white">AI Suggestion</span>
          </div>
          <button
            type="button"
            onClick={onCollapse}
            className="w-6 h-6 rounded flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer"
            aria-label="Close AI chat"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-0">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div
                  className="w-7 h-7 rounded-full shrink-0 mr-2 flex items-center justify-center"
                  style={{ backgroundColor: "rgba(0,119,237,0.1)" }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="var(--primary-400)">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  msg.role === "user"
                    ? "rounded-tr-sm text-white"
                    : "rounded-tl-sm text-[var(--base-700)] border border-[var(--base-200)] bg-white"
                }`}
                style={msg.role === "user" ? { backgroundColor: "var(--primary-400)" } : {}}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full shrink-0 mr-2 flex items-center justify-center" style={{ backgroundColor: "rgba(0,119,237,0.1)" }}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="var(--primary-400)"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" /></svg>
              </div>
              <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 border border-[var(--base-200)] bg-white flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-3 py-2.5 border-t border-[var(--base-200)] shrink-0 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask about your schedule…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void sendMessage(); }}
            className="flex-1 h-8 rounded-xl border border-[var(--base-200)] px-3 text-[13px] text-[var(--base-700)] placeholder:text-[var(--base-300)] outline-none focus:border-[var(--primary-400)] transition-colors bg-[var(--base-100)]"
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={!input.trim() || chatLoading}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
            style={{ backgroundColor: "var(--primary-400)" }}
            aria-label="Send"
          >
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>
          </button>
        </div>
      </motion.div>
    );
  }

  // Collapsed state
  return (
    <div
      className="mx-3 mb-3 rounded-2xl border border-[var(--base-200)] p-3.5 flex flex-col gap-3 cursor-pointer hover:border-[var(--primary-400)] transition-colors"
      style={{ backgroundColor: "#FAFCFF", fontFamily: "var(--font-inter)" }}
      onClick={onExpand}
    >
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="var(--primary-400)">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
        </svg>
        <span className="text-[13px] font-semibold text-[var(--base-700)]">AI Suggestion</span>
        {suggestion?.urgency && (
          <span
            className="ml-auto w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: urgencyColor }}
            title={`${suggestion.urgency} urgency`}
          />
        )}
      </div>

      {loading ? (
        <div className="flex gap-1 items-center py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-pulse" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-pulse" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-pulse" style={{ animationDelay: "300ms" }} />
        </div>
      ) : suggestion ? (
        <p className="text-[12px] text-[var(--base-600)] leading-relaxed line-clamp-3">
          {suggestion.suggestion}
        </p>
      ) : (
        <p className="text-[12px] text-[var(--base-400)]">No suggestion available yet.</p>
      )}

      {suggestion && !loading && (
        <button
          type="button"
          className="flex items-center gap-1.5 text-[12px] font-semibold text-white h-8 px-3 rounded-xl transition-opacity hover:opacity-90 cursor-pointer w-fit"
          style={{ backgroundColor: "var(--primary-400)" }}
          onClick={(e) => {
            e.stopPropagation();
            onScheduleNow(suggestion.recommended_subject, suggestion.recommended_duration_minutes);
          }}
        >
          Schedule now
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
        </button>
      )}
    </div>
  );
}
