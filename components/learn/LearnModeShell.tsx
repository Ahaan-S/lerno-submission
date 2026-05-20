"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTopLoader } from "@/components/ui/TopLoader";
import { motion } from "framer-motion";
import TopicProgressSidebar, { type TopicEntry } from "./TopicProgressSidebar";
import { useProfileMe } from "@/hooks/use-profile-me";

interface LearnModeShellProps {
  children: React.ReactNode;
  subject: string;
  subjectLabel: string;
  chapterName: string;
  chapterIndex: number;
  topics: TopicEntry[];
  topicsCompleted: string[];
  currentTopicIndex: string | null;
  user: { email?: string | null; user_metadata?: { full_name?: string } | null };
}

function getInitial(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name[0] ?? "U").toUpperCase();
}

function getDisplayName(user: { email?: string | null; user_metadata?: { full_name?: string } | null }): string {
  const name = user.user_metadata?.full_name;
  if (name?.trim()) return name.trim();
  return user.email?.split("@")[0] ?? "Student";
}

export default function LearnModeShell({
  children,
  subject,
  subjectLabel,
  chapterName,
  chapterIndex,
  topics,
  topicsCompleted,
  currentTopicIndex,
  user,
}: LearnModeShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const router = useRouter();

  // SWR: stays fresh after profile save without a full page reload.
  // Falls back to server-rendered user prop while the cache is being populated.
  const { data: profileData } = useProfileMe();
  const resolvedDisplayName =
    profileData?.display_name?.trim() ||
    profileData?.full_name?.trim() ||
    getDisplayName(user);
  const displayName = resolvedDisplayName;
  const initial = getInitial(displayName);

  return (
    <div className="min-h-screen flex flex-col p-2.5" style={{ backgroundColor: "var(--page-bg)" }}>
      <div className="flex-1 flex min-h-0 max-h-[calc(100vh-20px)] gap-1.5">

        {/* ─── Left sidebar: topic progress ─── */}
        <aside
          className={`flex-shrink-0 flex flex-col transition-[width] duration-200 ease-out overflow-hidden rounded-xl border ${
            sidebarCollapsed ? "w-[56px]" : "w-[220px]"
          }`}
          style={{ borderColor: "var(--base-300)", backgroundColor: "var(--panel-bg)" }}
        >
          {/* Logo + collapse */}
          <div className={`flex items-center shrink-0 mt-3 mb-2 px-3 ${sidebarCollapsed ? "justify-center" : "justify-between"}`}>
            {!sidebarCollapsed && (
              <Link href="/learn" className="flex items-center min-w-0 overflow-hidden w-[60%]">
                <Image
                  src="/lerno.webp"
                  alt="Lerno"
                  width={80}
                  height={26}
                  className="h-auto w-full object-contain object-left"
                  unoptimized
                />
              </Link>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              className="p-1 rounded-md text-[var(--base-500)] hover:bg-[var(--base-100)] transition-colors shrink-0 cursor-pointer"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={sidebarCollapsed ? { transform: "scaleX(-1)" } : undefined}
              >
                <path d="M4.75 4C3.23 4 2 5.23 2 6.75V17.25C2 18.77 3.23 20 4.75 20H19.25C20.77 20 22 18.77 22 17.25V6.75C22 5.23 20.77 4 19.25 4H4.75ZM3.5 6.75C3.5 6.06 4.06 5.5 4.75 5.5H8V18.5H4.75C4.06 18.5 3.5 17.94 3.5 17.25V6.75ZM9.5 18.5V5.5H19.25C19.94 5.5 20.5 6.06 20.5 6.75V17.25C20.5 17.94 19.94 18.5 19.25 18.5H9.5Z" fill="currentColor" />
              </svg>
            </button>
          </div>

          {/* Topic progress */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {sidebarCollapsed ? (
              <div className="px-2 py-3">
                <TopicProgressSidebar
                  chapterName={chapterName}
                  topics={topics}
                  topicsCompleted={topicsCompleted}
                  currentTopicIndex={currentTopicIndex}
                  collapsed
                />
              </div>
            ) : (
              <TopicProgressSidebar
                chapterName={chapterName}
                topics={topics}
                topicsCompleted={topicsCompleted}
                currentTopicIndex={currentTopicIndex}
              />
            )}
          </div>

          {/* Back to chapters + user */}
          <div className="shrink-0 border-t border-[var(--base-100)] pt-3 pb-3 px-3">
            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={() => { startTopLoader(); router.push(`/learn/${subject}`); }}
                className="flex items-center gap-1.5 text-[13px] mb-3 hover:opacity-75 transition-opacity cursor-pointer"
                style={{ color: "var(--base-500)", fontFamily: "var(--font-inter)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
                All chapters
              </button>
            )}
            <div className={`flex items-center gap-2 ${sidebarCollapsed ? "justify-center" : ""}`}>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 text-[13px] font-medium"
                style={{ backgroundColor: "var(--primary-400)" }}
              >
                {initial}
              </div>
              {!sidebarCollapsed && (
                <span className="text-[14px] font-medium truncate" style={{ color: "var(--base-600)", fontFamily: "var(--font-inter)" }}>
                  {displayName}
                </span>
              )}
            </div>
          </div>
        </aside>

        {/* ─── Main content ─── */}
        <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
          <div className="flex-1 flex flex-col rounded-xl border shadow-sm min-h-0 overflow-hidden" style={{ borderColor: "var(--base-300)", backgroundColor: "var(--panel-bg)" }}>
            {/* Header */}
            <header className="flex items-center justify-between shrink-0 min-h-[50px] px-6 py-3 border-b" style={{ borderColor: "var(--base-300)" }}>
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="text-[13px] font-medium px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: "var(--primary-10)",
                    color: "var(--primary-400)",
                    fontFamily: "var(--font-inter)",
                  }}
                >
                  Learn
                </span>
                <span className="text-[14px] font-medium truncate" style={{ fontFamily: "var(--font-inter)", color: "var(--base-700)" }}>
                  {subjectLabel} — Chapter {chapterIndex}: {chapterName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => { startTopLoader(); router.push("/ask"); }}
                className="flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] border border-[var(--base-200)] hover:bg-[var(--base-100)] transition-colors cursor-pointer shrink-0"
                style={{ fontFamily: "var(--font-inter)", color: "var(--base-600)" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z" />
                </svg>
                Ask mode
              </button>
            </header>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
