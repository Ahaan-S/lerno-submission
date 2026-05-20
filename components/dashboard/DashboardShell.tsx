"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { useTutoringSession } from "@/lib/tutoring-session-context";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { AccountSettingsModal, type SettingsSectionId } from "@/components/dashboard/AccountSettingsModal";
import { TooltipHint } from "@/components/ui/tooltip-hint";
import { startTopLoader } from "@/components/ui/TopLoader";
import { AnimatePresence, motion } from "framer-motion";
import {
    StudyFeedHeaderMetricsProvider,
    StudyFeedShellFilterButton,
    StudyFeedShellHeaderRight,
    StudyFeedShellRefreshButton,
} from "@/components/dashboard/study-feed-header-context";
import {
    PlannerHeaderProvider,
    PlannerShellNavControls,
} from "@/components/planner/planner-header-context";
import { SUBJECT_LABELS } from "@/lib/chapters";
import { ChatTitleMarkdown } from "@/components/ui/ChatTitleMarkdown";
import SearchModal from "@/components/dashboard/SearchModal";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { FriendPickerModal } from "@/components/social/FriendPickerModal";
import { ShareButton } from "@/components/social/ShareButton";
import { IconInstagramShare } from "@/components/social/ShareButton";
import { track } from "@/lib/analytics";
import { StreakBadge } from "@/components/ui/StreakBadge";
import SessionRatingModal from "@/components/feedback/SessionRatingModal";
import GeneralFeedbackModal from "@/components/feedback/GeneralFeedbackModal";
import { useProfileMe } from "@/hooks/use-profile-me";
import { useRecentSessions, invalidateRecentSessions, type RecentSession } from "@/hooks/use-recent-sessions";
import { useDashboardHeader } from "@/lib/dashboard-header-context";

/** Reverse map: subject label → subject key (e.g. "Science" → "science") */
const SUBJECT_LABEL_TO_ID = Object.fromEntries(
    Object.entries(SUBJECT_LABELS).map(([id, label]) => [label, id])
) as Record<string, string>;

// Tracks whether the splash has already played this JS bundle load.
// Resets on hard refresh; does NOT reset on client-side navigation.
let splashShownThisLoad = false;

/** One-time auto feedback prompt after this much eligible portal time (tab visible, no blocking overlay). */
const AUTO_FEEDBACK_ONCE_MS = 5 * 60 * 1000;
const AUTO_FEEDBACK_STORAGE_KEY = "lerno_auto_feedback_prompt_v2";

function readAutoFeedbackAlreadyShown(): boolean {
    try {
        const raw = localStorage.getItem(AUTO_FEEDBACK_STORAGE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as { lastAt?: unknown };
        return typeof parsed?.lastAt === "number";
    } catch {
        return false;
    }
}

function writeLastAutoFeedbackPromptAt(ts: number) {
    try {
        localStorage.setItem(AUTO_FEEDBACK_STORAGE_KEY, JSON.stringify({ lastAt: ts }));
    } catch { /* private mode / quota */ }
}

const SPLASH_MESSAGES = [
    "Every question you ask makes you smarter.",
    "You're one session away from understanding it.",
    "The best students are just the most curious.",
    "Confusion is the first step to understanding.",
    "Your future self will thank you for today.",
    "Small sessions. Big results.",
    "Keep going. You're closer than you think.",
    "Consistency beats intensity. Show up today.",
    "Understanding beats memorising. Always.",
    "One chapter at a time. You've got this.",
];

const svgProps = { xmlns: "http://www.w3.org/2000/svg", fill: "none" as const, viewBox: "0 0 24 24", strokeWidth: 2.25, stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const IconAdd = ({ className }: { className?: string }) => (
    <svg {...svgProps} className={className}><path d="M12 4.5v15m7.5-7.5h-15" /></svg>
);
const IconSearch = ({ className }: { className?: string }) => (
    <svg {...svgProps} className={className}><path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
);

const IconAITutor = ({ className }: { className?: string }) => (
    <svg {...svgProps} className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z" /></svg>
);
const IconStudyFeed = ({ className }: { className?: string }) => (
    <svg {...svgProps} className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>
);
const IconPlanner = ({ className }: { className?: string }) => (
    <svg {...svgProps} className={className}><path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
);
const IconStudyMaterial = ({ className }: { className?: string }) => (
    <svg {...svgProps} className={className}><path d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /></svg>
);
const IconAnalytics = ({ className }: { className?: string }) => (
    <svg {...svgProps} className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" /></svg>
);

function DashboardHeaderAnalyticsButton({
    mobileLayout,
    onNavigate,
}: {
    mobileLayout: boolean;
    onNavigate: () => void;
}) {
    return (
        <TooltipHint label="Open analytics" side="bottom">
            <button
                type="button"
                onClick={onNavigate}
                className={
                    mobileLayout
                        ? "flex size-9 shrink-0 items-center justify-center rounded-xl my-0 transition-opacity hover:opacity-95 cursor-pointer"
                        : "flex items-center justify-center gap-1.5 sm:gap-2 h-9 px-2.5 sm:px-4 my-[7px] rounded-full text-[12px] sm:text-[14px] font-medium shrink-0 transition-opacity hover:opacity-95 cursor-pointer"
                }
                style={{ backgroundColor: "var(--primary-400)", fontFamily: "var(--font-inter)", color: "white" }}
                aria-label="Analytics"
            >
                <IconAnalytics className={`shrink-0 ${mobileLayout ? "w-5 h-5" : "w-4 h-4"}`} />
                {!mobileLayout && (
                    <span className="truncate">Analytics</span>
                )}
            </button>
        </TooltipHint>
    );
}


const IconStar = ({ className, filled }: { className?: string; filled?: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
    </svg>
);
const IconPencil = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
    </svg>
);
const IconTrash = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
);
const IconShare = ({ className }: { className?: string }) => <IconInstagramShare className={className} />;
const IconChevronDown = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
);

function PanelLeftIcon({ className, mirror }: { className?: string; mirror?: boolean }) {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={mirror ? { transform: "scaleX(-1)" } : undefined}>
            <path d="M4.75 4C3.23122 4 2 5.23122 2 6.75V17.25C2 18.7688 3.23122 20 4.75 20H19.25C20.7688 20 22 18.7688 22 17.25V6.75C22 5.23122 20.7688 4 19.25 4H4.75ZM3.5 6.75C3.5 6.05964 4.05964 5.5 4.75 5.5H8.00427V18.5H4.75C4.05964 18.5 3.5 17.9404 3.5 17.25V6.75ZM9.50427 18.5V5.5H19.25C19.9404 5.5 20.5 6.05964 20.5 6.75V17.25C20.5 17.9404 19.9404 18.5 19.25 18.5H9.50427Z" fill="currentColor" />
        </svg>
    );
}

function IconMenu({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" className={className} aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
    );
}

function IconCloseNav({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" className={className} aria-hidden>
            <path d="M6 18 18 6M6 6l12 12" />
        </svg>
    );
}

/** Viewports at or below this width use a slide-over nav drawer instead of an in-flow sidebar. */
const DASHBOARD_MOBILE_MAX_PX = 1023;

function subscribeDashboardMobile(callback: () => void) {
    if (typeof window === "undefined") return () => {};
    const mq = window.matchMedia(`(max-width: ${DASHBOARD_MOBILE_MAX_PX}px)`);
    mq.addEventListener("change", callback);
    return () => mq.removeEventListener("change", callback);
}

function getDashboardMobileSnapshot() {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${DASHBOARD_MOBILE_MAX_PX}px)`).matches;
}

type User = {
    email?: string | null;
    user_metadata?: { full_name?: string; grade?: string } | null;
};

type DashboardShellProps = {
    children: React.ReactNode;
    user: User;
    headerTitle?: string;
    headerBreadcrumb?: { label: string; href?: string }[];
    /** @deprecated Prefer pathname-based detection. Kept for pages outside the (dashboard) route group. */
    fullHeightContent?: boolean;
};

export type ChatHeaderContext = {
    sessionId: string;
    title: string;
    starred: boolean;
    onRename: (newTitle: string) => void;
    onStar: (starred: boolean) => void;
    onDelete: () => void;
};

const ChatHeaderCtx = React.createContext<ChatHeaderContext | null>(null);

export function useChatHeader() {
    return React.useContext(ChatHeaderCtx);
}

export function ChatHeaderProvider({
    children,
    value,
}: {
    children: React.ReactNode;
    value: ChatHeaderContext | null;
}) {
    return <ChatHeaderCtx.Provider value={value}>{children}</ChatHeaderCtx.Provider>;
}

function getDisplayName(user: User): string {
    const name = user.user_metadata?.full_name;
    if (name && typeof name === "string" && name.trim()) return name.trim();
    const email = user.email ?? "";
    return email.split("@")[0] || "User";
}

/** First word of display name — sidebar label matches across routes when profile uses full legal name. */
function getSidebarFirstName(displayName: string): string {
    const parts = displayName.trim().split(/\s+/);
    return parts[0] || displayName.trim() || "User";
}

const ACCOUNT_MENU_WIDTH = 220;

function SidebarAccountMenu({
    collapsed,
    sidebarFirstName,
    user,
    onFeedback,
}: {
    collapsed: boolean;
    sidebarFirstName: string;
    user: User;
    onFeedback: () => void;
}) {
    const [open, setOpen] = useState(false);

    // SWR keeps profile data fresh across tabs and after mutations.
    // Replaces the manual fetch + `lerno-profile-updated` event listener.
    const { data: profilePhoto } = useProfileMe();
    const [accountModal, setAccountModal] = useState<
        null | { mode: "settings"; section: SettingsSectionId } | { mode: "help" }
    >(null);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const updatePosition = useCallback(() => {
        const el = triggerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const margin = 8;
        let left = collapsed ? rect.left + rect.width / 2 - ACCOUNT_MENU_WIDTH / 2 : rect.left;
        left = Math.max(margin, Math.min(left, window.innerWidth - ACCOUNT_MENU_WIDTH - margin));
        // Anchor with `bottom` so the menu sits above the trigger. Do not use `top` + translateY(-100%):
        // framer-motion's animate `y` overwrites inline `transform` and drops the upward offset, clipping the lower items (e.g. Log out).
        setMenuStyle({
            position: "fixed",
            left,
            bottom: window.innerHeight - rect.top + margin,
            width: ACCOUNT_MENU_WIDTH,
            zIndex: 10000,
        });
    }, [collapsed]);

    useEffect(() => {
        if (!open) return;
        updatePosition();
        const onReposition = () => updatePosition();
        window.addEventListener("scroll", onReposition, true);
        window.addEventListener("resize", onReposition);
        return () => {
            window.removeEventListener("scroll", onReposition, true);
            window.removeEventListener("resize", onReposition);
        };
    }, [open, updatePosition]);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (
                menuRef.current?.contains(e.target as Node) ||
                triggerRef.current?.contains(e.target as Node)
            ) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const handleSignOut = async () => {
        setOpen(false);
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/auth");
    };

    const trigger = (
        <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={`group flex items-center w-full rounded-xl border border-transparent text-left transition-colors cursor-pointer hover:bg-[#efefef] ${
                collapsed ? "justify-center gap-1 py-1 px-0" : "gap-2.5 pl-2 pr-3 py-1.5"
            }`}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Account menu"
        >
            <span className="flex-shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-sm transition-transform duration-200 ease-out group-hover:scale-[1.03]">
                <ProfileAvatar
                    avatarUrl={profilePhoto?.avatar_url}
                    displayName={profilePhoto?.display_name ?? sidebarFirstName}
                    fullName={profilePhoto?.full_name}
                    email={user.email}
                    size={28}
                    className="!border-0"
                />
            </span>
            {!collapsed && (
                <span className="text-[14px] font-medium text-slate-600 truncate min-w-0 flex-1">{sidebarFirstName}</span>
            )}
            <IconChevronDown
                className={`shrink-0 text-slate-600 transition-transform duration-150 ${open ? "rotate-180" : ""} ${
                    collapsed ? "w-3 h-3" : "w-3.5 h-3.5"
                }`}
                aria-hidden
            />
        </button>
    );

    const menuItem = (onClick: () => void, icon: React.ReactNode, label: string, danger = false) => (
        <button
            type="button"
            role="menuitem"
            onClick={onClick}
            className={`w-full rounded-[10px] px-3 py-2.5 flex items-center gap-2.5 text-left text-[13.5px] transition-colors duration-100 cursor-pointer ${
                danger
                    ? "text-red-500 hover:bg-red-50"
                    : "text-[#3a3a3a] hover:bg-[#f5f5f5]"
            }`}
        >
            <span className={`w-4 h-4 shrink-0 flex items-center justify-center ${danger ? "text-red-400" : "text-[#7a7a7a]"}`}>
                {icon}
            </span>
            {label}
        </button>
    );

    return (
        <>
            {collapsed ? (
                <TooltipHint label="Account" side="right">
                    {trigger}
                </TooltipHint>
            ) : (
                trigger
            )}
            {open && typeof document !== "undefined" && createPortal(
                <motion.div
                    ref={menuRef}
                    role="menu"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                    className="rounded-2xl p-1.5"
                    style={{
                        ...menuStyle,
                        fontFamily: "var(--font-inter)",
                        backgroundColor: "var(--panel-bg)",
                        boxShadow: "0 8px 30px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)",
                    }}
                >
                    {menuItem(
                        () => { setOpen(false); setAccountModal({ mode: "settings", section: "account" }); },
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>,
                        "Settings"
                    )}
                    {menuItem(
                        () => { setOpen(false); setAccountModal({ mode: "help" }); },
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>,
                        "Help"
                    )}
                    {menuItem(
                        () => { setOpen(false); onFeedback(); },
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/></svg>,
                        "Feedback"
                    )}
                    <div className="h-px mx-1.5 my-1" style={{ backgroundColor: "var(--base-300)" }} role="separator" />
                    {menuItem(
                        () => void handleSignOut(),
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>,
                        "Log out",
                        true
                    )}
                </motion.div>,
                document.body,
            )}
            <AccountSettingsModal
                open={accountModal !== null}
                onClose={() => setAccountModal(null)}
                mode={accountModal?.mode ?? "settings"}
                initialSettingsSection={
                    accountModal?.mode === "settings" ? accountModal.section : "account"
                }
                user={user}
            />
        </>
    );
}

const navItems = [
    { id: "ai-tutor", label: "AI Tutor", Icon: IconAITutor },
    { id: "study-feed", label: "Study Feed", Icon: IconStudyFeed },
    { id: "planner", label: "Study Planner", Icon: IconPlanner },
    { id: "material", label: "Study Material", Icon: IconStudyMaterial },
] as const;

const DELETE_RED = "#E02E2A";

function DeleteConfirmModal({ title, onConfirm, onClose }: { title: string; onConfirm: () => void; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={onClose}>
            <div
                className="rounded-2xl shadow-xl p-6 w-[min(400px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] flex flex-col gap-4"
                style={{ backgroundColor: "var(--panel-bg)" }}
                onClick={(e) => e.stopPropagation()}
            >
                <p className="text-[15px] font-semibold text-[var(--base-800)]" style={{ fontFamily: "var(--font-inter)" }}>Delete chat?</p>
                <p className="text-[14px] text-[var(--base-600)]" style={{ fontFamily: "var(--font-inter)" }}>
                    This will delete{" "}
                    <strong className="font-semibold text-[var(--base-800)] inline align-middle">
                        <ChatTitleMarkdown text={title} />
                    </strong>
                    .
                </p>
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-[14px] text-[var(--base-600)] border border-[var(--base-200)] hover:bg-[var(--base-100)] transition-colors cursor-pointer"
                        style={{ fontFamily: "var(--font-inter)" }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => { onConfirm(); onClose(); }}
                        className="px-4 py-2 rounded-xl text-[14px] font-medium text-white hover:opacity-90 transition-opacity cursor-pointer"
                        style={{ fontFamily: "var(--font-inter)", backgroundColor: DELETE_RED }}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

function RenameModal({ current, onSave, onClose }: { current: string; onSave: (t: string) => void; onClose: () => void }) {
    const [value, setValue] = useState(current);
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => { inputRef.current?.select(); }, []);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={onClose}>
            <div
                className="rounded-2xl shadow-xl p-6 w-[min(400px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] flex flex-col gap-4"
                style={{ backgroundColor: "var(--panel-bg)" }}
                onClick={(e) => e.stopPropagation()}
            >
                <p className="text-[15px] font-semibold text-[var(--base-700)]" style={{ fontFamily: "var(--font-inter)" }}>Rename chat</p>
                <input
                    ref={inputRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) { onSave(value.trim()); } if (e.key === "Escape") { onClose(); } }}
                    className="border border-[var(--base-200)] rounded-xl px-4 py-2.5 text-[14px] outline-none focus:border-[var(--base-400)] transition-colors"
                    style={{ fontFamily: "var(--font-inter)" }}
                    maxLength={80}
                />
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-[14px] text-[var(--base-500)] hover:bg-[var(--base-100)] transition-colors cursor-pointer" style={{ fontFamily: "var(--font-inter)" }}>Cancel</button>
                    <button
                        type="button"
                        disabled={!value.trim()}
                        onClick={() => value.trim() && onSave(value.trim())}
                        className="px-4 py-2 rounded-xl text-[14px] font-medium bg-[var(--primary-400)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer"
                        style={{ fontFamily: "var(--font-inter)" }}
                    >Save</button>
                </div>
            </div>
        </div>
    );
}

function ChatTitleDropdown({
    sessionId,
    title,
    starred,
    wrapTitle,
    /** Learn /session routes on mobile: shorter title so it clears Analytics + chapter panel */
    compactTitleForLearnMobile,
    onRename,
    onStar,
    onDelete,
}: {
    sessionId: string;
    title: string;
    starred: boolean;
    /** Multi-line chapter title on narrow learn-session screens */
    wrapTitle?: boolean;
    compactTitleForLearnMobile?: boolean;
    onRename: (newTitle: string) => void;
    onStar: (starred: boolean) => void;
    onDelete: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [showRename, setShowRename] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const menuItems = [
        {
            label: "Rename",
            icon: <IconPencil className="w-5 h-5 text-[var(--base-600)]" />,
            action: () => { setOpen(false); setShowRename(true); },
        },
        {
            label: starred ? "Unstar" : "Star",
            icon: <IconStar className="w-5 h-5 text-[var(--base-600)]" filled={starred} />,
            action: () => { setOpen(false); onStar(!starred); },
        },
        {
            label: "Share with friend",
            icon: <IconShare className="w-5 h-5 text-[var(--base-600)]" />,
            action: () => { setOpen(false); setShareOpen(true); },
        },
        {
            label: "Delete",
            icon: <IconTrash className="w-5 h-5" />,
            action: () => { setOpen(false); setShowDeleteConfirm(true); },
            danger: true,
        },
    ];

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen((o) => !o)}
                className={`flex gap-1.5 py-1.5 rounded-lg hover:bg-[var(--base-100)] transition-colors cursor-pointer group ${
                    wrapTitle ? "max-w-full min-w-0 w-full items-start text-left" : "items-center"
                } ${
                    compactTitleForLearnMobile && !wrapTitle
                        ? "min-w-0 max-w-[calc(100vw-8rem)] pl-1.5 pr-1.5 gap-1"
                        : "px-2.5 gap-1.5"
                }`}
                aria-label="Chat options"
            >
                <span
                    className={
                        wrapTitle
                            ? "text-[15px] font-medium min-w-0 flex-1 whitespace-normal text-left leading-snug [overflow-wrap:anywhere]"
                            : compactTitleForLearnMobile
                                ? "text-[15px] font-medium min-w-0 truncate block text-left max-w-[min(140px,calc(100vw-14.75rem),32vw)]"
                                : "text-[15px] font-medium max-w-[min(220px,calc(100vw-12rem))] sm:max-w-[260px] min-w-0 truncate block text-left"
                    }
                    style={{ fontFamily: "var(--font-inter)", color: "var(--base-700)" }}
                >
                    <ChatTitleMarkdown text={title} className="inline min-w-0" />
                </span>
                <IconChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 text-[var(--base-400)] ${wrapTitle ? "mt-0.5" : ""} ${open ? "rotate-180" : ""}`}
                />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        ref={menuRef}
                        initial={{ opacity: 0, y: -4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.98 }}
                        transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute top-full left-0 mt-1 z-40 rounded-[16px] border border-[var(--base-200)] p-[6px] shadow-[0_12px_32px_rgba(15,23,42,0.10)] min-w-[160px]"
                        style={{ backgroundColor: "var(--panel-bg)", fontFamily: "var(--font-inter)" }}
                    >
                        <div className="flex flex-col gap-0">
                            {menuItems.map((item) => (
                                <button
                                    key={item.label}
                                    type="button"
                                    onClick={item.action}
                                    className={`w-full min-h-6 rounded-[10px] px-[10px] py-[6px] flex items-center gap-[6px] text-left text-[14px] transition-all duration-150 cursor-pointer ${
                                        item.danger ? "text-[#E02E2A] hover:bg-[#E02E2A]/5" : "text-[var(--base-800)] hover:bg-[var(--base-100)]"
                                    }`}
                                >
                                    <span className="shrink-0">{item.icon}</span>
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {showRename && (
                <RenameModal
                    current={title}
                    onSave={(t) => { onRename(t); setShowRename(false); }}
                    onClose={() => setShowRename(false)}
                />
            )}
            {showDeleteConfirm && (
                <DeleteConfirmModal
                    title={title}
                    onConfirm={onDelete}
                    onClose={() => setShowDeleteConfirm(false)}
                />
            )}
            <FriendPickerModal
                open={shareOpen}
                onClose={() => setShareOpen(false)}
                shareKind="session"
                resourceId={sessionId}
            />
        </>
    );
}

function RecentChatItem({
    session,
    isActive,
    onRename,
    onStar,
    onDelete,
}: {
    session: RecentSession;
    isActive: boolean;
    onRename: (id: string, title: string) => void;
    onStar: (id: string, starred: boolean) => void;
    onDelete: (id: string) => void;
}) {
    const router = useRouter();
    const [hovering, setHovering] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [showRename, setShowRename] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const prefetchedRef = useRef(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const dotsRef = useRef<HTMLButtonElement>(null);
    const displayTitle = session.title ?? session.subject ?? "Untitled";
    const destinationHref = session.mode === "learn"
        ? `/learn/${SUBJECT_LABEL_TO_ID[session.subject ?? ""] ?? (session.subject ?? "science").toLowerCase()}/session/${session.id}`
        : `/chat/${session.id}`;

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node) && !dotsRef.current?.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <>
            <div
                className={`group relative flex items-center gap-1.5 h-8 rounded-lg px-2.5 transition-colors cursor-pointer ${
                    isActive ? "bg-[#e8e8e8]" : "hover:bg-[#f1f1f1]"
                }`}
                onMouseEnter={() => {
                    setHovering(true);
                    if (!prefetchedRef.current) {
                        prefetchedRef.current = true;
                        router.prefetch(destinationHref);
                    }
                }}
                onMouseLeave={() => { if (!menuOpen) setHovering(false); }}
            >
                {/* Full-row link — covers the entire button area */}
                <Link
                    href={destinationHref}
                    className="absolute inset-0 rounded-lg"
                    aria-label={displayTitle}
                />
                {/* Text — sits above the link */}
                <span className="relative z-[1] flex-1 min-w-0 flex items-center overflow-hidden pointer-events-none">
                    <span
                        className={`text-[14px] truncate leading-none block min-w-0 ${isActive ? "font-medium" : "font-normal"}`}
                        style={{ fontFamily: "var(--font-inter)", color: isActive ? "var(--base-700)" : "#5a5a5a" }}
                    >
                        <ChatTitleMarkdown text={displayTitle} className="inline align-middle" />
                    </span>
                </span>
                {(hovering || menuOpen) && (
                    <div className="relative z-[2] shrink-0">
                        <button
                            ref={dotsRef}
                            type="button"
                            onClick={(e) => { e.preventDefault(); setMenuOpen((o) => !o); }}
                            className={`w-7 h-6 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                                isActive ? "bg-[#ddd9d4] hover:bg-[#d0ccc6]" : "bg-[#f0eeeb] hover:bg-[#e6e4e0]"
                            }`}
                            aria-label="More options"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-[18px] h-[18px]" style={{ color: "#0d0d0d" }}>
                                <circle cx="5" cy="12" r="2" />
                                <circle cx="12" cy="12" r="2" />
                                <circle cx="19" cy="12" r="2" />
                            </svg>
                        </button>
                        <AnimatePresence>
                            {menuOpen && (
                                <motion.div
                                    ref={menuRef}
                                    initial={{ opacity: 0, scale: 0.96, y: -4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.96, y: -4 }}
                                    transition={{ duration: 0.1, ease: [0.22, 1, 0.36, 1] }}
                                    className="absolute right-0 top-6 z-50 rounded-[16px] border border-[var(--base-200)] p-[6px] shadow-[0_12px_32px_rgba(15,23,42,0.10)] min-w-[140px]"
                                    style={{ backgroundColor: "var(--panel-bg)", fontFamily: "var(--font-inter)" }}
                                >
                                    <div className="flex flex-col gap-0">
                                        <button
                                            type="button"
                                            onClick={() => { setMenuOpen(false); setShowRename(true); }}
                                            className="w-full min-h-6 rounded-[10px] px-[10px] py-[6px] flex items-center gap-[6px] text-left text-[14px] text-[var(--base-800)] hover:bg-[var(--base-100)] transition-all duration-150 cursor-pointer"
                                        >
                                            <IconPencil className="w-5 h-5 shrink-0 text-[var(--base-600)]" />
                                            Rename
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setMenuOpen(false); onStar(session.id, !session.starred); }}
                                            className="w-full min-h-6 rounded-[10px] px-[10px] py-[6px] flex items-center gap-[6px] text-left text-[14px] text-[var(--base-800)] hover:bg-[var(--base-100)] transition-all duration-150 cursor-pointer"
                                        >
                                            <IconStar className="w-5 h-5 shrink-0 text-[var(--base-600)]" filled={session.starred} />
                                            {session.starred ? "Unstar" : "Star"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setMenuOpen(false); setShowDeleteConfirm(true); }}
                                            className="w-full min-h-6 rounded-[10px] px-[10px] py-[6px] flex items-center gap-[6px] text-left text-[14px] text-[#E02E2A] hover:bg-[#E02E2A]/5 transition-all duration-150 cursor-pointer"
                                        >
                                            <IconTrash className="w-5 h-5 shrink-0" />
                                            Delete
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>
            {showRename && (
                <RenameModal
                    current={displayTitle}
                    onSave={(t) => { onRename(session.id, t); setShowRename(false); }}
                    onClose={() => setShowRename(false)}
                />
            )}
            {showDeleteConfirm && (
                <DeleteConfirmModal
                    title={displayTitle}
                    onConfirm={() => onDelete(session.id)}
                    onClose={() => setShowDeleteConfirm(false)}
                />
            )}
        </>
    );
}

export default function DashboardShell({ children, user, headerTitle, headerBreadcrumb, fullHeightContent }: DashboardShellProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [activeNav, setActiveNav] = useState<string>("ai-tutor");
    const prevNavRef = useRef("ai-tutor");
    const { sessionId: activeSessionCtx, endSession, toggleLearnSidebar, learnSidebarOpen } = useTutoringSession();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const pathname = usePathname();
    // Read dynamic breadcrumb set by pages inside the (dashboard) route group.
    // Falls back to the headerBreadcrumb prop for pages outside the group.
    const { breadcrumb: contextBreadcrumb } = useDashboardHeader();
    const isAskSessionRoute = pathname?.startsWith("/chat/") || pathname?.startsWith("/portal/chat/");
    const isLearnSessionRoute = pathname?.includes('/session/') ?? false;
    const isDiagnosticRoute = pathname?.includes('/diagnostic/') ?? false;

    const mobileLayout = useSyncExternalStore(
        subscribeDashboardMobile,
        getDashboardMobileSnapshot,
        () => false,
    );
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

    useEffect(() => {
        router.prefetch("/learn");
        router.prefetch("/ask");
        router.prefetch("/study");
        router.prefetch("/planner");
        router.prefetch("/analytics");
        router.prefetch("/friends");
    }, [router]);

    useEffect(() => {
        if (!mobileLayout) setMobileDrawerOpen(false);
    }, [mobileLayout]);

    useEffect(() => {
        setMobileDrawerOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!mobileDrawerOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMobileDrawerOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [mobileDrawerOpen]);

    const navRailOnly = !mobileLayout && collapsed;
    const navShowLabels = mobileLayout || !collapsed;

    // Search modal
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    // Shortcut badge: ⌘K on Mac, Ctrl K on Windows/Linux, hidden on touch-only devices
    const [shortcutLabel, setShortcutLabel] = useState<string | null>(null);
    useEffect(() => {
        if (!window.matchMedia("(pointer: fine)").matches) return;
        const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent) && !/Windows/.test(navigator.userAgent);
        setShortcutLabel(isMac ? "⌘K" : "Ctrl K");
    }, []);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setIsSearchOpen((v) => {
                    if (!v) track("nav_search_opened", { trigger: "keyboard" });
                    return !v;
                });
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Splash screen — visible immediately on first bundle load, skipped on client-side navigations
    const [showSplash, setShowSplash] = useState(!splashShownThisLoad);
    const [splashMessage, setSplashMessage] = useState(SPLASH_MESSAGES[0]);
    useLayoutEffect(() => {
        if (splashShownThisLoad) return;
        setSplashMessage(SPLASH_MESSAGES[(Math.random() * SPLASH_MESSAGES.length) | 0]);
    }, []);
    useEffect(() => {
        if (splashShownThisLoad) return; // already played this session
        const dismiss = () => setShowSplash(false);
        // Primary dismiss at 1250ms
        const t1 = setTimeout(dismiss, 1250);
        // Safety net: force-close if animation or timer gets stuck (tab sleep, etc.)
        const t2 = setTimeout(dismiss, 3000);
        // Mark after scheduling so a double-invoke (dev StrictMode) doesn't skip timers
        splashShownThisLoad = true;
        return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Derive current mode from pathname for sidebar session filtering
    const currentMode: "learn" | "ask" = (
        pathname === "/ask" ||
        pathname?.startsWith("/chat/") ||
        pathname?.startsWith("/ask/")
    ) ? "ask" : "learn";

    // Recents — SWR-backed: deduplication, focus revalidation, cross-tab sync.
    const {
        sessions: recents,
        loaded: recentsLoaded,
        hasMore: hasMoreSessions,
        loadingMore: loadingMoreSessions,
        loadMore: loadMoreSessions,
        invalidate: invalidateRecents,
    } = useRecentSessions(currentMode);
    const sidebarScrollRef = useRef<HTMLDivElement>(null);

    // Chat header context (set by DashboardContent via a useEffect + custom event)
    const [chatHeader, setChatHeader] = useState<{
        sessionId: string;
        title: string;
        starred: boolean;
    } | null>(null);

    // Feedback modals
    const [sessionRatingModal, setSessionRatingModal] = useState<{ open: boolean; sessionId: string | null }>({ open: false, sessionId: null });
    const [generalFeedbackOpen, setGeneralFeedbackOpen] = useState(false);

    // Auto-open general feedback once per browser, after eligible visible usage (~5 min).
    const blockAutoFeedbackRef = useRef(false);
    const eligibleAccumMsRef = useRef(0);
    useEffect(() => {
        const onFeedbackPath = pathname?.includes("/feedback") ?? false;
        blockAutoFeedbackRef.current =
            showSplash ||
            isSearchOpen ||
            sessionRatingModal.open ||
            generalFeedbackOpen ||
            onFeedbackPath;
    }, [showSplash, isSearchOpen, sessionRatingModal.open, generalFeedbackOpen, pathname]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (readAutoFeedbackAlreadyShown()) return;

        const tickMs = 1000;
        const id = window.setInterval(() => {
            if (document.visibilityState !== "visible") return;
            if (blockAutoFeedbackRef.current) return;

            eligibleAccumMsRef.current += tickMs;
            if (eligibleAccumMsRef.current < AUTO_FEEDBACK_ONCE_MS) return;

            writeLastAutoFeedbackPromptAt(Date.now());
            track("feedback_prompt_auto_shown", {});
            setGeneralFeedbackOpen(true);
            window.clearInterval(id);
        }, tickMs);
        return () => window.clearInterval(id);
    }, []);

    // Sidebar scroll → load more sessions when near bottom
    useEffect(() => {
        const el = sidebarScrollRef.current;
        if (!el) return;
        const onScroll = () => {
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
                loadMoreSessions();
            }
        };
        el.addEventListener("scroll", onScroll, { passive: true });
        return () => el.removeEventListener("scroll", onScroll);
    }, [loadMoreSessions]);

    // Listen for chat-header-update events dispatched by DashboardContent
    useEffect(() => {
        const handler = (e: CustomEvent<{ sessionId: string; title: string; starred: boolean }>) => {
            setChatHeader(e.detail);
            // Immediately refetch so the renamed/new title appears in the sidebar.
            invalidateRecentSessions(currentMode);
        };
        window.addEventListener("chat-header-update" as string, handler as EventListener);
        return () => window.removeEventListener("chat-header-update" as string, handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentMode]);

    // Derive active session from URL (supports both /chat/:id and /learn/.../session/:id)
    const urlSessionId = pathname?.startsWith("/chat/")
        ? pathname.split("/chat/")[1]
        : pathname?.includes("/session/")
        ? pathname.split("/session/")[1]
        : null;

    useEffect(() => {
        if (!pathname) return;
        if (pathname === "/portal/study" || pathname === "/study") setActiveNav("study-feed");
        else if (pathname === "/friends" || pathname === "/portal/friends") setActiveNav("friends");
        else if (pathname === "/analytics" || pathname === "/portal/analytics") setActiveNav("analytics");
        else if (pathname === "/portal/planner" || pathname === "/planner" || pathname?.startsWith("/portal/planner") || pathname?.startsWith("/planner")) {
            setActiveNav("planner");
        } else if (
            pathname === "/dashboard" ||
            pathname === "/portal/dashboard" ||
            pathname === "/learn" ||
            pathname === "/portal/learn" ||
            pathname.startsWith("/learn/") ||
            pathname.startsWith("/portal/learn/") ||
            pathname.startsWith("/ask") ||
            pathname.startsWith("/portal/ask") ||
            pathname.startsWith("/chat/") ||
            pathname.startsWith("/portal/chat/")
        ) {
            setActiveNav("ai-tutor");
        }
    }, [pathname]);

    useEffect(() => {
        if (prevNavRef.current === "ai-tutor" && activeNav !== "ai-tutor" && activeSessionCtx) {
            endSession(activeSessionCtx);
        }
        prevNavRef.current = activeNav;
    }, [activeNav, activeSessionCtx, endSession]);

    // Lock page-level scroll on the portal so only inner containers scroll
    useEffect(() => {
        const html = document.documentElement;
        const prev = html.style.overflow;
        html.style.overflow = "hidden";
        return () => { html.style.overflow = prev; };
    }, []);

    const displayName = getDisplayName(user);
    const sidebarFirstName = getSidebarFirstName(displayName);

    const isStudyRoute = pathname === "/portal/study" || pathname === "/study";
    const isAskHomeRoute = pathname === "/ask" || pathname === "/portal/ask";
    const isAnalyticsRoute = pathname === "/analytics" || pathname === "/portal/analytics";
    const isPlannerRoute =
        pathname === "/portal/planner" ||
        pathname === "/planner" ||
        pathname?.startsWith("/portal/planner") ||
        pathname?.startsWith("/planner");

    const buttonColorDefault = "#666666";
    const buttonColorActive = "var(--base-600)";
    const sectionHeadingColor = "#737373";
    const getButtonColor = (id: string) => (activeNav === id ? buttonColorActive : buttonColorDefault);

    const handleRename = async (id: string, title: string) => {
        await fetch("/api/tutor/session/rename", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ session_id: id, title }),
        });
        invalidateRecents();
        if (chatHeader?.sessionId === id) {
            setChatHeader((prev) => prev ? { ...prev, title } : prev);
            window.dispatchEvent(new CustomEvent("chat-header-update", { detail: { sessionId: id, title, starred: chatHeader.starred } }));
        }
    };

    const handleStar = async (id: string, starred: boolean) => {
        await fetch("/api/tutor/session/star", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ session_id: id, starred }),
        });
        invalidateRecents();
        if (chatHeader?.sessionId === id) {
            setChatHeader((prev) => prev ? { ...prev, starred } : prev);
        }
    };

    const handleDelete = async (id: string) => {
        await fetch("/api/tutor/session/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ session_id: id }),
        });
        invalidateRecents();
        if (urlSessionId === id) {
            router.push("/ask");
        }
        if (chatHeader?.sessionId === id) {
            setChatHeader(null);
        }
    };

    const activeHeaderSession: { id: string; title: string; starred: boolean } | null = chatHeader
        ? { id: chatHeader.sessionId, title: chatHeader.title, starred: chatHeader.starred }
        : urlSessionId
            ? (() => {
                const s = recents.find((r) => r.id === urlSessionId);
                if (s) return { id: s.id, title: s.title ?? s.subject ?? "Untitled", starred: s.starred };
                // Prefer context breadcrumb (from (dashboard) pages) then prop breadcrumb
                const crumbs = contextBreadcrumb ?? headerBreadcrumb;
                const lastCrumb =
                    crumbs && crumbs.length > 0
                        ? crumbs[crumbs.length - 1]
                        : null;
                const fallbackTitle = lastCrumb?.label?.trim() || "Tutor session";
                return { id: urlSessionId, title: fallbackTitle, starred: false };
            })()
            : null;

    /** Session id for sharing — URL wins when recents have not loaded yet. */
    const shareSessionId =
        urlSessionId ?? activeHeaderSession?.id ?? (chatHeader?.sessionId ?? null);

    // Resolve breadcrumb: context wins (set by pages inside (dashboard) group),
    // falls back to the prop (used by pages outside the group like sessions, diagnostic).
    const resolvedBreadcrumb = contextBreadcrumb ?? headerBreadcrumb ?? null;

    const showStackedLearnBreadcrumb = false;

    const showStackedMobileLearnHeader = false;

    /** Learn chat uses breadcrumbs (not ChatTitleDropdown); cap widths on small viewports so long chapter titles ellipsize earlier. */
    const compactLearnSessionBreadcrumb = mobileLayout && isLearnSessionRoute;


    return (
        <>
        <SearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            recentSessions={recents}
        />
        <SessionRatingModal
            open={sessionRatingModal.open}
            sessionId={sessionRatingModal.sessionId}
            onClose={() => {
                setSessionRatingModal({ open: false, sessionId: null });
                router.back();
            }}
        />
        <GeneralFeedbackModal
            open={generalFeedbackOpen}
            grade={user?.user_metadata?.grade ?? null}
            onClose={() => setGeneralFeedbackOpen(false)}
        />
        <AnimatePresence>
            {showSplash && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-0"
                    style={{ backgroundColor: "#f3f3f3", animation: "splashForceDismiss 0s 4s forwards" }}
                >
                    {/* Logo: blurry + small → sharp + full size */}
                    <motion.div
                        initial={{ opacity: 0, filter: "blur(14px)", scale: 0.86 }}
                        animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                    >
                        <Image
                            src="/lerno.webp"
                            alt="Lerno"
                            width={188}
                            height={60}
                            unoptimized
                            priority
                        />
                    </motion.div>
                    {/* Tagline: starts right when logo finishes (0.05 + 0.65 = 0.7) */}
                    <motion.p
                        initial={{ opacity: 0, filter: "blur(10px)", scale: 0.94 }}
                        animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.7 }}
                        style={{
                            fontFamily: "var(--font-inter)",
                            color: "#1a1a1a",
                            fontSize: 16,
                            fontWeight: 400,
                            letterSpacing: "0.01em",
                            marginTop: -4,
                            textAlign: "center",
                            maxWidth: "80vw",
                        }}
                    >
                        {splashMessage}
                    </motion.p>
                </motion.div>
            )}
        </AnimatePresence>
        <div className="h-dvh overflow-hidden flex flex-col p-2 min-[480px]:p-2.5 bg-[#fafafa] transition-colors duration-200">
            {mobileLayout && mobileDrawerOpen && (
                <button
                    type="button"
                    aria-label="Close navigation menu"
                    className="fixed inset-0 z-[95] bg-slate-900/40 cursor-default border-0 p-0"
                    onClick={() => setMobileDrawerOpen(false)}
                />
            )}
            <div className="flex-1 flex min-h-0 max-h-[calc(100dvh-16px)] min-[480px]:max-h-[calc(100dvh-20px)] gap-0 min-[480px]:gap-1.5">
                {/* ─── Sidebar (in-flow on lg+, slide-over drawer on small screens) ─── */}
                <aside
                    id="dashboard-sidebar"
                    className={
                        mobileLayout
                            ? `flex flex-col py-2 overflow-hidden bg-[#fafafa] fixed left-0 top-0 bottom-0 z-[100] w-[min(288px,calc(100vw-20px))] shadow-[4px_0_32px_rgba(15,23,42,0.12)] transition-transform duration-200 ease-out pl-[2px] pr-2 ${
                                  mobileDrawerOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
                              }`
                            : `flex-shrink-0 flex flex-col py-2 transition-[width] duration-200 ease-out overflow-hidden ${
                                  collapsed ? "w-[56px] px-2" : "w-[256px] pl-[2px] pr-2"
                              }`
                    }
                    aria-hidden={mobileLayout && !mobileDrawerOpen}
                >
                    {/* Logo + collapse / close — sticky, outside scroll container */}
                    <div className={`flex items-center shrink-0 mt-2 mb-4 mr-1 ${navRailOnly ? "justify-center" : "justify-between pl-3 pr-1"}`}>
                        {!navRailOnly && (
                            <Link
                                href="/learn"
                                className="flex items-center shrink-0 overflow-hidden w-[50%] justify-start min-w-0"
                                onClick={() => mobileLayout && setMobileDrawerOpen(false)}
                            >
                                <Image src="/lerno.webp" alt="Lerno" width={88} height={28} className="h-auto w-full object-contain object-left drop-shadow-[0_1px_1px_rgba(0,0,0,0.08)]" unoptimized />
                            </Link>
                        )}
                        {mobileLayout ? (
                            <button
                                type="button"
                                onClick={() => setMobileDrawerOpen(false)}
                                className="p-1.5 rounded-md text-[var(--base-700)] hover:bg-[#efefef] transition-colors shrink-0 cursor-pointer"
                                aria-label="Close navigation menu"
                            >
                                <IconCloseNav className="w-5 h-5" />
                            </button>
                        ) : (
                            <TooltipHint label={collapsed ? "Expand sidebar" : "Collapse sidebar"} side="bottom">
                                <button
                                    type="button"
                                    onClick={() => setCollapsed((c) => { track("nav_sidebar_toggled", { collapsed: !c }); return !c; })}
                                    className="p-1 rounded-md text-[var(--base-700)] hover:bg-[#efefef] transition-colors shrink-0 cursor-pointer"
                                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                                >
                                    <PanelLeftIcon className="w-5 h-5" />
                                </button>
                            </TooltipHint>
                        )}
                    </div>

                    <div className="relative flex-1 min-h-0">
                    {!navRailOnly && (
                        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-14 z-10" style={{ background: "linear-gradient(to bottom, transparent, var(--page-bg))" }} />
                    )}
                    <div ref={sidebarScrollRef} className="flex flex-col h-full overflow-y-auto overflow-x-hidden scrollbar-none">
                        <div style={{ direction: "ltr" }}>
                            <div className="flex flex-col shrink-0 mt-8">
                                {/* Features */}
                                <p className={`text-xs font-semibold mb-2 pl-3 ${navRailOnly ? "invisible" : ""}`} style={{ fontFamily: "var(--font-inter)", color: sectionHeadingColor }}>Features</p>
                                <div className="flex flex-col gap-1 shrink-0">
                                    {navItems.map(({ id, label, Icon }) => {
                                        const isSoon = id === "material";
                                        const onNavClick = () => {
                                            if (isSoon) return;
                                            track("nav_item_clicked", { item: id });
                                            setActiveNav(id);
                                            if (mobileLayout) setMobileDrawerOpen(false);
                                            if (id === "study-feed") { startTopLoader(); startTransition(() => router.push("/study")); }
                                            else if (id === "ai-tutor") { startTopLoader(); startTransition(() => router.push("/learn")); }
                                            else if (id === "planner") { startTopLoader(); startTransition(() => router.push("/planner")); }
                                        };
                                        const btn = (
                                            <button
                                                type="button"
                                                className={`w-full flex items-center h-9 text-left transition-all duration-200 ease-out shrink-0 rounded-full border-none ${
                                                    navRailOnly ? "justify-center px-0" : "gap-2.5 px-3"
                                                } ${
                                                    isSoon
                                                        ? "opacity-40 cursor-default"
                                                        : `cursor-pointer ${activeNav === id ? "bg-[#e8e8e8] font-medium" : "bg-transparent font-normal hover:bg-[#efefef]"}`
                                                }`}
                                                onClick={onNavClick}
                                                disabled={isSoon}
                                                aria-disabled={isSoon}
                                                style={{ color: getButtonColor(id) }}
                                            >
                                                <span className="w-4 h-4 shrink-0 flex items-center justify-center relative" style={{ color: getButtonColor(id) }}>
                                                    <Icon className="w-full h-full" />
                                                </span>
                                                {navShowLabels && (
                                                    <>
                                                        <span className="truncate text-[15px]" style={{ fontFamily: "var(--font-inter)", color: getButtonColor(id) }}>{label}</span>
                                                        {isSoon && (
                                                            <span
                                                                className="ml-auto shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                                                style={{ fontFamily: "var(--font-inter)", backgroundColor: "var(--base-200)", color: "var(--base-500)" }}
                                                            >
                                                                Soon
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                            </button>
                                        );
                                        return navRailOnly
                                            ? (
                                                <TooltipHint key={id} label={isSoon ? `${label} — coming soon` : label} side="right">
                                                    {btn}
                                                </TooltipHint>
                                            )
                                            : <React.Fragment key={id}>{btn}</React.Fragment>;
                                    })}
                                </div>

                                {/* Actions */}
                                <p className={`text-xs font-semibold mb-2 mt-6 pl-3 ${navRailOnly ? "invisible" : ""}`} style={{ fontFamily: "var(--font-inter)", color: sectionHeadingColor }}>Actions</p>
                                <div className="flex flex-col gap-0 shrink-0">
                                    {[
                                        { id: "new-session", label: "New session", Icon: IconAdd, onClick: () => { track("nav_new_session"); startTopLoader(); startTransition(() => router.push("/ask")); } },
                                        { id: "search-chats", label: "Search", Icon: IconSearch, onClick: () => { track("nav_search_opened", { trigger: "button" }); setIsSearchOpen(true); } },
                                    ].map(({ id, label, Icon, onClick }) => {
                                        const btn = (
                                            <button
                                                type="button"
                                                className={`w-full flex items-center h-9 text-left transition-all duration-200 ease-out shrink-0 rounded-full border-none cursor-pointer bg-transparent font-normal hover:bg-[#efefef] ${
                                                    navRailOnly ? "justify-center px-0" : "gap-2.5 px-3"
                                                }`}
                                                onClick={() => {
                                                    if (mobileLayout) setMobileDrawerOpen(false);
                                                    onClick();
                                                }}
                                                style={{ color: buttonColorDefault }}
                                            >
                                                <span className="w-4 h-4 shrink-0 flex items-center justify-center" style={{ color: buttonColorDefault }}>
                                                    <Icon className="w-full h-full" />
                                                </span>
                                                {navShowLabels && (
                                                    <>
                                                        <span className="truncate text-[14px]" style={{ fontFamily: "var(--font-inter)", color: buttonColorDefault }}>{label}</span>
                                                        {id === "search-chats" && shortcutLabel && (
                                                            <span className="ml-auto shrink-0 text-[10px] rounded px-1 py-0.5" style={{ fontFamily: "var(--font-inter)", border: "1px solid var(--base-300)", backgroundColor: "var(--base-200)", color: "var(--base-500)" }}>{shortcutLabel}</span>
                                                        )}
                                                    </>
                                                )}
                                            </button>
                                        );
                                        return navRailOnly
                                            ? <TooltipHint key={id} label={label} side="right">{btn}</TooltipHint>
                                            : <React.Fragment key={id}>{btn}</React.Fragment>;
                                    })}
                                </div>

                                {/* Skeleton — shown while loading */}
                                {!navRailOnly && !recentsLoaded && (
                                    <>
                                        <p className="text-xs font-semibold mb-2 mt-6 pl-3" style={{ fontFamily: "var(--font-inter)", color: sectionHeadingColor }}>Recents</p>
                                        <div className="flex flex-col gap-1 px-1">
                                            {Array.from({ length: 6 }).map((_, i) => (
                                                <div key={i} className="flex items-center gap-2 px-2 h-9">
                                                    <div className="skeleton w-4 h-4 shrink-0" style={{ borderRadius: 4 }} />
                                                    <div className="skeleton h-3 rounded" style={{ width: `${60 + (i % 3) * 12}%` }} />
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                                {/* Starred */}
                                {!navRailOnly && recentsLoaded && recents.some((s) => s.starred) && (
                                    <>
                                        <p className="text-xs font-semibold mb-2 mt-6 pl-3" style={{ fontFamily: "var(--font-inter)", color: sectionHeadingColor }}>Starred</p>
                                        <div className="flex flex-col gap-0.5">
                                            {recents.filter((s) => s.starred).map((session) => (
                                                <RecentChatItem
                                                    key={session.id}
                                                    session={session}
                                                    isActive={urlSessionId === session.id}
                                                    onRename={handleRename}
                                                    onStar={handleStar}
                                                    onDelete={handleDelete}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}
                                {/* Recents */}
                                {!navRailOnly && recentsLoaded && recents.some((s) => !s.starred) && (
                                    <>
                                        <p className="text-xs font-semibold mb-2 mt-6 pl-3" style={{ fontFamily: "var(--font-inter)", color: sectionHeadingColor }}>Recents</p>
                                        <div className="flex flex-col gap-0.5">
                                            {recents.filter((s) => !s.starred).map((session) => (
                                                <RecentChatItem
                                                    key={session.id}
                                                    session={session}
                                                    isActive={urlSessionId === session.id}
                                                    onRename={handleRename}
                                                    onStar={handleStar}
                                                    onDelete={handleDelete}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}
                                {/* Load-more skeleton rows */}
                                {!navRailOnly && loadingMoreSessions && (
                                    <div className="flex flex-col gap-1 px-1 mt-1">
                                        {Array.from({ length: 3 }).map((_, i) => (
                                            <div key={i} className="flex items-center gap-2 px-2 h-9">
                                                <div className="skeleton w-4 h-4 shrink-0" style={{ borderRadius: 4 }} />
                                                <div className="skeleton h-3 rounded" style={{ width: `${55 + (i % 3) * 14}%` }} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* bottom padding so last items clear the fade */}
                        <div className="h-14 shrink-0" />
                    </div>
                    </div>

                    <div className={`shrink-0 pb-2 pt-4 ${navRailOnly ? "" : "pl-0"}`}>
                        <SidebarAccountMenu
                            user={user}
                            collapsed={navRailOnly}
                            sidebarFirstName={sidebarFirstName}
                            onFeedback={() => setGeneralFeedbackOpen(true)}
                        />
                    </div>
                </aside>

                {/* ─── Main content ─── */}
                <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden" style={{ backgroundColor: "var(--page-bg)" }}>
                    <div className="relative flex-1 flex flex-col rounded-xl border-[0.5px] min-h-0 overflow-hidden shadow-sm" style={{ backgroundColor: "var(--panel-bg)", borderColor: "var(--base-300)" }}>
                        <AnimatePresence>
                            {isPending && (
                                <motion.div
                                    key="nav-progress"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute top-0 left-0 right-0 z-50 overflow-hidden pointer-events-none"
                                    style={{ height: 2, borderRadius: "12px 12px 0 0" }}
                                >
                                    <div
                                        className="h-full"
                                        style={{
                                            width: "60%",
                                            backgroundColor: "var(--primary-400)",
                                            animation: "nav-progress 1.4s ease-in-out infinite",
                                        }}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <PlannerHeaderProvider>
                        <StudyFeedHeaderMetricsProvider>
                            <header
                                className={`flex justify-between shrink-0 min-h-[50px] px-3 sm:px-6 border-b gap-2 sm:gap-4 ${
                                    showStackedMobileLearnHeader ? "items-start py-3 sm:py-4" : "items-center py-3 sm:py-4"
                                }`}
                                style={{ borderColor: "var(--base-300)" }}
                            >
                                <div
                                    className={`flex gap-2 flex-1 min-w-0 ${
                                        showStackedMobileLearnHeader ? "items-start" : "items-center"
                                    }`}
                                >
                                    {mobileLayout && (
                                        <button
                                            type="button"
                                            className="shrink-0 p-2 -ml-1 rounded-lg text-[var(--base-700)] hover:bg-[var(--base-100)] transition-colors cursor-pointer"
                                            aria-label="Open navigation menu"
                                            aria-expanded={mobileDrawerOpen}
                                            aria-controls="dashboard-sidebar"
                                            onClick={() => setMobileDrawerOpen(true)}
                                        >
                                            <IconMenu className="w-5 h-5" />
                                        </button>
                                    )}
                                    <div
                                        className={`relative flex-1 min-w-0 flex ${
                                            showStackedMobileLearnHeader ? "items-start" : "items-center"
                                        }`}
                                    >
                                    {isStudyRoute ? (
                                        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                                            <StudyFeedShellFilterButton />
                                            <StudyFeedShellRefreshButton />
                                        </div>
                                    ) : isPlannerRoute ? (
                                        <PlannerShellNavControls />
                                    ) : activeHeaderSession ? (
                                        <ChatTitleDropdown
                                            sessionId={activeHeaderSession.id}
                                            title={activeHeaderSession.title}
                                            starred={activeHeaderSession.starred}
                                            wrapTitle={false}
                                            compactTitleForLearnMobile={mobileLayout && isLearnSessionRoute}
                                            onRename={(title) => handleRename(activeHeaderSession.id, title)}
                                            onStar={(starred) => handleStar(activeHeaderSession.id, starred)}
                                            onDelete={() => handleDelete(activeHeaderSession.id)}
                                        />
                                    ) : resolvedBreadcrumb && resolvedBreadcrumb.length > 0 ? (
                                        mobileLayout && isDiagnosticRoute ? (
                                            <nav
                                                className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden"
                                                style={{ fontFamily: "var(--font-inter)" }}
                                                aria-label="Breadcrumb"
                                            >
                                                {resolvedBreadcrumb![0]?.href ? (
                                                    <Link
                                                        href={resolvedBreadcrumb![0].href}
                                                        className="text-[14px] shrink-0 truncate max-w-[min(200px,46vw)] transition-colors hover:opacity-80"
                                                        style={{ color: "var(--base-400)" }}
                                                        title={resolvedBreadcrumb![0].label}
                                                    >
                                                        {resolvedBreadcrumb![0].label}
                                                    </Link>
                                                ) : (
                                                    <span
                                                        className="text-[14px] shrink-0 truncate max-w-[min(200px,46vw)]"
                                                        style={{ color: "var(--base-400)" }}
                                                    >
                                                        {resolvedBreadcrumb![0]?.label}
                                                    </span>
                                                )}
                                                <span className="text-[13px] select-none shrink-0" style={{ color: "var(--base-300)" }} aria-hidden>
                                                    ›
                                                </span>
                                                <span
                                                    className="text-[14px] font-medium truncate min-w-0"
                                                    style={{ color: "var(--base-700)" }}
                                                >
                                                    Quick check
                                                </span>
                                            </nav>
                                        ) : showStackedLearnBreadcrumb ? (
                                            <div className="min-w-0 flex-1 flex flex-col gap-1 pr-1" style={{ fontFamily: "var(--font-inter)" }}>
                                                {resolvedBreadcrumb!.length > 1 && (
                                                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] min-w-0">
                                                        {resolvedBreadcrumb!.slice(0, -1).map((crumb, i) => (
                                                            <React.Fragment key={i}>
                                                                {i > 0 && (
                                                                    <span className="text-[13px] select-none shrink-0" style={{ color: "var(--base-300)" }}>›</span>
                                                                )}
                                                                {crumb.href ? (
                                                                    <Link
                                                                        href={crumb.href}
                                                                        className="text-[13px] sm:text-[14px] transition-colors hover:opacity-80 shrink-0 max-w-[min(160px,50vw)] truncate"
                                                                        style={{ color: "var(--base-400)" }}
                                                                        title={crumb.label}
                                                                    >
                                                                        {crumb.label}
                                                                    </Link>
                                                                ) : (
                                                                    <span
                                                                        className="text-[13px] sm:text-[14px] shrink-0 max-w-[min(160px,50vw)] truncate"
                                                                        style={{ color: "var(--base-400)" }}
                                                                        title={crumb.label}
                                                                    >
                                                                        {crumb.label}
                                                                    </span>
                                                                )}
                                                            </React.Fragment>
                                                        ))}
                                                    </div>
                                                )}
                                                {(() => {
                                                    const last = resolvedBreadcrumb![resolvedBreadcrumb!.length - 1];
                                                    if (last.href) {
                                                        return (
                                                            <Link
                                                                href={last.href}
                                                                className="text-[14px] font-medium break-words text-left leading-snug min-w-0"
                                                                style={{ color: "var(--base-700)" }}
                                                                title={last.label}
                                                            >
                                                                {last.label}
                                                            </Link>
                                                        );
                                                    }
                                                    return (
                                                        <span
                                                            className="text-[14px] font-medium break-words text-left leading-snug min-w-0 [overflow-wrap:anywhere]"
                                                            style={{ color: "var(--base-700)" }}
                                                            title={last.label}
                                                        >
                                                            {last.label}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        ) : (
                                        <nav
                                            className={`flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden ${
                                                compactLearnSessionBreadcrumb ? "max-w-[min(100%,calc(100vw-8rem))]" : ""
                                            }`}
                                            style={{ fontFamily: "var(--font-inter)" }}
                                        >
                                            {resolvedBreadcrumb!.map((crumb, i) => {
                                                const isLast = i === resolvedBreadcrumb!.length - 1;
                                                const crumbClass = isLast
                                                    ? compactLearnSessionBreadcrumb
                                                        ? "min-w-0 flex-1 truncate text-left max-w-[min(140px,calc(100vw-10.5rem),32vw)]"
                                                        : "min-w-0 flex-1 truncate text-left"
                                                    : "shrink-0 max-w-[42%] truncate";
                                                return (
                                                    <React.Fragment key={i}>
                                                        {i > 0 && (
                                                            <span className="text-[13px] select-none shrink-0" style={{ color: "var(--base-300)" }}>›</span>
                                                        )}
                                                        {crumb.href ? (
                                                            <Link
                                                                href={crumb.href}
                                                                className={`text-[14px] transition-colors hover:opacity-80 ${crumbClass}`}
                                                                style={{ color: "var(--base-400)" }}
                                                                title={crumb.label}
                                                            >
                                                                {crumb.label}
                                                            </Link>
                                                        ) : (
                                                            <span
                                                                className={`text-[14px] font-medium ${crumbClass}`}
                                                                style={{ color: "var(--base-700)" }}
                                                                title={crumb.label}
                                                            >
                                                                {crumb.label}
                                                            </span>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </nav>
                                        )
                                    ) : headerTitle ? (
                                        <p
                                            className="text-[15px] font-medium"
                                            style={{ fontFamily: "var(--font-inter)", color: "var(--base-700)" }}
                                        >
                                            {headerTitle}
                                        </p>
                                    ) : (
                                        <div />
                                    )}
                                    </div>
                                </div>

                                {isStudyRoute ? (
                                    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                                        <StudyFeedShellHeaderRight />
                                        <TooltipHint label="Feedback" side="bottom">
                                            <button
                                                type="button"
                                                onClick={() => activeHeaderSession ? setSessionRatingModal({ open: true, sessionId: activeHeaderSession.id }) : setGeneralFeedbackOpen(true)}
                                                className="size-9 rounded-xl flex items-center justify-center text-[var(--base-500)] hover:bg-[var(--base-100)] transition-colors cursor-pointer shrink-0"
                                                aria-label="Send feedback"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                                    <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/>
                                                </svg>
                                            </button>
                                        </TooltipHint>
                                        {!isAnalyticsRoute && (
                                            <DashboardHeaderAnalyticsButton
                                                mobileLayout={mobileLayout}
                                                onNavigate={() => { track("nav_analytics_clicked"); startTopLoader(); startTransition(() => router.push("/analytics")); }}
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <div
                                        className={`flex shrink-0 gap-1.5 sm:gap-3 ${
                                            showStackedMobileLearnHeader ? "items-start pt-0.5" : "items-center"
                                        }`}
                                    >
                                        {shareSessionId && (
                                            <TooltipHint label="Share tutor session" side="bottom">
                                                <div className="flex shrink-0 items-center">
                                                    <ShareButton
                                                        resourceType="session"
                                                        resourceId={shareSessionId}
                                                        variant="icon"
                                                    />
                                                </div>
                                            </TooltipHint>
                                        )}
                                        {!isAnalyticsRoute && !(mobileLayout && (isAskSessionRoute || isLearnSessionRoute)) && (
                                            <StreakBadge
                                                splashActive={showSplash}
                                                size={mobileLayout ? "sm" : "md"}
                                            />
                                        )}
                                        <TooltipHint label="Feedback" side="bottom">
                                            <button
                                                type="button"
                                                onClick={() => activeHeaderSession ? setSessionRatingModal({ open: true, sessionId: activeHeaderSession.id }) : setGeneralFeedbackOpen(true)}
                                                className="size-9 rounded-xl flex items-center justify-center text-[var(--base-500)] hover:bg-[var(--base-100)] transition-colors cursor-pointer shrink-0"
                                                aria-label="Send feedback"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                                    <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/>
                                                </svg>
                                            </button>
                                        </TooltipHint>
                                        {!isAnalyticsRoute && (
                                            <DashboardHeaderAnalyticsButton
                                                mobileLayout={mobileLayout}
                                                onNavigate={() => { track("nav_analytics_clicked"); startTopLoader(); startTransition(() => router.push("/analytics")); }}
                                            />
                                        )}
                                        {isLearnSessionRoute && (
                                            <TooltipHint label={learnSidebarOpen ? "Close chapter panel" : "Open chapter panel"}>
                                                <button
                                                    type="button"
                                                    onClick={toggleLearnSidebar}
                                                    className={`size-9 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer ${
                                                        learnSidebarOpen
                                                            ? "bg-[var(--base-200)] text-[var(--base-700)]"
                                                            : "bg-transparent text-[var(--base-500)] hover:bg-[var(--base-100)]"
                                                    }`}
                                                    aria-label="Toggle chapter panel"
                                                >
                                                    <PanelLeftIcon className="w-5 h-5" mirror />
                                                </button>
                                            </TooltipHint>
                                        )}
                                    </div>
                                )}
                            </header>
                            <div
                                className={
                                    isStudyRoute || isAskHomeRoute || isAskSessionRoute || fullHeightContent
                                        ? "flex-1 min-h-0 overflow-hidden flex flex-col"
                                        : "flex-1 min-h-0 overflow-auto"
                                }
                            >
                                {children}
                            </div>
                        </StudyFeedHeaderMetricsProvider>
                        </PlannerHeaderProvider>
                    </div>
                </main>
            </div>
        </div>
        </>
    );
}
