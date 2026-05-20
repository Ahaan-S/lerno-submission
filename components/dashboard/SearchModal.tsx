"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SUBJECT_LABELS } from "@/lib/chapters";
import { startTopLoader } from "@/components/ui/TopLoader";
import { getTutorSubjectDotColor } from "@/lib/tutor-subject-dot-color";

export type SearchSession = {
    id: string;
    subject: string;
    title: string | null;
    starred: boolean;
    last_message_at: string;
    mode?: string;
};

interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    recentSessions: SearchSession[];
}

function timeAgo(dateStr: string): string {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function SearchModal({ isOpen, onClose, recentSessions }: SearchModalProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchSession[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Reset + focus when opened
    useEffect(() => {
        if (isOpen) {
            setQuery("");
            setResults([]);
            setActiveIndex(0);
            setIsSearching(false);
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [isOpen]);

    // Debounced API search
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setIsSearching(false);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            return;
        }
        setIsSearching(true);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/tutor/sessions?q=${encodeURIComponent(query.trim())}&limit=30`, { credentials: "include" });
                if (res.ok) {
                    const data = await res.json() as { sessions: SearchSession[] };
                    setResults(data.sessions);
                }
            } catch { /* ignore */ }
            setIsSearching(false);
        }, 250);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [query]);

    const displayList = query.trim() ? results : recentSessions.slice(0, 10);

    // Keep active item scrolled into view
    useEffect(() => {
        const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
        el?.scrollIntoView({ block: "nearest" });
    }, [activeIndex]);

    // Reset active index when list changes
    useEffect(() => { setActiveIndex(0); }, [displayList.length, query]);

    const navigateTo = useCallback((session: SearchSession) => {
        onClose();
        const path = session.mode === "learn"
            ? `/learn/${session.subject}/session/${session.id}`
            : `/chat/${session.id}`;
        startTopLoader();
        router.push(path);
    }, [onClose, router]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") { onClose(); return; }
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, displayList.length - 1));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && displayList[activeIndex]) {
                navigateTo(displayList[activeIndex]);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isOpen, onClose, displayList, activeIndex, navigateTo]);

    if (!isOpen) return null;

    const sectionLabel = query.trim()
        ? isSearching ? "Searching…" : `${results.length} result${results.length !== 1 ? "s" : ""}`
        : "Recent";

    return (
        <div
            className="fixed inset-0 z-[200] flex items-start justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.22)", backdropFilter: "blur(3px)" }}
            onClick={onClose}
        >
            <div
                className="w-full max-w-[560px] mx-4 mt-[16vh] bg-white rounded-2xl overflow-hidden"
                style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.07)", border: "none" }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search input bar */}
                <div className="flex items-center px-4 h-[54px] gap-3" style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.25} stroke="#9CA3AF">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search sessions…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="flex-1 outline-none bg-transparent text-slate-800 placeholder-slate-400"
                        style={{ fontFamily: "var(--font-inter)", fontSize: 15 }}
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery("")}
                            className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                    <kbd className="shrink-0 text-[11px] text-slate-400 rounded px-1.5 py-0.5 hidden sm:block" style={{ fontFamily: "var(--font-inter)", border: "1px solid #E5E7EB", backgroundColor: "#FAFAFA" }}>
                        Esc
                    </kbd>
                </div>

                {/* Results */}
                <div className="flex flex-col" style={{ maxHeight: 380, overflowY: "auto" }}>
                    {/* Section label */}
                    <div className="px-4 pt-3 pb-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ fontFamily: "var(--font-inter)", color: "#A3A3A3", letterSpacing: "0.06em" }}>
                            {sectionLabel}
                        </span>
                    </div>

                    {/* Empty states */}
                    {displayList.length === 0 && !isSearching && query.trim() && (
                        <div className="px-4 py-10 text-center" style={{ fontFamily: "var(--font-inter)", fontSize: 14, color: "#A3A3A3" }}>
                            No sessions found for &ldquo;{query}&rdquo;
                        </div>
                    )}
                    {displayList.length === 0 && !query.trim() && (
                        <div className="px-4 py-10 text-center" style={{ fontFamily: "var(--font-inter)", fontSize: 14, color: "#A3A3A3" }}>
                            No recent sessions
                        </div>
                    )}

                    {/* Session rows */}
                    <div ref={listRef}>
                        {displayList.map((session, i) => {
                            const subjectLabel = SUBJECT_LABELS[session.subject] ?? session.subject;
                            const dotColor = getTutorSubjectDotColor(session.subject);
                            const isActive = i === activeIndex;
                            return (
                                <button
                                    key={session.id}
                                    type="button"
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-colors"
                                    style={{ backgroundColor: isActive ? "#F5F5F5" : "transparent" }}
                                    onClick={() => navigateTo(session)}
                                    onMouseEnter={() => setActiveIndex(i)}
                                >
                                    <span className="w-2 h-2 rounded-full shrink-0 mt-[1px]" style={{ backgroundColor: dotColor }} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[14px] text-slate-800 truncate" style={{ fontFamily: "var(--font-inter)" }}>
                                            {session.title ?? `${subjectLabel} session`}
                                        </p>
                                        <p className="text-[12px] truncate" style={{ fontFamily: "var(--font-inter)", color: "#9CA3AF" }}>
                                            {subjectLabel} · {session.mode === "learn" ? "Learn" : "Ask"}
                                        </p>
                                    </div>
                                    <span className="text-[12px] shrink-0" style={{ fontFamily: "var(--font-inter)", color: "#B0B0B0" }}>
                                        {timeAgo(session.last_message_at)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <div className="h-2 shrink-0" />
                </div>

                {/* Footer hints */}
                <div className="flex items-center gap-4 px-4 py-2" style={{ borderTop: "1px solid #f0f0f0" }}>
                    {[["↑↓", "navigate"], ["↵", "open"], ["Esc", "close"]].map(([key, hint]) => (
                        <span key={key} className="flex items-center gap-1" style={{ fontFamily: "var(--font-inter)", fontSize: 11, color: "#A3A3A3" }}>
                            <kbd className="rounded px-1 text-[10px]" style={{ border: "1px solid #E5E7EB", backgroundColor: "#FAFAFA", color: "#737373" }}>{key}</kbd>
                            {hint}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
