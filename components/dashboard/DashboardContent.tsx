"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useImperativeHandle, useTransition } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ChevronDown, ChevronUp, Check, X, TriangleAlert, Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { startTopLoader } from "@/components/ui/TopLoader";
import { useTutoringSession } from "@/lib/tutoring-session-context";
import { hasStudyFeedPrefetchFresh, runStudyFeedWarmup } from "@/lib/study-feed-shared";
import {
    getAiTutorSubjectOptionsForGrade,
    CHAPTER_DATA_9,
    CHAPTER_DATA_11,
    CHAPTER_DATA_10,
    flattenChaptersToResources,
    SUBJECT_LABELS,
} from "@/lib/chapters";
import { generateSessionTitle } from "@/lib/tutor-title";
import { useStreamDisplayBuffer } from "@/lib/use-stream-display-buffer";
import { useTTS } from "@/lib/use-tts";
import { useSTT } from "@/lib/use-stt";
import { useMicDevices } from "@/lib/use-mic-devices";
import { VoiceRecordingBar, DictateButton } from "@/components/ui/VoiceRecordingBar";
import type { AttachmentMeta } from "@/lib/database.types";
import type { GraphArtifact } from "@/lib/graphs/types";
import { TooltipHint } from "@/components/ui/tooltip-hint";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { ThinkingBlock, type StepEvent, type ThinkingData } from "@/components/ui/ThinkingBlock";
import SubjectSelector from "@/components/learn/SubjectSelector";
import type { GeneratedDocument, QuizDocument } from "@/lib/ai/doc-types";
import { detectAskTaskTypeFromMessage } from "@/lib/tutor-detect-task";
import { DocumentPreviewPanel } from "@/components/ask/DocumentPreviewPanel";
import { QuizRenderer } from "@/components/ask/QuizRenderer";
import { track } from "@/lib/analytics";
import { refreshStreakAfterActivity } from "@/lib/streak-client";
import { getQuickPromptsForTask, type TaskKey } from "@/lib/quick-prompts";

const SUBJECT_FILTER_OPTIONS = [
    "All",
    "English",
    "Math",
    "Social Science",
    "French",
    "Hindi",
    "Science",
] as const;

/** All chapters from grades 9, 10, 11 for quick resources, deduplicated */
const QUICK_RESOURCES = (() => {
    const all = [
        ...flattenChaptersToResources(CHAPTER_DATA_9),
        ...flattenChaptersToResources(CHAPTER_DATA_10),
        ...flattenChaptersToResources(CHAPTER_DATA_11),
    ];
    return all.filter(
        (r, i, arr) =>
            arr.findIndex((x) => x.title === r.title && x.subjectId === r.subjectId) === i
    );
})();

const IconAdd = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);
const IconMic = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
    </svg>
);
const IconSend = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
    </svg>
);
const IconBook = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.25} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
);
const IconAttach = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
    </svg>
);
const IconTask = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
);
const IconExplanation = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
    </svg>
);
const IconNotes = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
);
const IconQuiz = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
    </svg>
);
const IconSummary = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
);
const IconEdit = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
        <path d="m15 5 4 4" />
    </svg>
);
const IconCopy = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
);
const IconThumbsUp = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
        <path d="M7 10v12" />
    </svg>
);
const IconThumbsDown = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
        <path d="M17 14V2" />
    </svg>
);
const IconCircleStop = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
);
const IconVolume2 = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
        <path d="M16 9a5 5 0 0 1 0 6" />
        <path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
    </svg>
);
const IconSpinner = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ animation: "spin 1s linear infinite" }}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);
const IconCheck = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M20 6 9 17l-5-5" />
    </svg>
);


/** Labels shown in the + button dropdown (short, canonical) */
const TASK_OPTIONS = ["Explanation", "Notes", "Quiz", "Summary"] as const;

/** Labels shown on quick-task buttons below the textbox (descriptive) */
const QUICK_TASK_LABELS = ["Explain a topic", "Make notes", "Generate a quiz", "Summarize a chapter"] as const;

/** Maps quick-task button label → backend task_type */
const QUICK_TASK_TO_BACKEND: Record<string, string> = {
    "Explain a topic": "explain",
    "Make notes": "notes",
    "Generate a quiz": "quiz",
    "Summarize a chapter": "summary",
};

/** Maps dropdown option label → backend task_type */
const TASK_TO_BACKEND: Record<string, string> = {
    Explanation: "explain",
    Notes: "notes",
    Quiz: "quiz",
    Summary: "summary",
};

/** Maps TASK_OPTIONS labels → TaskKey so the textbox task picker can drive quick prompts */
const TASK_OPTION_TO_QUICK_TASK_LABEL: Record<string, string> = {
    Explanation: "Explain a topic",
    Notes: "Make notes",
    Quiz: "Generate a quiz",
    Summary: "Summarize a chapter",
};

const TASK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    Explanation: IconExplanation,
    Notes: IconNotes,
    Quiz: IconQuiz,
    Summary: IconSummary,
    "Explain a topic": IconExplanation,
    "Make notes": IconNotes,
    "Generate a quiz": IconQuiz,
    "Summarize a chapter": IconSummary,
};

const ASK_MAX_CHARS = 2000;

const QUICK_TASKS = [...QUICK_TASK_LABELS];

/** Short labels for mobile task buttons */
const QUICK_TASK_SHORT: Record<string, string> = {
    "Explain a topic": "Explain",
    "Make notes": "Notes",
    "Generate a quiz": "Quiz",
    "Summarize a chapter": "Summary",
};


const GRADE_10_ASK_SUBJECT_OPTIONS: { id: string; label: string }[] = [
    { id: "science", label: SUBJECT_LABELS.science },
    { id: "math", label: SUBJECT_LABELS.math },
    { id: "social_geography", label: SUBJECT_LABELS.social_geography },
    { id: "social_history", label: SUBJECT_LABELS.social_history },
    { id: "social_civics", label: SUBJECT_LABELS.social_civics },
    { id: "social_economics", label: SUBJECT_LABELS.social_economics },
];

function getAskSubjectOptionsForGrade(grade: number): { id: string; label: string }[] {
    if (grade === 11) {
        return getAiTutorSubjectOptionsForGrade(11);
    }
    return GRADE_10_ASK_SUBJECT_OPTIONS;
}
const UTILITY_ICON_BUTTON_CLASS =
    "size-10 shrink-0 rounded-full flex items-center justify-center bg-transparent text-[var(--base-500)] transition-all duration-150 hover:bg-slate-200/60 active:scale-95 cursor-pointer";
const INPUT_PILL_BUTTON_CLASS =
    "h-10 px-4 rounded-full flex items-center gap-2 text-[14px] font-normal shrink-0 border border-[var(--base-200)] bg-white transition-all duration-150 active:scale-[0.98] cursor-pointer";

const MESSAGE_ACTION_BUTTON_CLASS =
    "size-8 shrink-0 rounded-md flex items-center justify-center bg-transparent text-[var(--base-500)] transition-all duration-150 hover:bg-slate-200/60 active:scale-95 cursor-pointer";

function EditMessageInline({
    value,
    onChange,
    onCancel,
    onSend,
}: {
    value: string;
    onChange: (v: string) => void;
    onCancel: () => void;
    onSend: () => void;
}) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        textareaRef.current?.focus();
    }, []);
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            const trimmed = value.trim();
            if (trimmed) onSend();
        }
    };
    return (
        <div
            className="flex flex-col w-full max-w-[85%] self-end rounded-2xl p-4 min-h-[80px]"
            style={{ backgroundColor: "#e6e6e6" }}
        >
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Edit message..."
                className="w-full min-h-[60px] max-h-[140px] resize-none overflow-y-auto bg-transparent text-[16px] leading-relaxed outline-none placeholder:text-[var(--base-400)]"
                style={{ fontFamily: "var(--font-inter)", color: "var(--base-800)" }}
                rows={3}
            />
            <div className="flex justify-end gap-2 mt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="h-9 px-4 rounded-lg border border-[var(--base-300)] bg-white text-[var(--base-700)] font-medium transition-all duration-150 hover:bg-[var(--base-100)] active:scale-[0.98] cursor-pointer"
                    style={{ fontFamily: "var(--font-inter)" }}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onSend}
                    disabled={!value.trim()}
                    className="h-9 px-4 rounded-lg text-white font-medium transition-all duration-150 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer"
                    style={{ fontFamily: "var(--font-inter)", backgroundColor: "var(--primary-400)" }}
                >
                    Send
                </button>
            </div>
        </div>
    );
}

export type DashboardTextboxHandle = { setValue: (text: string) => void };

const DashboardTextbox = React.forwardRef<DashboardTextboxHandle, {
    placeholder: string;
    initialSubjectId?: string | null;
    forceExpanded?: boolean;
    onSendMessage: (opts: { message: string; subject: string; taskType?: string; attachments?: AttachmentMeta[]; quickMode?: boolean }) => Promise<void>;
    isStreaming?: boolean;
    onStop?: () => void;
    currentSessionId?: string | null;
    /** Fires when the subject dropdown selection changes (including sync from initialSubjectId). */
    onSubjectSelectionChange?: (subjectId: string | null) => void;
    /** Overrides the default SUBJECT_OPTIONS list (used to filter by user profile). */
    subjectOptions?: { id: string; label: string }[];
    /** Task selection controlled externally (by quick task buttons). */
    externalTask?: string | null;
    onExternalTaskChange?: (task: string | null) => void;
    /** True while the textarea spans multiple lines — parent may widen max width for the composer. */
    onMultilineComposerChange?: (multiline: boolean) => void;
}>(function DashboardTextbox({
    placeholder,
    initialSubjectId = null,
    forceExpanded = false,
    onSendMessage,
    isStreaming = false,
    onStop,
    currentSessionId,
    onSubjectSelectionChange,
    subjectOptions: subjectOptionsProp,
    externalTask,
    onExternalTaskChange,
    onMultilineComposerChange,
}, ref) {
    const [value, setValue] = useState("");
    useImperativeHandle(ref, () => ({ setValue }), []);

    const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(initialSubjectId ?? null);
    const [subjectDropdownOpen, setSubjectDropdownOpen] = useState(false);
    const [addMenuOpen, setAddMenuOpen] = useState(false);
    const [pendingAttachments, setPendingAttachments] = useState<AttachmentMeta[]>([]);
    const [uploadingFiles, setUploadingFiles] = useState<{ uid: string; name: string; progress: "uploading" | "done" | "error" }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [taskMenuOpen, setTaskMenuOpen] = useState(false);
    const addButtonRef = useRef<HTMLButtonElement>(null);
    const addMenuRef = useRef<HTMLDivElement>(null);
    const taskButtonRef = useRef<HTMLButtonElement>(null);
    const taskMenuRef = useRef<HTMLDivElement>(null);
    const taskCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const subjectButtonRef = useRef<HTMLButtonElement>(null);
    const subjectMenuRef = useRef<HTMLDivElement>(null);
    const [selectedTask, setSelectedTask] = useState<string | null>(null);
    // Effective task: external prop takes precedence when provided
    const effectiveTask = externalTask !== undefined ? externalTask : selectedTask;
    const setEffectiveTask = (task: string | null) => {
        if (onExternalTaskChange) onExternalTaskChange(task);
        else setSelectedTask(task);
    };
    const [quickMode, setQuickMode] = useState(false);
    const [taskChipHovered, setTaskChipHovered] = useState(false);
    const [addMenuPosition, setAddMenuPosition] = useState({
        top: 0,
        left: 0,
        width: 0,
        opensUpward: true,
    });
    const [taskMenuPosition, setTaskMenuPosition] = useState({ top: 0, left: 0 });
    const [subjectMenuPosition, setSubjectMenuPosition] = useState({ top: 0, left: 0, minWidth: 160 });
    const [isFocused, setIsFocused] = useState(false);
    const [showSubjectRequired, setShowSubjectRequired] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);
    const [compactComposer, setCompactComposer] = useState(false);
    useEffect(() => setMounted(true), []);
    useEffect(() => {
        if (typeof window === "undefined") return;
        const mq = window.matchMedia("(max-width: 1023px)");
        const apply = () => setCompactComposer(mq.matches);
        apply();
        mq.addEventListener("change", apply);
        return () => mq.removeEventListener("change", apply);
    }, []);
    useEffect(() => {
        if (initialSubjectId) {
            setSelectedSubjectId(initialSubjectId);
            onSubjectSelectionChange?.(initialSubjectId);
        }
    }, [initialSubjectId, onSubjectSelectionChange]);

    useEffect(() => {
        if (!showSubjectRequired) return;
        const t = setTimeout(() => setShowSubjectRequired(false), 4000);
        return () => clearTimeout(t);
    }, [showSubjectRequired]);

    const [sending, setSending] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const dragCounterRef = useRef(0);
    const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (!uploadErrorMsg) return;
        const t = setTimeout(() => setUploadErrorMsg(null), 4000);
        return () => clearTimeout(t);
    }, [uploadErrorMsg]);

    // ── STT (Dictate) ─────────────────────────────────────────────────────────
    // Keep a ref so the onTranscript callback always reads the latest value
    // without creating a new callback identity on every keystroke.
    const valueRef = useRef(value);
    useEffect(() => { valueRef.current = value; }, [value]);

    const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
    const { devices: micDevices, enumerate: enumerateMics } = useMicDevices();

    const { isRecording, isTranscribing, startRecording, stopRecording, cancelRecording, error: sttError, stream: sttStream } = useSTT({
        onTranscript: useCallback((text: string) => {
            const current = valueRef.current;
            const joined = current.trim() ? `${current} ${text}` : text;
            if (joined.length <= ASK_MAX_CHARS) setValue(joined);
        }, []),
        deviceId: selectedDeviceId,
    });

    const [sttErrorVisible, setSttErrorVisible] = useState<string | null>(null);
    useEffect(() => {
        if (!sttError) return;
        setSttErrorVisible(sttError);
        const t = setTimeout(() => setSttErrorVisible(null), 5000);
        return () => clearTimeout(t);
    }, [sttError]);

    const handleDictate = useCallback(() => {
        if (isRecording) {
            stopRecording();
        } else {
            void startRecording();
        }
    }, [isRecording, startRecording, stopRecording]);

    const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    const MAX_ATTACHMENTS = 3;

    const uploadFiles = async (files: File[]) => {
        const remaining = MAX_ATTACHMENTS - pendingAttachments.length;
        if (remaining <= 0) {
            setUploadErrorMsg("You can attach at most 3 files per message.");
            return;
        }

        const validType = files.filter((f) => ALLOWED_MIME.includes(f.type));
        if (!validType.length) {
            setUploadErrorMsg("Unsupported file type. Use JPG, PNG, WEBP, GIF, or PDF.");
            return;
        }

        const allowed = validType.slice(0, remaining);
        if (validType.length > remaining) {
            setUploadErrorMsg(`Only ${remaining} more file${remaining === 1 ? "" : "s"} allowed per message.`);
        }

        for (const file of allowed) {
            if (file.size > 10 * 1024 * 1024) {
                setUploadErrorMsg(`"${file.name}" is too large (max 10 MB).`);
                continue;
            }

            const uid = `${file.name}-${Date.now()}-${Math.random()}`;
            setUploadingFiles((prev) => [...prev, { uid, name: file.name, progress: "uploading" }]);

            try {
                let fileToUpload: File | Blob = file;
                if (file.type.startsWith("image/")) {
                    const { default: imageCompression } = await import("browser-image-compression");
                    fileToUpload = await imageCompression(file, {
                        maxSizeMB: 1,
                        maxWidthOrHeight: 1920,
                        useWebWorker: true,
                    });
                }

                const uploadSessionId = currentSessionId ?? "new";
                const formData = new FormData();
                formData.append("file", fileToUpload, file.name);
                formData.append("session_id", uploadSessionId);

                const res = await fetch("/api/tutor/upload", {
                    method: "POST",
                    credentials: "include",
                    body: formData,
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({ error: "Upload failed" })) as { error?: string };
                    throw new Error(errData.error ?? "Upload failed");
                }

                const meta = await res.json() as AttachmentMeta;
                setPendingAttachments((prev) => [...prev, meta]);
                setUploadingFiles((prev) =>
                    prev.map((f) => f.uid === uid ? { ...f, progress: "done" } : f)
                );
                track("ask_file_uploaded", { file_type: file.type === "application/pdf" ? "pdf" : "image" });
            } catch (err) {
                console.error("[upload] Failed:", err);
                const msg = err instanceof Error ? err.message : "Upload failed";
                setUploadErrorMsg(msg);
                setUploadingFiles((prev) =>
                    prev.map((f) => f.uid === uid ? { ...f, progress: "error" } : f)
                );
            }
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (!files.length) return;
        setAddMenuOpen(false);
        await uploadFiles(files);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = Array.from(e.clipboardData.items);
        const fileItems = items.filter((item) => item.kind === "file");
        if (!fileItems.length) return;
        const files = fileItems.map((item) => item.getAsFile()).filter(Boolean) as File[];
        if (!files.length) return;
        e.preventDefault(); // prevent pasting as text
        await uploadFiles(files);
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current += 1;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current -= 1;
        if (dragCounterRef.current === 0) {
            setIsDragging(false);
        }
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCounterRef.current = 0;
        const files = Array.from(e.dataTransfer.files);
        if (!files.length) return;
        await uploadFiles(files);
    };

    const handleSend = async () => {
        if (!hasText) return;
        // Auto-detection only works for explain in normal (non-quick) mode.
        // Quick mode skips the rewriter so subject must be selected upfront.
        const backendTask = effectiveTask
            ? (TASK_TO_BACKEND[effectiveTask] ?? QUICK_TASK_TO_BACKEND[effectiveTask])
            : undefined;
        const isExplainTask = !backendTask || backendTask === "explain";
        const canAutoDetect = isExplainTask && !quickMode;
        if (!selectedSubjectId && !canAutoDetect) {
            setShowSubjectRequired(true);
            setIsFocused(true);
            setSubjectDropdownOpen(true);
            return;
        }
        setSending(true);
        const attachmentsToSend = [...pendingAttachments]; // snapshot
        setValue(""); // clear immediately so user sees empty box right away
        setPendingAttachments([]);
        setUploadingFiles([]);
        try {
            await onSendMessage({
                message: value.trim(),
                subject: selectedSubjectId ?? "",
                taskType: backendTask,
                attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
                quickMode,
            });
        } finally {
            setSending(false);
        }
    };

    const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!sending) {
                void handleSend();
            }
        }
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            const inAddMenu =
                addButtonRef.current?.contains(target) || addMenuRef.current?.contains(target) || taskMenuRef.current?.contains(target);
            const inSubject =
                subjectButtonRef.current?.contains(target) || subjectMenuRef.current?.contains(target);
            if (!inAddMenu) {
                setAddMenuOpen(false);
                setTaskMenuOpen(false);
            }
            if (!inSubject) setSubjectDropdownOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);


    useEffect(() => {
        if (addMenuOpen && addButtonRef.current) {
            const rect = addButtonRef.current.getBoundingClientRect();
            const dropdownHeight = 76;
            const gap = 18;
            setAddMenuPosition({
                top: rect.top - dropdownHeight - gap,
                left: rect.left - 4,
                width: 232,
                opensUpward: true,
            });
        }
    }, [addMenuOpen]);

    useEffect(() => {
        if (taskMenuOpen && taskButtonRef.current) {
            const rect = taskButtonRef.current.getBoundingClientRect();
            const menuHeight = 202; // 5 items × ~36px + 12px padding
            const gap = 8;
            let top = rect.top;
            // Clamp so it doesn't overflow the bottom of the viewport
            if (top + menuHeight > window.innerHeight - 8) {
                top = window.innerHeight - menuHeight - 8;
            }
            top = Math.max(top, 8);
            setTaskMenuPosition({ top, left: rect.right + gap });
        }
    }, [taskMenuOpen]);

    /** Portal subject menu to body: composer uses overflow-x-clip which clips in-flow absolute menus on narrow viewports. */
    useLayoutEffect(() => {
        if (!subjectDropdownOpen) {
            setSubjectMenuPosition((p) => (p.top === 0 ? p : { ...p, top: 0 }));
            return;
        }
        const options = subjectOptionsProp ?? GRADE_10_ASK_SUBJECT_OPTIONS;
        const update = () => {
            const btn = subjectButtonRef.current;
            if (!btn) return;
            const rect = btn.getBoundingClientRect();
            const rowHeight = 44;
            const menuPadding = 12;
            const gap = 8;
            const vh = window.innerHeight;
            const vw = window.innerWidth;
            const estimatedHeight = options.length * rowHeight + menuPadding;
            const maxMenuHeight = Math.min(estimatedHeight, vh - 16);
            let top = rect.top - maxMenuHeight - gap;
            if (top < 8) {
                const belowTop = rect.bottom + gap;
                if (belowTop + maxMenuHeight <= vh - 8) {
                    top = belowTop;
                } else {
                    top = Math.max(8, Math.min(rect.top - maxMenuHeight - gap, vh - maxMenuHeight - 8));
                }
            }
            let left = rect.left;
            const minWidth = Math.max(160, rect.width);
            if (left + minWidth > vw - 8) left = vw - minWidth - 8;
            if (left < 8) left = 8;
            setSubjectMenuPosition({ top, left, minWidth });
        };
        update();
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        return () => {
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
        };
    }, [subjectDropdownOpen, subjectOptionsProp]);

    const hasText = value.trim().length > 0 || pendingAttachments.length > 0;
    const isInteractingWithControls = subjectDropdownOpen || addMenuOpen || taskMenuOpen;
    const hasPersistentSelections = effectiveTask !== null;
    const isExpanded = forceExpanded || isFocused || hasText || isInteractingWithControls || hasPersistentSelections;

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
        const next = e.relatedTarget as Node | null;
        if (next && containerRef.current?.contains(next)) return;
        setIsFocused(false);
    };

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const TEXTAREA_MAX_HEIGHT = 50;

    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta || !isExpanded) {
            onMultilineComposerChange?.(false);
            return;
        }
        ta.style.height = "auto";
        ta.style.overflowY = "hidden";
        const h = Math.min(ta.scrollHeight, TEXTAREA_MAX_HEIGHT);
        ta.style.height = `${h}px`;
        ta.style.overflowY = h >= TEXTAREA_MAX_HEIGHT ? "auto" : "hidden";
        const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 22;
        const multiline = value.includes("\n") || ta.scrollHeight > lineHeight * 1.65;
        onMultilineComposerChange?.(multiline);
    }, [value, isExpanded, onMultilineComposerChange]);

    const selectedSubjectLabel = selectedSubjectId ? (SUBJECT_LABELS[selectedSubjectId] ?? "Subject") : "Subject";
    const SelectedTaskIcon = effectiveTask ? TASK_ICONS[effectiveTask] : null;

    return (
        <>
        <motion.div
            ref={containerRef}
            layout
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative w-full max-w-full sm:max-w-[750px] overflow-x-clip overflow-y-visible rounded-2xl sm:rounded-[24px] bg-white min-h-0 transition-[border-color,box-shadow] duration-300 ease-out ${
                isDragging
                    ? "border border-[var(--primary-300)] shadow-[0_0_0_2px_rgba(99,102,241,0.15)]"
                    : isFocused
                    ? "border border-[var(--base-300)] shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_2px_8px_-2px_rgba(0,0,0,0.04)]"
                    : "border border-[var(--base-200)] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.03)]"
            }`}
        >
            {/* Drag overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-[24px] bg-white pointer-events-none">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--primary-50)" }}>
                        <span style={{ color: "var(--primary-400)", display: "flex" }}>
                            <IconAttach className="w-5 h-5" />
                        </span>
                    </div>
                    <p className="text-[14px] font-medium" style={{ fontFamily: "var(--font-inter)", color: "var(--primary-400)" }}>
                        Drop to attach
                    </p>
                </div>
            )}
            <motion.div
                layout
                transition={{ type: "spring", stiffness: 420, damping: 38 }}
                className={`flex ${isExpanded ? "flex-col p-2.5 gap-2.5 sm:p-3 sm:gap-3" : "items-center p-2 sm:p-[10px] gap-0"}`}
            >
                {/* Attachment previews above textarea */}
                {(pendingAttachments.length > 0 || uploadingFiles.some(f => f.progress === "uploading")) && (
                    <div className="flex flex-wrap gap-2 px-1">
                        {/* Uploading indicators */}
                        {uploadingFiles.filter(f => f.progress === "uploading").map((f) => (
                            <div
                                key={f.uid}
                                className="flex items-center gap-2 h-9 px-3 rounded-xl bg-slate-100 text-[13px] text-slate-500"
                                style={{ fontFamily: "var(--font-inter)" }}
                            >
                                <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                <span className="max-w-[120px] truncate">{f.name}</span>
                            </div>
                        ))}

                        {/* Completed attachment chips */}
                        {pendingAttachments.map((att, idx) => (
                            <div
                                key={att.path}
                                className="flex items-center gap-2 h-9 pl-2 pr-1 rounded-xl bg-slate-100 text-[13px] text-slate-700 group/chip"
                                style={{ fontFamily: "var(--font-inter)" }}
                            >
                                {att.type.startsWith("image/") ? (
                                    <img
                                        src={att.url}
                                        alt={att.name}
                                        className="w-6 h-6 rounded-md object-cover shrink-0"
                                    />
                                ) : (
                                    <div className="w-6 h-6 rounded-md bg-red-100 flex items-center justify-center shrink-0">
                                        <span className="text-[9px] font-bold text-red-600">PDF</span>
                                    </div>
                                )}
                                <span className="max-w-[100px] truncate">{att.name}</span>
                                <button
                                    type="button"
                                    onClick={() => setPendingAttachments((prev) => prev.filter((_, i) => i !== idx))}
                                    className="ml-0.5 p-1 rounded-md hover:bg-[var(--base-200)] transition-colors cursor-pointer"
                                    aria-label={`Remove ${att.name}`}
                                >
                                    <X className="w-3 h-3 text-slate-500" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Top row: voice recording bar when active, otherwise textarea + buttons */}
                <AnimatePresence mode="wait" initial={false}>
                  {!isExpanded && (isRecording || isTranscribing) ? (
                    <motion.div
                      key="voice-recording"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="w-full"
                    >
                      <VoiceRecordingBar
                        stream={sttStream}
                        isTranscribing={isTranscribing}
                        onStop={stopRecording}
                        onCancel={cancelRecording}
                        devices={micDevices}
                        selectedDeviceId={selectedDeviceId}
                        onDeviceChange={setSelectedDeviceId}
                        onPickerOpen={enumerateMics}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="text-input-row"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex flex-1 min-w-0 gap-0 items-center"
                    >
                      {!isExpanded && (
                          <TooltipHint label="Add files and more">
                              <button
                                  ref={addButtonRef}
                                  type="button"
                                  onClick={() => setAddMenuOpen((open) => !open)}
                                  className={`${UTILITY_ICON_BUTTON_CLASS} max-lg:size-9`}
                                  aria-label="Add file"
                              >
                                  <IconAdd className="w-5 h-5 max-lg:w-[18px] max-lg:h-[18px]" />
                              </button>
                          </TooltipHint>
                      )}
                      <div className="relative flex flex-1 min-w-0">
                          <textarea
                              ref={textareaRef}
                              placeholder={placeholder}
                              rows={1}
                              value={value}
                              onChange={(e) => { if (e.target.value.length <= ASK_MAX_CHARS) setValue(e.target.value); }}
                              onKeyDown={handleTextareaKeyDown}
                              onFocus={() => setIsFocused(true)}
                              onBlur={handleBlur}
                              onPaste={handlePaste}
                              className={`flex-1 min-w-0 w-full py-2 px-3 text-[16px] leading-snug sm:leading-normal placeholder:text-slate-400 resize-none border-none outline-none bg-transparent overflow-x-hidden ${
                                  isExpanded ? "scrollbar-subtle-y overflow-y-auto" : "overflow-hidden"
                              }`}
                              style={{
                                  fontFamily: "var(--font-inter)",
                                  ...(isExpanded ? { maxHeight: TEXTAREA_MAX_HEIGHT } : {}),
                              }}
                          />
                      </div>
                      {!isExpanded && (
                          <div className="flex items-center gap-1 shrink-0">
                              <DictateButton
                                  isRecording={isRecording}
                                  isTranscribing={isTranscribing}
                                  onDictate={handleDictate}
                                  devices={micDevices}
                                  selectedDeviceId={selectedDeviceId}
                                  onDeviceChange={setSelectedDeviceId}
                                  onPickerOpen={enumerateMics}
                              />
                              <button
                                  type="button"
                                  disabled={!isStreaming && (!hasText || sending || isRecording || isTranscribing)}
                                  onClick={isStreaming ? onStop : handleSend}
                                  className="size-9 shrink-0 rounded-full sm:size-10 flex items-center justify-center overflow-hidden transition-all duration-150 hover:opacity-90 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:opacity-50 disabled:active:scale-100"
                                  style={{ backgroundColor: isStreaming ? "#EEF4FF" : "var(--primary-400)" }}
                                  aria-label={isStreaming ? "Stop" : "Send"}
                              >
                                  <AnimatePresence mode="popLayout" initial={false}>
                                      {isStreaming ? (
                                          <motion.span
                                              key="stop"
                                              initial={{ opacity: 0, y: 16 }}
                                              animate={{ opacity: 1, y: 0 }}
                                              exit={{ opacity: 0, y: -16 }}
                                              transition={{ duration: 0.18, ease: "easeInOut" }}
                                              style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                                          >
                                              <svg width="18" height="18" viewBox="0 0 24 24" fill="#1e3a5f" stroke="none">
                                                  <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
                                              </svg>
                                          </motion.span>
                                      ) : (
                                          <motion.span
                                              key="send"
                                              initial={{ opacity: 0, y: 16 }}
                                              animate={{ opacity: 1, y: 0 }}
                                              exit={{ opacity: 0, y: -16 }}
                                              transition={{ duration: 0.18, ease: "easeInOut" }}
                                              style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                                          >
                                              <IconSend className="w-5 h-5 text-white" />
                                          </motion.span>
                                      )}
                                  </AnimatePresence>
                              </button>
                          </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                {/* Expanded: bottom row - ALL buttons in one row, no divider */}
                {isExpanded && (
                    <div className="flex w-full min-w-0 flex-row items-center justify-between gap-2 pt-2.5 lg:pt-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1.5">
                            <TooltipHint label="Add files and more">
                                <motion.button
                                    ref={addButtonRef}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    type="button"
                                    onClick={() => {
                                        setAddMenuOpen((open) => !open);
                                        setTaskMenuOpen(false);
                                    }}
                                    className={`${UTILITY_ICON_BUTTON_CLASS} max-lg:size-9`}
                                    aria-label="Add file"
                                >
                                    <IconAdd className="w-5 h-5 max-lg:w-[18px] max-lg:h-[18px]" />
                                </motion.button>
                            </TooltipHint>
                            {addMenuOpen && addMenuPosition.width > 0 &&
                                createPortal(
                                    <motion.div
                                        ref={addMenuRef}
                                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                                        className="fixed z-[9999] rounded-[16px] border border-[var(--base-200)] bg-white p-[6px] shadow-[0_12px_32px_rgba(15,23,42,0.10)] overflow-visible"
                                        style={{
                                            top: addMenuPosition.top,
                                            left: addMenuPosition.left,
                                            width: 220,
                                        }}
                                    >
                                        <div className="flex flex-col gap-0">
                                            <button
                                                type="button"
                                                className="w-full min-h-6 rounded-[10px] px-[10px] py-[6px] flex items-center gap-[6px] text-left text-[14px] transition-all duration-150 hover:bg-[var(--base-100)] active:scale-[0.99] cursor-pointer"
                                                style={{ fontFamily: "var(--font-inter)", color: "var(--base-800)" }}
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                <IconAttach className="w-5 h-5 text-[var(--base-600)] shrink-0" />
                                                <span className="flex h-6 items-center">Add photos or files</span>
                                            </button>
                                            <button
                                                ref={taskButtonRef}
                                                type="button"
                                                onClick={() => setTaskMenuOpen((open) => !open)}
                                                onMouseEnter={() => {
                                                    if (taskCloseTimeoutRef.current) clearTimeout(taskCloseTimeoutRef.current);
                                                    setTaskMenuOpen(true);
                                                }}
                                                onMouseLeave={() => {
                                                    taskCloseTimeoutRef.current = setTimeout(() => setTaskMenuOpen(false), 120);
                                                }}
                                                className={`w-full min-h-6 rounded-[10px] px-[10px] py-[6px] flex items-center justify-between gap-[6px] text-left text-[14px] transition-all duration-150 active:scale-[0.99] cursor-pointer ${
                                                    taskMenuOpen ? "bg-[var(--base-100)]" : "hover:bg-[var(--base-100)]"
                                                }`}
                                                style={{ fontFamily: "var(--font-inter)", color: "var(--base-800)" }}
                                            >
                                                <span className="flex h-6 items-center gap-[6px]">
                                                    <IconTask className="w-5 h-5 text-[var(--base-600)] shrink-0" />
                                                    <span>Choose task</span>
                                                </span>
                                                <ChevronDown className="w-5 h-5 text-[var(--base-600)] rotate-[-90deg]" />
                                            </button>
                                        </div>
                                    </motion.div>,
                                    document.body
                                )}
                            {taskMenuOpen && taskMenuPosition.top > 0 &&
                                createPortal(
                                    <AnimatePresence>
                                        <motion.div
                                            ref={taskMenuRef}
                                            initial={{ opacity: 0, x: -4, scale: 0.98 }}
                                            animate={{ opacity: 1, x: 0, scale: 1 }}
                                            exit={{ opacity: 0, x: -4, scale: 0.98 }}
                                            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                                            className="fixed z-[9999] w-[200px] rounded-[16px] border border-[var(--base-200)] bg-white p-[6px] shadow-[0_12px_32px_rgba(15,23,42,0.10)]"
                                            style={{ top: taskMenuPosition.top, left: taskMenuPosition.left }}
                                            onMouseEnter={() => {
                                                if (taskCloseTimeoutRef.current) clearTimeout(taskCloseTimeoutRef.current);
                                            }}
                                            onMouseLeave={() => setTaskMenuOpen(false)}
                                        >
                                            <div className="flex flex-col gap-0">
                                                {TASK_OPTIONS.map((opt) => {
                                                    const TaskIcon = TASK_ICONS[opt];
                                                    return (
                                                        <button
                                                            key={opt}
                                                            type="button"
                                                            onClick={() => {
                                                                setEffectiveTask(opt);
                                                                setTaskMenuOpen(false);
                                                                setAddMenuOpen(false);
                                                            }}
                                                            className={`w-full min-h-6 rounded-[10px] px-[10px] py-[6px] flex items-center justify-between gap-[6px] text-left text-[14px] transition-all duration-150 cursor-pointer ${
                                                                effectiveTask === opt
                                                                    ? "bg-[var(--base-100)]"
                                                                    : "hover:bg-[var(--base-100)]"
                                                            }`}
                                                            style={{ fontFamily: "var(--font-inter)", color: "var(--base-800)" }}
                                                        >
                                                            <span className="flex h-6 items-center gap-[6px]">
                                                                <TaskIcon className="w-5 h-5 text-[var(--base-600)] shrink-0" />
                                                                <span>{opt}</span>
                                                            </span>
                                                            {effectiveTask === opt && (
                                                                <Check className="w-5 h-5 text-[var(--base-700)] shrink-0" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    </AnimatePresence>,
                                    document.body
                                )}
                            {effectiveTask && SelectedTaskIcon && (
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{
                                        opacity: 1,
                                        scale: 1,
                                        width: taskChipHovered ? 68 : 40,
                                        backgroundColor: taskChipHovered ? "rgba(0,119,237,0.12)" : "rgba(0,119,237,0)",
                                    }}
                                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                    type="button"
                                    onMouseEnter={() => setTaskChipHovered(true)}
                                    onMouseLeave={() => setTaskChipHovered(false)}
                                    onClick={() => {
                                        setEffectiveTask(null);
                                        setTaskChipHovered(false);
                                    }}
                                    className="h-10 rounded-full flex items-center overflow-hidden shrink-0 cursor-pointer active:scale-[0.98]"
                                    style={{
                                        fontFamily: "var(--font-inter)",
                                        color: "var(--primary-500)",
                                        paddingLeft: 10,
                                        paddingRight: 10,
                                    }}
                                    aria-label={`Remove selected task: ${effectiveTask}`}
                                >
                                    <SelectedTaskIcon className="w-5 h-5 shrink-0" />
                                    <AnimatePresence initial={false}>
                                        {taskChipHovered && (
                                            <motion.span
                                                initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                                                animate={{ opacity: 1, width: 20, marginLeft: 6 }}
                                                exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                                                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                                                className="flex items-center justify-center shrink-0 overflow-hidden"
                                            >
                                                <X className="w-4 h-4 shrink-0" />
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </motion.button>
                            )}
                            <div className="relative">
                                <motion.button
                                    ref={subjectButtonRef}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        type="button"
                                        onClick={() => setSubjectDropdownOpen((o) => !o)}
                                        className={`${INPUT_PILL_BUTTON_CLASS} min-w-0 max-w-[min(148px,46vw)] shrink justify-between hover:bg-slate-100 lg:max-w-none lg:min-w-[112px] lg:shrink-0`}
                                        style={{ fontFamily: "var(--font-inter)", color: "var(--base-800)" }}
                                        aria-label="Subject"
                                        aria-expanded={subjectDropdownOpen}
                                    >
                                    <span className="truncate">{selectedSubjectLabel}</span>
                                    {subjectDropdownOpen
                                        ? <ChevronUp className="w-5 h-5 shrink-0 text-slate-500" />
                                        : <ChevronDown className="w-5 h-5 shrink-0 text-slate-500" />
                                    }
                                </motion.button>
                                {subjectDropdownOpen &&
                                    subjectMenuPosition.top > 0 &&
                                    createPortal(
                                        <motion.div
                                            ref={subjectMenuRef}
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                                            className="fixed z-[10000] max-h-[min(320px,calc(100vh-24px))] overflow-y-auto overscroll-contain rounded-xl border border-[var(--base-200)] bg-white p-1.5 shadow-lg flex flex-col gap-0.5"
                                            style={{
                                                top: subjectMenuPosition.top,
                                                left: subjectMenuPosition.left,
                                                minWidth: subjectMenuPosition.minWidth,
                                                boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                                            }}
                                        >
                                            {(subjectOptionsProp ?? GRADE_10_ASK_SUBJECT_OPTIONS).map(({ id, label }) => (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedSubjectId(id);
                                                        onSubjectSelectionChange?.(id);
                                                        setSubjectDropdownOpen(false);
                                                    }}
                                                    className={`w-full px-3 py-2.5 rounded-lg flex items-center justify-between gap-2 text-left text-[14px] transition-colors cursor-pointer ${
                                                        selectedSubjectId === id
                                                            ? "bg-slate-50"
                                                            : "hover:bg-[var(--base-100)]/80"
                                                    }`}
                                                    style={{
                                                        fontFamily: "var(--font-inter)",
                                                        color: selectedSubjectId === id ? "var(--base-800)" : "var(--base-600)",
                                                    }}
                                                >
                                                    {label}
                                                    {selectedSubjectId === id && (
                                                        <Check className="w-5 h-5 text-slate-600 shrink-0" />
                                                    )}
                                                </button>
                                            ))}
                                        </motion.div>,
                                        document.body
                                    )}
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">
                            {/* Char limit warning */}
                            {value.length >= ASK_MAX_CHARS - 200 && (
                                <span className="text-[12px] font-medium shrink-0" style={{ fontFamily: "var(--font-inter)", color: value.length >= ASK_MAX_CHARS ? "#ef4444" : "#f59e0b" }}>
                                    {ASK_MAX_CHARS - value.length} left
                                </span>
                            )}
                            <TooltipHint label="Quick mode">
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    type="button"
                                    onClick={() => setQuickMode((v) => !v)}
                                    className={`${INPUT_PILL_BUTTON_CLASS} max-lg:h-10 max-lg:w-10 max-lg:justify-center max-lg:px-0 max-lg:gap-0`}
                                    style={{
                                        fontFamily: "var(--font-inter)",
                                        color: "var(--base-600)",
                                        backgroundColor: quickMode ? "var(--base-200)" : "transparent",
                                    }}
                                    aria-label={quickMode ? "Quick mode enabled" : "Quick mode disabled"}
                                    aria-pressed={quickMode}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 shrink-0">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                                    </svg>
                                    <span className="hidden lg:inline">Quick</span>
                                </motion.button>
                            </TooltipHint>
                            <DictateButton
                                isRecording={isRecording}
                                isTranscribing={isTranscribing}
                                onDictate={handleDictate}
                                devices={micDevices}
                                selectedDeviceId={selectedDeviceId}
                                onDeviceChange={setSelectedDeviceId}
                                onPickerOpen={enumerateMics}
                            />
                            <button
                                type="button"
                                disabled={!isStreaming && (!hasText || sending || isRecording || isTranscribing)}
                                onClick={isStreaming ? onStop : handleSend}
                                className="size-9 shrink-0 rounded-full sm:size-10 flex items-center justify-center overflow-hidden transition-all duration-150 hover:opacity-90 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:opacity-50 disabled:active:scale-100"
                                style={{ backgroundColor: isStreaming ? "#EEF4FF" : "var(--primary-400)" }}
                                aria-label={isStreaming ? "Stop" : "Send"}
                            >
                                <AnimatePresence mode="popLayout" initial={false}>
                                    {isStreaming ? (
                                        <motion.span
                                            key="stop"
                                            initial={{ opacity: 0, y: 16 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -16 }}
                                            transition={{ duration: 0.18, ease: "easeInOut" }}
                                            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1e3a5f" stroke="none">
                                                <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
                                            </svg>
                                        </motion.span>
                                    ) : (
                                        <motion.span
                                            key="send"
                                            initial={{ opacity: 0, y: 16 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -16 }}
                                            transition={{ duration: 0.18, ease: "easeInOut" }}
                                            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                                        >
                                            <IconSend className="w-5 h-5 text-white" />
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </motion.div> {/* end drag container */}
        {mounted &&
            createPortal(
                <AnimatePresence>
                    {showSubjectRequired && (
                        <motion.div
                            key="subject-required-toast"
                            initial={{ opacity: 0, x: 80 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 80 }}
                            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                            className="fixed top-[120px] right-6 z-[10001] pl-4 pr-2 py-2.5 rounded-xl flex items-center gap-3"
                            style={{
                                fontFamily: "var(--font-inter)",
                                color: "var(--yellow-200)",
                                fontSize: "14px",
                                backgroundColor: "var(--yellow-10)",
                                border: "1px solid rgba(255, 219, 67, 0.2)",
                                boxShadow: "0 2px 12px -4px rgba(0,0,0,0.06)",
                            }}
                        >
                            <TriangleAlert className="w-4 h-4 shrink-0" style={{ color: "var(--yellow-200)" }} />
                            <span>Please select a subject to continue.</span>
                            <button
                                type="button"
                                onClick={() => setShowSubjectRequired(false)}
                                className="shrink-0 p-1 rounded-md hover:bg-white transition-colors cursor-pointer"
                                aria-label="Dismiss"
                            >
                                <X className="w-5 h-5" style={{ color: "var(--yellow-200)" }} />
                            </button>
                        </motion.div>
                    )}
                    {uploadErrorMsg && (
                        <motion.div
                            key="upload-error-toast"
                            initial={{ opacity: 0, x: 80 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 80 }}
                            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                            className="fixed top-[120px] right-6 z-[10001] pl-4 pr-2 py-2.5 rounded-xl flex items-center gap-3"
                            style={{
                                fontFamily: "var(--font-inter)",
                                color: "#c0392b",
                                fontSize: "14px",
                                backgroundColor: "#fff5f5",
                                border: "1px solid rgba(192, 57, 43, 0.2)",
                                boxShadow: "0 2px 12px -4px rgba(0,0,0,0.06)",
                                maxWidth: 360,
                            }}
                        >
                            <TriangleAlert className="w-4 h-4 shrink-0" style={{ color: "#c0392b" }} />
                            <span className="truncate">{uploadErrorMsg}</span>
                            <button
                                type="button"
                                onClick={() => setUploadErrorMsg(null)}
                                className="shrink-0 p-1 rounded-md hover:bg-red-100 transition-colors cursor-pointer"
                                aria-label="Dismiss"
                            >
                                <X className="w-5 h-5 text-red-500" />
                            </button>
                        </motion.div>
                    )}
                    {sttErrorVisible && (
                        <motion.div
                            key="stt-error-toast"
                            initial={{ opacity: 0, x: 80 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 80 }}
                            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                            className="fixed top-[168px] right-6 z-[10001] pl-4 pr-2 py-2.5 rounded-xl flex items-center gap-3"
                            style={{
                                fontFamily: "var(--font-inter)",
                                color: "#c0392b",
                                fontSize: "14px",
                                backgroundColor: "#fff5f5",
                                border: "1px solid rgba(192, 57, 43, 0.2)",
                                boxShadow: "0 2px 12px -4px rgba(0,0,0,0.06)",
                                maxWidth: 360,
                            }}
                        >
                            <TriangleAlert className="w-4 h-4 shrink-0" style={{ color: "#c0392b" }} />
                            <span className="truncate">{sttErrorVisible}</span>
                            <button
                                type="button"
                                onClick={() => setSttErrorVisible(null)}
                                className="shrink-0 p-1 rounded-md hover:bg-red-100 transition-colors cursor-pointer"
                                aria-label="Dismiss"
                            >
                                <X className="w-5 h-5 text-red-500" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
    <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        multiple
        className="hidden"
        onChange={handleFileSelect}
    />
    </>
    );
});

function getTimeBasedHeading(): { title: string; subtext: string } {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 8) {
        return {
            title: "Early bird gets the worm.",
            subtext: "Start your day with focused learning.",
        };
    }
    if (hour >= 8 && hour < 12) {
        return {
            title: "Good morning. Ready to learn?",
            subtext: "Your brain is at its peak—make it count.",
        };
    }
    if (hour >= 12 && hour < 15) {
        return {
            title: "Peak productivity time.",
            subtext: "Tackle the tough topics now.",
        };
    }
    if (hour >= 15 && hour < 18) {
        return {
            title: "Afternoon focus session.",
            subtext: "Keep the momentum going.",
        };
    }
    if (hour >= 18 && hour < 21) {
        return {
            title: "Evening study vibes.",
            subtext: "Wind down with some learning.",
        };
    }
    return {
        title: "Burning the midnight oil?",
        subtext: "Late night study mode activated.",
    };
}

type Citation = {
    index: number;
    chunk_id: string;
    chapter_name?: string;
    chapter_index?: string;
    topic_name?: string;
    topic_index?: string;
    subtopic_name?: string;
    page_start?: number;
    page_end?: number;
    content?: string;
    book?: string;
};
export type ChatMessage = {
    id?: string;          // tutor_messages.id — set for assistant messages, used for feedback
    role: "user" | "assistant";
    content: string;
    attachments?: AttachmentMeta[];
    citations?: Citation[];
    graph_artifacts?: GraphArtifact[];
    created_at?: string;
    thinking?: ThinkingData;
    isStopped?: boolean;  // true when user stopped generation mid-stream
    // Document generation (notes/summary)
    isDocGen?: boolean;
    isDocEdit?: boolean;
    isComplete?: boolean;
    isError?: boolean;
    errorMessage?: string;
    document?: GeneratedDocument;
    doc_id?: string | null;
    progressEvents?: object[];
    editSummary?: string;
    generationStartedAt?: number;   // ms timestamp when generation kicked off
    generationElapsedMs?: number;   // ms elapsed, set on completion
    // Quiz
    isQuiz?: boolean;
    quiz?: QuizDocument;
};


function formatMessageTimestamp(iso: string): string {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
        return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatMessageTimestampTooltip(iso: string): string {
    const d = new Date(iso);
    return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

// ── Doc generation progress block — mirrors ThinkingBlock visual style ────────

const DOC_GEN_SHIMMER = `
@keyframes docgen-shimmer {
  0%   { background-position: 200% center; }
  100% { background-position: -200% center; }
}
@keyframes docgen-pulse {
  0%, 100% { opacity: 0.45; }
  50%       { opacity: 1; }
}
`;

function DocGenShimmer({ children }: { children: React.ReactNode }) {
    return (
        <span style={{
            background: "linear-gradient(90deg, #374151 0%, #6b7280 35%, #9ca3af 50%, #6b7280 65%, #374151 100%)",
            backgroundSize: "250% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            animation: "docgen-shimmer 2.2s linear infinite",
            display: "inline",
        }}>{children}</span>
    );
}

/** Pick an icon SVG based on the step label text */
function DocGenStepIcon({ label, color }: { label: string; color: string }) {
    const l = label.toLowerCase();
    // "Understanding your request..." — Sparkle icon
    if (l.includes("understand") || l.includes("request") || l.includes("scope") || l.includes("detect")) {
        return (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/>
            </svg>
        );
    }
    // "Found X content sections..." — Layers/stack icon
    if (l.includes("found") || l.includes("section")) {
        return (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/>
                <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/>
                <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>
            </svg>
        );
    }
    // "Retrieving NCERT content..." — Search icon
    if (l.includes("retriev") || l.includes("content") || l.includes("ncert") || l.includes("fetch")) {
        return (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.34-4.34"/>
            </svg>
        );
    }
    // Step 3: generating / building / writing
    if (l.includes("generat") || l.includes("build") || l.includes("writ") || l.includes("creat")) {
        return (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
        );
    }
    // Default: document
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
    );
}

function DocGenProgressBlock({
    progressEvents,
    isDocEdit,
    isComplete,
    elapsedMs,
}: {
    progressEvents: object[];
    isDocEdit?: boolean;
    isComplete?: boolean;
    elapsedMs?: number;
}) {
    const [expanded, setExpanded] = useState(true);
    const startRef = React.useRef(Date.now());
    const [liveElapsed, setLiveElapsed] = useState(0);

    useEffect(() => {
        if (isComplete) return;
        const id = setInterval(() => setLiveElapsed((Date.now() - startRef.current) / 1000), 100);
        return () => clearInterval(id);
    }, [isComplete]);

    const events = progressEvents as Array<{ type: string; label?: string; scope_label?: string; topic_name?: string; current?: number; total?: number }>;
    const scopeEvent  = events.find(e => e.type === "scope_confirmed");
    const stepEvents  = events.filter(e => e.type === "step");
    const progressEvt = [...events].reverse().find(e => e.type === "progress");

    // When complete, elapsed comes from the persisted elapsedMs prop; while live use the timer
    const displayElapsed = isComplete
        ? (elapsedMs != null ? (elapsedMs / 1000).toFixed(1) : null)
        : liveElapsed.toFixed(1);

    // Build step list — all done when isComplete, last is active otherwise
    const steps: { label: string; isDone: boolean }[] = stepEvents.map((e, i) => ({
        label: e.label ?? "",
        isDone: isComplete || i < stepEvents.length - 1 || !!progressEvt,
    }));

    const G = { 700: "#374151", 600: "#4b5563", 500: "#6b7280", 400: "#9ca3af", 200: "#e5e7eb", 100: "#f3f4f6" };

    const headerLabel = isComplete
        ? (isDocEdit ? "Edit applied" : `Built in ${displayElapsed ?? "—"}s`)
        : (isDocEdit ? "Applying edit..." : (scopeEvent ? `Building ${scopeEvent.scope_label}...` : "Preparing your document..."));

    return (
        <>
            <style>{DOC_GEN_SHIMMER}</style>
            <div style={{ marginBottom: 14, fontFamily: "var(--font-inter)" }}>
                {/* Header toggle */}
                <button
                    type="button"
                    onClick={() => setExpanded(v => !v)}
                    style={{
                        display: "flex", alignItems: "center", gap: 4, padding: "4px 6px",
                        background: "transparent", borderRadius: 6, cursor: "pointer",
                        transition: "background 120ms", width: "100%",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = G[100])}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                    {!isComplete
                        ? <DocGenShimmer><span style={{ fontSize: 14, fontWeight: 430, lineHeight: "20px" }}>{headerLabel}</span></DocGenShimmer>
                        : <span style={{ fontSize: 14, fontWeight: 430, color: G[500], lineHeight: "20px" }}>{headerLabel}</span>
                    }
                    <motion.span
                        animate={{ rotate: expanded ? 180 : 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        style={{ display: "flex", alignItems: "center", flexShrink: 0 }}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={G[400]} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                    </motion.span>
                    {!isComplete && (
                        <span style={{ marginLeft: 4, fontSize: 12, color: G[400], fontVariantNumeric: "tabular-nums" }}>
                            {liveElapsed.toFixed(1)}s
                        </span>
                    )}
                </button>

                {/* Body */}
                <AnimatePresence initial={false}>
                    {expanded && (
                        <motion.div
                            key="body"
                            initial={false}
                            animate={{ maxHeight: 800, opacity: 1 }}
                            exit={{ maxHeight: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                            style={{ overflow: "hidden" }}
                        >
                            <div style={{ paddingTop: 10, paddingLeft: 2 }}>
                                {steps.map((step, i) => {
                                    const isActiveStep = !isComplete && !step.isDone;
                                    const isLastStep = i === steps.length - 1 && !progressEvt && !isComplete;
                                    const iconColor = (step.isDone || isComplete) ? G[500] : G[700];
                                    return (
                                        <div key={i} style={{ display: "flex", alignItems: "stretch", gap: 14 }}>
                                            {/* Rail */}
                                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16, flexShrink: 0 }}>
                                                <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", height: 22 }}>
                                                    <span style={{ animation: isActiveStep ? "docgen-pulse 2.2s ease-in-out infinite" : undefined, display: "flex" }}>
                                                        <DocGenStepIcon label={step.label} color={iconColor} />
                                                    </span>
                                                </div>
                                                {!isLastStep && (
                                                    <div style={{ flex: 1, width: 1.5, marginTop: 3, marginBottom: 3, background: G[200], minHeight: 8 }} />
                                                )}
                                            </div>
                                            {/* Label */}
                                            <div style={{ flex: 1, minWidth: 0, paddingBottom: isLastStep ? 0 : 18, display: "flex", flexDirection: "column" }}>
                                                <div style={{ display: "flex", alignItems: "center", minHeight: 22 }}>
                                                    {isActiveStep
                                                        ? <DocGenShimmer><span style={{ fontSize: 14, lineHeight: "20px" }}>{step.label}</span></DocGenShimmer>
                                                        : <span style={{ fontSize: 14, color: G[500], lineHeight: "20px" }}>{step.label}</span>
                                                    }
                                                </div>
                                                {/* Scope label under scope/understanding step */}
                                                {step.label.toLowerCase().includes("understand") && scopeEvent?.scope_label && (
                                                    <span style={{ fontSize: 12, color: G[400], marginTop: 2, lineHeight: "18px" }}>
                                                        {scopeEvent.scope_label}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Active progress step (topic-by-topic generation) */}
                                {progressEvt && !isComplete && (
                                    <div style={{ display: "flex", alignItems: "stretch", gap: 14 }}>
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16, flexShrink: 0 }}>
                                            <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", height: 22 }}>
                                                <span style={{ animation: "docgen-pulse 2.2s ease-in-out infinite", display: "flex" }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={G[700]} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                                                    </svg>
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0, paddingBottom: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 22 }}>
                                                <DocGenShimmer><span style={{ fontSize: 14, lineHeight: "20px" }}>Generating topics</span></DocGenShimmer>
                                                <span style={{ fontSize: 12, color: G[400], fontVariantNumeric: "tabular-nums", marginLeft: 8, flexShrink: 0 }}>
                                                    {progressEvt.current}/{progressEvt.total}
                                                </span>
                                            </div>
                                            {progressEvt.topic_name && (
                                                <span style={{ fontSize: 12, color: G[400], lineHeight: "16px" }}>{progressEvt.topic_name}</span>
                                            )}
                                            <div style={{ height: 3, background: G[200], borderRadius: 9999, overflow: "hidden" }}>
                                                <div style={{
                                                    height: "100%", background: "var(--primary-500, #3b82f6)", borderRadius: 9999,
                                                    width: `${((progressEvt.current ?? 0) / (progressEvt.total ?? 1)) * 100}%`,
                                                    transition: "width 300ms ease",
                                                }} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Done row — shown when complete */}
                                {isComplete && (
                                    <motion.div
                                        initial={false}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2, ease: "easeOut" }}
                                        style={{ display: "flex", alignItems: "center", gap: 14 }}
                                    >
                                        <div style={{ width: 16, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={G[500]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>
                                            </svg>
                                        </div>
                                        <span style={{ fontSize: 14, color: G[500], lineHeight: "20px" }}>Done</span>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
}

export default function DashboardContent({
    grade = 9,
    selectedSubjects: initialSelectedSubjects,
    initialSessionId = null,
    initialMessages = [],
    initialSubject = null,
    initialTitle = null,
    hasOlderMessages = false,
    initialChapterIndex = null,
    forcedTutorMode = null,
    initialShareForkToken = null,
}: {
    grade?: number;
    selectedSubjects?: string[];
    initialSessionId?: string | null;
    initialMessages?: ChatMessage[];
    initialSubject?: string | null;
    initialTitle?: string | null;
    hasOlderMessages?: boolean;
    initialChapterIndex?: string | null;
    /** When set (e.g. shared chat snapshot), overrides pathname-based ask/learn detection */
    forcedTutorMode?: "ask" | "learn" | null;
    /** Opaque token: first message forks a copy into the viewer's history (ChatGPT-style) */
    initialShareForkToken?: string | null;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [, startNavTransition] = useTransition();
    const { sessionId, setSessionId } = useTutoringSession();
    const mode = forcedTutorMode ?? (pathname === "/ask" ? "ask" : "learn");
    const textboxRef = useRef<DashboardTextboxHandle>(null);
    const [quickTaskSelection, setQuickTaskSelection] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
    const [canLoadOlder, setCanLoadOlder] = useState(hasOlderMessages);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const loadOlderCallbackRef = useRef<(() => void) | null>(null);
    const [selectedSubject, setSelectedSubject] = useState<string>("All");
    const [heading, setHeading] = useState(() => ({
        title: "Ready to learn?",
        subtext: "Your personalised learning experience.",
    }));
    const [mounted, setMounted] = useState(false);
    const [composerCompact, setComposerCompact] = useState(false);
    const [wideComposerLayout, setWideComposerLayout] = useState(false);
    // Track the chat title for the header
    const [chatTitle, setChatTitle] = useState<string | null>(initialTitle ?? null);
    const chatStarred = false;
    const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
    const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [copiedAiMessageIndex, setCopiedAiMessageIndex] = useState<number | null>(null);
    const copiedAiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [aiFeedback, setAiFeedback] = useState<Record<number, "up" | "down" | null>>({});
    const [feedbackModal, setFeedbackModal] = useState<{ messageIndex: number; type: "up" | "down" } | null>(null);
    const [feedbackText, setFeedbackText] = useState("");
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
    const { speak: speakTTS, speakingId, isLoading: ttsLoading } = useTTS();
    const [sourcesOpen, setSourcesOpen] = useState<{ msgIndex: number; citationIndex: number } | null>(null);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingValue, setEditingValue] = useState("");
    const [streamState, setStreamState] = useState<{
        steps: StepEvent[];
        content: string;
        isDone: boolean;
        isStreaming: boolean;
        elapsed?: number;
        sourcesCount?: number;
    } | null>(null);
    const {
        displayText: streamingDisplayText,
        displayChunks: streamingDisplayChunks,
        setTarget: setStreamingDisplayTarget,
        start: startStreamingDisplay,
        finish: finishStreamingDisplay,
        stop: stopStreamingDisplay,
        flush: flushStreamingDisplay,
        reset: resetStreamingDisplay,
    } = useStreamDisplayBuffer();
    const [streamingGraphArtifacts, setStreamingGraphArtifacts] = useState<GraphArtifact[]>([]);

    const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);
    useEffect(() => {
        if (!rateLimitMsg) return;
        const t = setTimeout(() => setRateLimitMsg(null), 6000);
        return () => clearTimeout(t);
    }, [rateLimitMsg]);

    const [profileSubjects, setProfileSubjects] = useState<string[] | null>(
        initialSelectedSubjects ?? null
    );

    const [pendingShareToken, setPendingShareToken] = useState<string | null>(initialShareForkToken ?? null);
    /** After fork + send, navigate so Learn/chat routes mount (replaceState alone does not). */
    const postForkNavigatePathRef = useRef<string | null>(null);
    useEffect(() => {
        setPendingShareToken(initialShareForkToken ?? null);
    }, [initialShareForkToken]);


    const askSubjectOptions = getAskSubjectOptionsForGrade(grade);
    const filteredSubjectOptions = profileSubjects
        ? askSubjectOptions.filter(({ id }) => {
              if (id.startsWith("social_")) return profileSubjects.includes("social");
              return profileSubjects.includes(id);
          })
        : askSubjectOptions;

    /**
     * 6 randomly sampled prompts for the selected quick task, drawn from the
     * user's subjects. Re-samples every time the task or the subjects change.
     */
    const [displayedPrompts, setDisplayedPrompts] = useState<string[]>([]);
    useEffect(() => {
        if (!quickTaskSelection) { setDisplayedPrompts([]); return; }
        const taskKey = (TASK_OPTION_TO_QUICK_TASK_LABEL[quickTaskSelection] ?? quickTaskSelection) as TaskKey;
        const subjects = profileSubjects ?? getAiTutorSubjectOptionsForGrade(grade).map((s) => s.id);
        setDisplayedPrompts(
            getQuickPromptsForTask(grade, taskKey, subjects)
        );
    // Intentionally depend on the task + the resolved subject list so we
    // resample each time the user changes task.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quickTaskSelection, profileSubjects, grade]);

    /** Mirrors the Ask textbox subject dropdown so edit-resend and /api/tutor/chat use the same slug. */
    const chatSubjectPickerRef = useRef<string | null>(initialSubject ?? null);
    useEffect(() => {
        chatSubjectPickerRef.current = initialSubject ?? null;
    }, [initialSubject]);
    const onChatSubjectPickerChange = useCallback((id: string | null) => {
        chatSubjectPickerRef.current = id;
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setHeading(getTimeBasedHeading());
            setMounted(true);
        }, 0);

        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 1023px)");
        const apply = () => setComposerCompact(mq.matches);
        apply();
        mq.addEventListener("change", apply);
        return () => mq.removeEventListener("change", apply);
    }, []);

    useEffect(() => {
        if (initialSessionId) {
            setSessionId(initialSessionId);
        }
    }, [initialSessionId, setSessionId]);

    // Idle-warm study feed (session + first batch) so /study opens with zero wait.
    useEffect(() => {
        // Only warm from the AI Tutor landing view (no active chat session).
        if (initialSessionId) return;
        if (initialShareForkToken) return;
        if (hasStudyFeedPrefetchFresh()) return;

        if (typeof requestIdleCallback !== "undefined") {
            const id = requestIdleCallback(
                () => {
                    void runStudyFeedWarmup(24);
                },
                { timeout: 4000 }
            );
            return () => cancelIdleCallback(id);
        }
        const t = window.setTimeout(() => {
            void runStudyFeedWarmup(24);
        }, 1200);
        return () => clearTimeout(t);
    }, [initialSessionId, initialShareForkToken]);

    useEffect(() => {
        return () => {
            if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
        };
    }, []);

    const subjectIdForFilter =
        selectedSubject === "All"
            ? null
            : { English: "english", Math: "math", "Social Science": "social", French: "french", Hindi: "hindi", Science: "science" }[
                  selectedSubject
              ];

    const filteredResources =
        !subjectIdForFilter
            ? QUICK_RESOURCES
            : QUICK_RESOURCES.filter((r) => r.subjectId === subjectIdForFilter);
    const activeSessionId = sessionId ?? initialSessionId ?? null;
    const isChatView = Boolean(activeSessionId || pendingShareToken);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const lastUserMsgRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const abortControllerRef = useRef<AbortController | null>(null);
    const docAbortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === "visible") {
                flushStreamingDisplay(); // immediately reveal any buffered text
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);
        return () => document.removeEventListener("visibilitychange", handleVisibility);
    }, []); // stable ref — no deps needed

    const isDocStreaming = messages.some(
        (m) => m.role === "assistant" && (m.isDocGen || m.isQuiz) && !m.isComplete && !m.isError
    );

    const [docPanel, setDocPanel] = useState<{
        open: boolean;
        document: GeneratedDocument | null;
        doc_id: string | null;
        regenerating_topics: string[];
    }>({ open: false, document: null, doc_id: null, regenerating_topics: [] });

    // Notify DashboardShell of the current chat header whenever it changes
    useEffect(() => {
        if (!activeSessionId) return;
        window.dispatchEvent(
            new CustomEvent("chat-header-update", {
                detail: { sessionId: activeSessionId, title: chatTitle ?? "New chat", starred: chatStarred },
            })
        );
    }, [activeSessionId, chatTitle, chatStarred]);

    const placeholder = mounted
        ? mode === "learn"
            ? composerCompact
                ? "What would you like to learn?"
                : "What would you like to learn today?"
            : composerCompact
                ? "Ask a question…"
                : "What would you like to ask about today?"
        : "What would you like to learn today?";

    // When a new user message lands, scroll it to ~24px from top of the scroll container
    const prevMessageCountRef = useRef(messages.length);
    const justSentRef = useRef(false);
    useEffect(() => {
        const grew = messages.length > prevMessageCountRef.current;
        prevMessageCountRef.current = messages.length;
        if (grew && messages[messages.length - 1]?.role === "user") {
            justSentRef.current = true;
            // rAF ensures layout is complete before we measure
            requestAnimationFrame(() => {
                const scrollEl = scrollContainerRef.current;
                const msgEl = lastUserMsgRef.current;
                if (scrollEl && msgEl) {
                    const msgRect = msgEl.getBoundingClientRect();
                    const containerRect = scrollEl.getBoundingClientRect();
                    const targetScrollTop = scrollEl.scrollTop + (msgRect.top - containerRect.top) - 24;
                    scrollEl.scrollTo({ top: Math.max(0, targetScrollTop), behavior: "smooth" });
                }
                // Allow streaming scroll after 800ms (scroll-to-top should be done by then)
                setTimeout(() => { justSentRef.current = false; }, 800);
            });
        }
    }, [messages]);

    // Track scroll position: bottom-indicator + trigger older-message loading at top
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const onScroll = () => {
            const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            setIsAtBottom(distFromBottom < 220);
            if (el.scrollTop < 120) loadOlderCallbackRef.current?.();
        };
        el.addEventListener("scroll", onScroll, { passive: true });
        return () => el.removeEventListener("scroll", onScroll);
    }, []);

    // On load, jump to bottom immediately
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [activeSessionId]);

    const handleInsertPrompt = (text: string) => {
        textboxRef.current?.setValue(text);
    };

    const sendMessageToBackend = useCallback(async ({
        message,
        subject,
        taskType,
        quickMode,
        attachments,
        sessionIdOverride,
        replaceAtIndex,
    }: {
        message: string;
        subject: string;
        taskType?: string;
        quickMode?: boolean;
        attachments?: AttachmentMeta[];
        sessionIdOverride?: string;
        replaceAtIndex?: number;
    }) => {
        const targetSessionId = sessionIdOverride ?? activeSessionId;
        if (!targetSessionId) {
            setMessages((prev) => [...prev, { role: "assistant", content: "Error: No active session" }]);
            return;
        }

        if (replaceAtIndex == null) {
            setMessages((prev) => [
                ...prev,
                { role: "user", content: message, attachments, created_at: new Date().toISOString() },
            ]);
        }

        setStreamState({ steps: [], content: "", isDone: false, isStreaming: false });
        resetStreamingDisplay();

        // Create a fresh AbortController for this request
        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        let accumulatedContent = "";
        let finalGraphArtifacts: GraphArtifact[] = [];
        setStreamingGraphArtifacts([]);

        try {
            const res = await fetch("/api/tutor/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                signal: controller.signal,
                body: JSON.stringify({
                    message,
                    session_id: targetSessionId,
                    subject,
                    grade,
                    task_type: taskType || undefined,
                    quick_mode: quickMode === true,
                    attachments: attachments ?? [],
                }),
            });

            if (!res.ok || !res.body) {
                const err = await res.json().catch(() => ({}));
                resetStreamingDisplay();
                setStreamingGraphArtifacts([]);
                setStreamState(null);
                if (res.status === 429) {
                    setRateLimitMsg((err as { error?: string }).error ?? "You've sent too many messages. Please wait a bit.");
                } else {
                    setMessages((prev) => [
                        ...prev,
                        { role: "assistant", content: `Error: ${(err as { error?: string }).error ?? "Could not get response"}` },
                    ]);
                }
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            startStreamingDisplay();
            let buffer = "";
            let finalSteps: StepEvent[] = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split("\n\n");
                buffer = parts.pop() ?? "";

                for (const part of parts) {
                    if (!part.startsWith("data: ")) continue;
                    const raw = part.slice(6).trim();
                    let event: Record<string, unknown>;
                    try { event = JSON.parse(raw); } catch { continue; }

                    const type = event.type as string;

                    if (type.startsWith("step:")) {
                        const step = event as StepEvent;
                        finalSteps = [...finalSteps, step];
                        setStreamState((prev) =>
                            prev ? { ...prev, steps: finalSteps } : null
                        );
                    } else if (type === "token") {
                        const token = event.token as string;
                        accumulatedContent += token;
                        setStreamingDisplayTarget(accumulatedContent);
                        setStreamState((prev) =>
                            prev ? { ...prev, isStreaming: true } : null
                        );
                    } else if (type === "graphs") {
                        finalGraphArtifacts = Array.isArray(event.graph_artifacts)
                            ? event.graph_artifacts as GraphArtifact[]
                            : [];
                        setStreamingGraphArtifacts(finalGraphArtifacts);
                    } else if (type === "done") {
                        const finalCitations = event.citations as Citation[];
                        finalGraphArtifacts = Array.isArray(event.graph_artifacts)
                            ? event.graph_artifacts as GraphArtifact[]
                            : finalGraphArtifacts;
                        setStreamingGraphArtifacts(finalGraphArtifacts);
                        const finalTitle = event.title as string | undefined;
                        const elapsed = (event.elapsed as number) ?? 0;
                        const sourcesCount = finalCitations?.length ?? 0;
                        const messageId = event.message_id as string | undefined;

                        track("ask_ai_response_completed", {
                            task_type: (event.task_type as string) ?? undefined,
                            has_citations: sourcesCount > 0,
                        });

                        await finishStreamingDisplay();
                        setStreamState((prev) =>
                            prev
                                ? { ...prev, isDone: true, isStreaming: false, elapsed, sourcesCount }
                                : null
                        );

                        const thinkingData: ThinkingData = { steps: finalSteps, elapsed, sourcesCount };
                        const newMsg: ChatMessage = {
                            id: messageId,
                            role: "assistant",
                            content: accumulatedContent,
                            citations: finalCitations,
                            graph_artifacts: finalGraphArtifacts,
                            thinking: thinkingData,
                        };
                        if (replaceAtIndex != null) {
                            setMessages((prev) => [
                                ...prev.slice(0, replaceAtIndex + 1),
                                newMsg,
                                ...prev.slice(replaceAtIndex + 1),
                            ]);
                        } else {
                            setMessages((prev) => [...prev, newMsg]);
                        }

                        if (finalTitle && targetSessionId) {
                            setChatTitle(finalTitle);
                            window.dispatchEvent(
                                new CustomEvent("chat-header-update", {
                                    detail: { sessionId: targetSessionId, title: finalTitle, starred: chatStarred },
                                })
                            );
                        }

                        void refreshStreakAfterActivity();

                        // streamState stays alive (shows "Thought for Xs" pill) until next send
                    } else if (type === "error") {
                        resetStreamingDisplay();
                        setStreamingGraphArtifacts([]);
                        setStreamState(null);
                        setMessages((prev) => [
                            ...prev,
                            {
                                role: "assistant",
                                content: `Error: ${(event.message as string) ?? "Something went wrong"}`,
                            },
                        ]);
                    }
                }
            }
        } catch (err: unknown) {
            if (err instanceof Error && err.name === "AbortError") {
                stopStreamingDisplay(); // flush pending display immediately on stop
                // User stopped — commit whatever was streamed so far, marked as stopped
                if (accumulatedContent.trim()) {
                    setMessages((prev) => [...prev, {
                        role: "assistant",
                        content: accumulatedContent,
                        isStopped: true,
                    }]);
                }
                setStreamingGraphArtifacts([]);
                setStreamState(null);
            } else {
                resetStreamingDisplay();
                setStreamingGraphArtifacts([]);
                setStreamState(null);
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: "Error: Could not connect" },
                ]);
                console.error("[chat] stream error:", err);
            }
        } finally {
            if (abortControllerRef.current?.signal === controller.signal) {
                abortControllerRef.current = null;
            }
        }
    }, [
        activeSessionId,
        grade,
        chatStarred,
        resetStreamingDisplay,
        startStreamingDisplay,
        finishStreamingDisplay,
        stopStreamingDisplay,
        setStreamingDisplayTarget,
    ]);

    const handleSendMessage = async ({
        message,
        subject,
        taskType,
        quickMode,
        attachments,
    }: {
        message: string;
        subject: string;
        taskType?: string;
        quickMode?: boolean;
        attachments?: AttachmentMeta[];
    }) => {
        const finishForkNavigation = () => {
            const p = postForkNavigatePathRef.current;
            if (!p) return;
            postForkNavigatePathRef.current = null;
            startTopLoader();
            startNavTransition(() => router.replace(p));
        };

        let effectiveSessionId = activeSessionId;
        if (pendingShareToken) {
            const fr = await fetch("/api/tutor/share/fork", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ token: pendingShareToken }),
            });
            if (!fr.ok) {
                const err = await fr.json().catch(() => ({}));
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        content: `Error: ${(err as { error?: string }).error ?? "Could not start your copy of this chat"}`,
                    },
                ]);
                return;
            }
            const fj = (await fr.json()) as {
                session_id: string;
                redirect_path: string;
            };
            effectiveSessionId = fj.session_id;
            setSessionId(fj.session_id);
            setPendingShareToken(null);
            postForkNavigatePathRef.current = fj.redirect_path;
        }

        track("ask_message_sent", {
            task_type: taskType,
            has_attachment: (attachments?.length ?? 0) > 0,
            input_method: "text",
        });
        // ── Route specialised task types (explicit chip OR same heuristics as legacy chat) ──
        const inferred = !taskType ? detectAskTaskTypeFromMessage(message) : null;
        const notesOrSummaryTask: "notes" | "summary" | null =
            taskType === "notes" || taskType === "summary"
                ? taskType
                : inferred === "notes" || inferred === "summary"
                  ? inferred
                  : null;
        const quizFromMessage = taskType === "quiz" || (!taskType && inferred === "quiz");

        if (notesOrSummaryTask) {
            setMessages(prev => [...prev, { role: "user" as const, content: message, created_at: new Date().toISOString() }]);
            if (docPanel.open && docPanel.document !== null) {
                await handleDocEdit(message, subject);
                return;
            }
            // If there is no active session, create one first so the chat view is shown
            // and the document panel has somewhere to appear.
            if (!effectiveSessionId) {
                const sessionRes = await fetch("/api/tutor/session", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ subject, create_new: true }),
                });
                if (!sessionRes.ok) {
                    const err = await sessionRes.json().catch(() => ({}));
                    setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${(err as { error?: string }).error ?? "Could not start session"}` }]);
                    return;
                }
                const { session_id } = (await sessionRes.json()) as { session_id: string };
                setSessionId(session_id);
                setChatTitle(generateSessionTitle(message, notesOrSummaryTask, subject));
                // Update URL immediately without re-rendering (preserves in-memory generation state)
                window.history.replaceState(null, "", `/chat/${session_id}`);
                await handleDocGeneration(message, notesOrSummaryTask, subject, session_id);
            } else {
                await handleDocGeneration(message, notesOrSummaryTask, subject, effectiveSessionId ?? undefined);
            }
            finishForkNavigation();
            return;
        }
        if (quizFromMessage) {
            setMessages(prev => [...prev, { role: "user" as const, content: message, created_at: new Date().toISOString() }]);
            if (!effectiveSessionId) {
                const sessionRes = await fetch("/api/tutor/session", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ subject, create_new: true }),
                });
                if (!sessionRes.ok) {
                    const err = await sessionRes.json().catch(() => ({}));
                    setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${(err as { error?: string }).error ?? "Could not start session"}` }]);
                    return;
                }
                const { session_id } = (await sessionRes.json()) as { session_id: string };
                setSessionId(session_id);
                setChatTitle(generateSessionTitle(message, "quiz", subject));
                // Update URL immediately without re-rendering (preserves in-memory generation state)
                window.history.replaceState(null, "", `/chat/${session_id}`);
                await handleQuizGeneration(message, subject, session_id);
            } else {
                await handleQuizGeneration(message, subject, effectiveSessionId);
            }
            finishForkNavigation();
            return;
        }

        if (effectiveSessionId) {
            await sendMessageToBackend({
                message,
                subject,
                taskType,
                quickMode,
                attachments,
                sessionIdOverride: effectiveSessionId,
            });
            finishForkNavigation();
            return;
        }

        // Use "auto" placeholder when no subject is selected — chat route will
        // detect and persist the real subject after the first message.
        const sessionSubject = subject || "auto";
        const sessionRes = await fetch("/api/tutor/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ subject: sessionSubject, create_new: true }),
        });
        if (!sessionRes.ok) {
            const err = await sessionRes.json().catch(() => ({}));
            setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${(err as { error?: string }).error ?? "Could not start session"}` }]);
            return;
        }

        const { session_id } = (await sessionRes.json()) as { session_id: string };
        setSessionId(session_id);
        track("ask_session_started", { subject: subject || undefined });

        const taskKey = taskType ? (taskType as string) : "explain";
        setChatTitle(generateSessionTitle(message, taskKey, subject));

        await sendMessageToBackend({
            message,
            subject,
            taskType,
            quickMode,
            attachments,
            sessionIdOverride: session_id,
        });
        router.push(`/chat/${session_id}`);
    };

    // ── Document panel helpers ────────────────────────────────────────────────

    function openDocumentPanel(doc: GeneratedDocument, docId: string | null) {
        setDocPanel({ open: true, document: doc, doc_id: docId, regenerating_topics: [] });
    }

    /** Append a pending assistant message; returns index for later updates. */
    function appendPendingMessage(partial: Partial<ChatMessage>): number {
        let idx = -1;
        setMessages(prev => {
            idx = prev.length;
            return [...prev, { role: "assistant" as const, content: "", ...partial }];
        });
        return idx;
    }

    /** Update the last assistant message added by appendPendingMessage. */
    function updateLastDocMessage(
        updates: Partial<ChatMessage> | ((prev: ChatMessage) => Partial<ChatMessage>)
    ) {
        setMessages(prev => {
            let lastIdx = prev.length - 1;
            while (lastIdx >= 0 && prev[lastIdx].role !== "assistant") lastIdx--;
            if (lastIdx < 0) return prev;
            const msg = prev[lastIdx];
            const newFields = typeof updates === "function" ? updates(msg) : updates;
            return [
                ...prev.slice(0, lastIdx),
                { ...msg, ...newFields },
                ...prev.slice(lastIdx + 1),
            ];
        });
    }

    // ── handleDocGeneration ───────────────────────────────────────────────────

    async function handleDocGeneration(message: string, taskType: "notes" | "summary", subject: string, sessionIdOverride?: string) {
        appendPendingMessage({ isDocGen: true, isComplete: false, progressEvents: [], generationStartedAt: Date.now() });

        docAbortControllerRef.current?.abort();
        const controller = new AbortController();
        docAbortControllerRef.current = controller;

        try {
            const res = await fetch("/api/tutor/generate-doc", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                signal: controller.signal,
                body: JSON.stringify({
                    message,
                    session_id: sessionIdOverride ?? activeSessionId,
                    subject,
                    chapter_index: initialChapterIndex,
                    task_type: taskType,
                    grade,
                }),
            });

            if (!res.ok || !res.body) {
                updateLastDocMessage({ isError: true, errorMessage: "Failed to start document generation." });
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const rawChunk = decoder.decode(value, { stream: true });
                for (const line of rawChunk.split("\n").filter(l => l.startsWith("data: "))) {
                    try {
                        const event = JSON.parse(line.slice(6));
                        if (event.type === "complete") {
                            const doc = event.document as GeneratedDocument;
                            updateLastDocMessage(prev => ({
                                isDocGen: true, isComplete: true,
                                document: doc, doc_id: event.doc_id ?? null,
                                // keep progressEvents so the block can still show steps when done
                                generationElapsedMs: prev.generationStartedAt
                                    ? Date.now() - prev.generationStartedAt
                                    : undefined,
                            }));
                            openDocumentPanel(doc, event.doc_id ?? null);
                            // Persist the title to the session record
                            const sid = sessionIdOverride ?? activeSessionId;
                            if (sid && doc.title) {
                                setChatTitle(doc.title);
                                window.dispatchEvent(new CustomEvent("chat-header-update", {
                                    detail: { sessionId: sid, title: doc.title, starred: chatStarred },
                                }));
                                fetch("/api/tutor/session/rename", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    credentials: "include",
                                    body: JSON.stringify({ session_id: sid, title: doc.title }),
                                }).catch(() => {});
                            }
                        } else if (event.type === "error") {
                            updateLastDocMessage({ isDocGen: true, isError: true, errorMessage: event.message });
                        } else {
                            updateLastDocMessage(prev => ({
                                progressEvents: [...(prev.progressEvents ?? []), event],
                            }));
                        }
                    } catch { /* skip malformed SSE lines */ }
                }
            }
        } catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
                updateLastDocMessage({
                    isDocGen: true,
                    isError: true,
                    errorMessage: "Generation stopped. Ask again to retry.",
                });
            } else {
                updateLastDocMessage({ isDocGen: true, isError: true, errorMessage: "Failed to generate document." });
            }
        } finally {
            if (docAbortControllerRef.current?.signal === controller.signal) {
                docAbortControllerRef.current = null;
            }
        }
    }

    // ── handleDocEdit ─────────────────────────────────────────────────────────

    async function handleDocEdit(editMessage: string, subject: string) {
        if (!docPanel.document || !docPanel.doc_id) return;

        const currentSections = (
            docPanel.document.sections as { topic_index: string; topic_name: string }[]
        ).map(s => ({ topic_index: s.topic_index, topic_name: s.topic_name }));

        appendPendingMessage({ isDocEdit: true, isComplete: false, progressEvents: [] });

        docAbortControllerRef.current?.abort();
        const controller = new AbortController();
        docAbortControllerRef.current = controller;

        try {
            const res = await fetch("/api/tutor/edit-doc", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                signal: controller.signal,
                body: JSON.stringify({
                    doc_id: docPanel.doc_id,
                    edit_message: editMessage,
                    subject,
                    chapter_index: initialChapterIndex ?? "1",
                    task_type: docPanel.document.type,
                    grade,
                    current_sections: currentSections,
                }),
            });

            if (!res.ok || !res.body) {
                updateLastDocMessage({ isError: true, errorMessage: "Edit failed. Please try again." });
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const rawChunk = decoder.decode(value, { stream: true });
                for (const line of rawChunk.split("\n").filter(l => l.startsWith("data: "))) {
                    try {
                        const event = JSON.parse(line.slice(6));
                        if (event.type === "edit_confirmed") {
                            setDocPanel(prev => ({ ...prev, regenerating_topics: event.affected_topics ?? [] }));
                            updateLastDocMessage(prev => ({
                                progressEvents: [...(prev.progressEvents ?? []), event],
                            }));
                        } else if (event.type === "patch") {
                            setDocPanel(prev => {
                                if (!prev.document) return prev;
                                const doc = { ...prev.document };
                                const sections = [...(doc.sections as { topic_index: string }[])];

                                if (event.patch_type === "remove") {
                                    doc.sections = sections.filter(
                                        s => !(event.removed_topic_indices as string[]).includes(s.topic_index)
                                    ) as typeof doc.sections;
                                } else if (event.patch_type === "insert") {
                                    const topicOrder = new Map(
                                        (event.all_chapter_topics as { topic_index: string }[]).map((t, i) => [t.topic_index, i])
                                    );
                                    const merged = [
                                        ...sections,
                                        ...(event.updated_sections as { topic_index: string }[]),
                                    ].sort(
                                        (a, b) => (topicOrder.get(a.topic_index) ?? 999) - (topicOrder.get(b.topic_index) ?? 999)
                                    );
                                    doc.sections = merged as typeof doc.sections;
                                } else {
                                    for (const updated of event.updated_sections as { topic_index: string }[]) {
                                        const idx = sections.findIndex(s => s.topic_index === updated.topic_index);
                                        if (idx !== -1) sections[idx] = updated as (typeof sections)[0];
                                    }
                                    doc.sections = sections as typeof doc.sections;
                                }
                                return { ...prev, document: doc, regenerating_topics: [] };
                            });
                            updateLastDocMessage({
                                isDocEdit: true, isComplete: true,
                                editSummary: event.patch_type === "remove"
                                    ? `Removed ${(event.removed_topic_indices as string[]).length} section(s).`
                                    : `Updated ${(event.updated_sections as unknown[]).length} section(s).`,
                            });
                        } else if (event.type === "error") {
                            setDocPanel(prev => ({ ...prev, regenerating_topics: [] }));
                            updateLastDocMessage({ isDocEdit: true, isError: true, errorMessage: event.message });
                        } else {
                            updateLastDocMessage(prev => ({
                                progressEvents: [...(prev.progressEvents ?? []), event],
                            }));
                        }
                    } catch { /* skip malformed SSE lines */ }
                }
            }
        } catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
                updateLastDocMessage({
                    isDocEdit: true,
                    isError: true,
                    errorMessage: "Generation stopped. Ask again to retry.",
                });
            } else {
                updateLastDocMessage({ isDocEdit: true, isError: true, errorMessage: "Failed to generate document." });
            }
        } finally {
            if (docAbortControllerRef.current?.signal === controller.signal) {
                docAbortControllerRef.current = null;
            }
        }
    }

    // ── handleQuizGeneration ──────────────────────────────────────────────────

    async function handleQuizGeneration(message: string, subject: string, sessionIdOverride?: string) {
        appendPendingMessage({ isQuiz: true, isComplete: false, progressEvents: [], generationStartedAt: Date.now() });

        docAbortControllerRef.current?.abort();
        const controller = new AbortController();
        docAbortControllerRef.current = controller;

        try {
            const res = await fetch("/api/tutor/generate-quiz", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                signal: controller.signal,
                body: JSON.stringify({
                    message,
                    session_id: sessionIdOverride ?? activeSessionId,
                    subject,
                    chapter_index: initialChapterIndex,
                    grade,
                }),
            });

            if (!res.ok || !res.body) {
                updateLastDocMessage({ isError: true, errorMessage: "Failed to start quiz generation." });
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const rawChunk = decoder.decode(value, { stream: true });
                for (const line of rawChunk.split("\n").filter(l => l.startsWith("data: "))) {
                    try {
                        const event = JSON.parse(line.slice(6));
                        if (event.type === "quiz_ready") {
                            updateLastDocMessage(prev => ({ isQuiz: true, isComplete: true, quiz: event.quiz, generationElapsedMs: prev.generationStartedAt ? Date.now() - prev.generationStartedAt : undefined }));
                            // Persist the quiz title to the session record
                            const quizTitle = (event.quiz as { title?: string }).title;
                            const sid = sessionIdOverride ?? activeSessionId;
                            if (sid && quizTitle) {
                                setChatTitle(quizTitle);
                                window.dispatchEvent(new CustomEvent("chat-header-update", {
                                    detail: { sessionId: sid, title: quizTitle, starred: chatStarred },
                                }));
                                fetch("/api/tutor/session/rename", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    credentials: "include",
                                    body: JSON.stringify({ session_id: sid, title: quizTitle }),
                                }).catch(() => {});
                            }
                        } else if (event.type === "error") {
                            updateLastDocMessage({ isQuiz: true, isError: true, errorMessage: event.message });
                        } else {
                            updateLastDocMessage(prev => ({
                                progressEvents: [...(prev.progressEvents ?? []), event],
                            }));
                        }
                    } catch { /* skip malformed SSE lines */ }
                }
            }
        } catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
                updateLastDocMessage({
                    isQuiz: true,
                    isError: true,
                    errorMessage: "Quiz generation stopped. Ask again to retry.",
                });
            } else {
                updateLastDocMessage({ isQuiz: true, isError: true, errorMessage: "Failed to generate quiz." });
            }
        } finally {
            if (docAbortControllerRef.current?.signal === controller.signal) {
                docAbortControllerRef.current = null;
            }
        }
    }

    const CHAT_WIDTH = 750;
    const CHAT_COMPOSER_WIDE_MAX = 920;

    // Keep a stable ref so the scroll listener (mounted once) always calls the latest version
    const loadOlderMessages = () => {
        if (loadingOlder || !canLoadOlder || messages.length === 0) return;
        const oldest = messages[0];
        if (!oldest?.created_at || !activeSessionId) return;
        const el = scrollContainerRef.current;
        const prevScrollHeight = el?.scrollHeight ?? 0;
        setLoadingOlder(true);
        fetch(
            `/api/tutor/messages?session_id=${activeSessionId}&before=${encodeURIComponent(oldest.created_at)}&limit=10`,
            { credentials: "include" }
        )
            .then((r) => r.json())
            .then(({ messages: older, hasMore }: { messages: ChatMessage[]; hasMore: boolean }) => {
                if (older.length > 0) {
                    setMessages((prev) => [...older, ...prev]);
                    setCanLoadOlder(hasMore);
                    requestAnimationFrame(() => {
                        if (el) el.scrollTop = el.scrollHeight - prevScrollHeight;
                    });
                } else {
                    setCanLoadOlder(false);
                }
            })
            .catch(() => {})
            .finally(() => setLoadingOlder(false));
    };
    loadOlderCallbackRef.current = loadOlderMessages;

    const lastUserMsgIndex = messages.reduceRight((found, m, i) => found === -1 && m.role === "user" ? i : found, -1);

    const messageList = (
        <div className="w-full flex flex-col">
            {loadingOlder && (
                <div className="flex flex-col gap-8 pb-8">
                    <div className="flex justify-end">
                        <div className="skeleton h-9 w-[38%] rounded-2xl" />
                    </div>
                    <div className="flex gap-3">
                        <div className="skeleton w-7 h-7 rounded-full shrink-0" />
                        <div className="flex flex-col gap-2 flex-1 pt-1">
                            <div className="skeleton h-3 w-[72%] rounded" />
                            <div className="skeleton h-3 w-[55%] rounded" />
                            <div className="skeleton h-3 w-[63%] rounded" />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <div className="skeleton h-9 w-[28%] rounded-2xl" />
                    </div>
                </div>
            )}
            {(() => {
                const lastAiIdx = [...messages].map((m, i) => m.role === "assistant" ? i : -1).filter(i => i !== -1).pop() ?? -1;
                return messages.map((m, i) => {
                const prevRole = i > 0 ? messages[i - 1]?.role : null;
                const gapTop =
                    prevRole === "user" ? "mt-10" :     // 40px between user -> AI
                    prevRole === "assistant" ? "mt-12" : // 48px between AI -> user
                    "";
                return (
                    <motion.div
                        key={`${m.role}-${i}`}
                        ref={m.role === "user" && i === lastUserMsgIndex ? lastUserMsgRef : undefined}
                        className={`flex ${m.role === "user" ? "justify-end group w-full" : "justify-start"} ${gapTop}`}
                        initial={m.role === "user" ? { opacity: 0, y: 18 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {m.role === "user" ? (
                            editingIndex === i ? (
                                <EditMessageInline
                                    value={editingValue}
                                    onChange={setEditingValue}
                                    onCancel={() => {
                                        setEditingIndex(null);
                                        setEditingValue("");
                                    }}
                                    onSend={() => {
                                        const newContent = editingValue.trim();
                                        if (!newContent) return;
                                        const subject = chatSubjectPickerRef.current ?? initialSubject ?? "science";
                                        setMessages((prev) => [
                                            ...prev.slice(0, i),
                                            { role: "user", content: newContent, created_at: new Date().toISOString() },
                                            ...prev.slice(i + 2),
                                        ]);
                                        setEditingIndex(null);
                                        setEditingValue("");
                                        sendMessageToBackend({ message: newContent, subject, replaceAtIndex: i });
                                    }}
                                />
                            ) : (
                                <div className="relative flex flex-col items-end max-w-[85%]">
                                    <div
                                        className="rounded-[20px] px-[16px] py-[10px] text-[16px] leading-relaxed"
                                        style={{
                                            fontFamily: "var(--font-inter)",
                                            color: "var(--base-500)",
                                            background: "linear-gradient(0deg, #F7FAFF 0%, #EDF4FF 100%)",
                                            boxShadow: "0 1px 3px rgba(0,0,0,0.10), 0 1px 2px -1px rgba(0,0,0,0.10)",
                                        }}
                                    >
                                        {/* Attachment previews in message history */}
                                        {m.attachments && m.attachments.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {m.attachments.map((att, ai) => (
                                                    att.type.startsWith("image/") ? (
                                                        <img
                                                            key={ai}
                                                            src={att.url}
                                                            alt={att.name}
                                                            className="max-w-[240px] max-h-[200px] rounded-xl object-cover border border-white/20"
                                                        />
                                                    ) : (
                                                        <div
                                                            key={ai}
                                                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white text-[13px]"
                                                            style={{ fontFamily: "var(--font-inter)" }}
                                                        >
                                                            <div className="w-6 h-6 rounded bg-red-100 flex items-center justify-center">
                                                                <span className="text-[9px] font-bold text-red-600">PDF</span>
                                                            </div>
                                                            <span>{att.name}</span>
                                                        </div>
                                                    )
                                                ))}
                                            </div>
                                        )}
                                        <div className="whitespace-pre-wrap">{m.content}</div>
                                    </div>
                                    <div
                                        className="absolute left-0 right-0 flex items-center justify-end gap-0.5 pt-1 opacity-0 transition-opacity duration-150 ease-in-out group-hover:opacity-100"
                                        style={{ top: "100%" }}
                                    >
                                        {m.created_at && (
                                            <TooltipHint label={formatMessageTimestampTooltip(m.created_at)}>
                                                <span
                                                    suppressHydrationWarning
                                                    className="text-[12px] mr-1.5"
                                                    style={{ fontFamily: "var(--font-inter)", color: "var(--base-400)" }}
                                                >
                                                    {formatMessageTimestamp(m.created_at)}
                                                </span>
                                            </TooltipHint>
                                        )}
                                        <TooltipHint label={copiedMessageIndex === i ? "Copied!" : "Copy"}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(m.content);
                                                    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
                                                    setCopiedMessageIndex(i);
                                                    copiedTimeoutRef.current = setTimeout(() => {
                                                        setCopiedMessageIndex(null);
                                                        copiedTimeoutRef.current = null;
                                                    }, 2500);
                                                }}
                                                className={MESSAGE_ACTION_BUTTON_CLASS}
                                                aria-label="Copy"
                                            >
                                                {copiedMessageIndex === i ? (
                                                    <IconCheck className="w-4 h-4" />
                                                ) : (
                                                    <IconCopy className="w-4 h-4" />
                                                )}
                                            </button>
                                        </TooltipHint>
                                        <TooltipHint label="Edit">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingIndex(i);
                                                    setEditingValue(m.content);
                                                }}
                                                className={MESSAGE_ACTION_BUTTON_CLASS}
                                                aria-label="Edit"
                                            >
                                                <IconEdit className="w-4 h-4" />
                                            </button>
                                        </TooltipHint>
                                    </div>
                                </div>
                            )
                        ) : (m.isDocGen || m.isDocEdit) && !m.isComplete && !m.isError ? (
                            /* Case 1: Doc generation / edit in progress */
                            <div className="w-full">
                                <DocGenProgressBlock
                                    progressEvents={m.progressEvents ?? []}
                                    isDocEdit={m.isDocEdit}
                                    isComplete={false}
                                />
                            </div>
                        ) : (m.isDocGen || m.isDocEdit) && m.isError ? (
                            /* Case 2: Doc generation / edit error */
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700 max-w-sm">
                                <span>⚠</span>
                                <span>{m.errorMessage ?? "Something went wrong."}</span>
                            </div>
                        ) : m.isDocGen && m.isComplete && m.document ? (
                            /* Case 3: Doc generation complete */
                            <div className="w-full">
                                {/* Keep progress block visible, collapsed, showing built-in time */}
                                <DocGenProgressBlock
                                    progressEvents={m.progressEvents ?? []}
                                    isDocEdit={false}
                                    isComplete={true}
                                    elapsedMs={m.generationElapsedMs}
                                />
                                {/* Done card */}
                                <div
                                    className="rounded-2xl overflow-hidden"
                                    style={{
                                        border: "1px solid #e2e8f0",
                                        background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
                                    }}
                                >
                                    <div className="px-5 py-4 flex items-start gap-4">
                                        {/* Icon */}
                                        <div
                                            className="shrink-0 flex items-center justify-center rounded-xl mt-0.5"
                                            style={{
                                                width: 38, height: 38,
                                                background: m.document.type === "notes" ? "#eff6ff" : "#f0fdf4",
                                                color: m.document.type === "notes" ? "#3b82f6" : "#22c55e",
                                            }}
                                        >
                                            {m.document.type === "notes" ? (
                                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
                                                </svg>
                                            ) : (
                                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                                                </svg>
                                            )}
                                        </div>
                                        {/* Text */}
                                        <div className="flex-1 min-w-0">
                                            <p
                                                className="text-[14px] font-semibold leading-snug mb-0.5"
                                                style={{ color: "#0f172a", fontFamily: "var(--font-inter)" }}
                                            >
                                                {m.document.type === "notes" ? "Study notes ready" : "Chapter summary ready"}
                                            </p>
                                            <p
                                                className="text-[12px]"
                                                style={{ color: "#94a3b8", fontFamily: "var(--font-inter)" }}
                                            >
                                                {m.document.chapter_name} · {m.document.sections.length} topic{m.document.sections.length !== 1 ? "s" : ""}
                                            </p>
                                        </div>
                                    </div>
                                    {/* Button row */}
                                    <div className="px-5 pb-4 flex items-center gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => openDocumentPanel(m.document!, m.doc_id ?? null)}
                                            className="flex items-center gap-2 h-9 px-4 rounded-xl text-white text-[13px] font-semibold transition-all duration-150 active:scale-95 cursor-pointer"
                                            style={{
                                                background: "var(--primary-500, #3b82f6)",
                                                fontFamily: "var(--font-inter)",
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.background = "#2563eb")}
                                            onMouseLeave={e => (e.currentTarget.style.background = "var(--primary-500, #3b82f6)")}
                                        >
                                            {/* Eye icon */}
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                                            </svg>
                                            Preview
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const { downloadAsPDF } = await import("@/lib/pdf/lerno-pdf");
                                                await downloadAsPDF(m.document!);
                                            }}
                                            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold transition-all duration-150 active:scale-95 cursor-pointer"
                                            style={{
                                                background: "#f1f5f9",
                                                color: "#334155",
                                                fontFamily: "var(--font-inter)",
                                                border: "1px solid #e2e8f0",
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.background = "#e2e8f0")}
                                            onMouseLeave={e => (e.currentTarget.style.background = "#f1f5f9")}
                                        >
                                            {/* Download icon */}
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                                            </svg>
                                            PDF
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const { downloadAsDocx } = await import("@/lib/docx/lerno-docx");
                                                await downloadAsDocx(m.document!);
                                            }}
                                            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold transition-all duration-150 active:scale-95 cursor-pointer"
                                            style={{
                                                background: "#f1f5f9",
                                                color: "#334155",
                                                fontFamily: "var(--font-inter)",
                                                border: "1px solid #e2e8f0",
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.background = "#e2e8f0")}
                                            onMouseLeave={e => (e.currentTarget.style.background = "#f1f5f9")}
                                        >
                                            {/* Download icon */}
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                                            </svg>
                                            DOCX
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : m.isDocEdit && m.isComplete ? (
                            /* Case 4: Doc edit complete */
                            <div className="bg-white border border-[var(--base-200)] rounded-xl p-3 shadow-sm max-w-xs">
                                <div className="flex items-center gap-2">
                                    <span>✏️</span>
                                    <p className="text-sm font-semibold text-[var(--base-800)]">Notes updated</p>
                                </div>
                                {m.editSummary && (
                                    <p className="text-xs text-[var(--base-400)] mt-1">{m.editSummary}</p>
                                )}
                            </div>
                        ) : m.isQuiz && !m.isComplete && !m.isError ? (
                            /* Case 5: Quiz in progress */
                            <div className="w-full">
                                <DocGenProgressBlock
                                    progressEvents={m.progressEvents ?? []}
                                    isDocEdit={false}
                                    isComplete={false}
                                />
                            </div>
                        ) : m.isQuiz && m.isError ? (
                            /* Case 6: Quiz error */
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700 max-w-sm">
                                <span>⚠</span>
                                <span>{m.errorMessage ?? "Could not generate quiz."}</span>
                            </div>
                        ) : m.isQuiz && m.isComplete && m.quiz ? (
                            /* Case 7: Quiz complete */
                            <div className="flex-1 min-w-0">
                                <QuizRenderer quiz={m.quiz} />
                            </div>
                        ) : (
                            <div
                                className="w-full group/aimsg"
                                style={{ fontFamily: "var(--font-inter)" }}
                            >
                                {m.thinking && (
                                    <ThinkingBlock
                                        steps={m.thinking.steps}
                                        isDone={true}
                                        isStreaming={false}
                                        elapsed={m.thinking.elapsed}
                                        sourcesCount={m.thinking.sourcesCount}
                                    />
                                )}
                                <MarkdownRenderer
                                    content={m.content}
                                    citations={m.citations}
                                    graphArtifacts={m.graph_artifacts}
                                    externalOpenIndex={sourcesOpen?.msgIndex === i ? sourcesOpen.citationIndex : null}
                                    grade={grade}
                                />
                                {m.isStopped && (
                                    <div
                                        className="flex items-center gap-1.5 mt-3"
                                        style={{ color: "#94a3b8", fontFamily: "var(--font-inter)" }}
                                    >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect width="16" height="16" x="4" y="4" rx="2"/>
                                        </svg>
                                        <span style={{ fontSize: 12 }}>Response stopped</span>
                                    </div>
                                )}
                                {/* AI message utility bar */}
                                <div className={`flex items-center justify-between mt-4 transition-opacity duration-150 ease-in-out ${i === lastAiIdx ? "opacity-100" : "opacity-0 group-hover/aimsg:opacity-100"}`}>
                                    {/* Left: action buttons */}
                                    <div className="flex items-center gap-0.5">
                                        {/* Copy */}
                                        <TooltipHint label={copiedAiMessageIndex === i ? "Copied!" : "Copy"}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(m.content);
                                                    if (copiedAiTimeoutRef.current) clearTimeout(copiedAiTimeoutRef.current);
                                                    setCopiedAiMessageIndex(i);
                                                    copiedAiTimeoutRef.current = setTimeout(() => {
                                                        setCopiedAiMessageIndex(null);
                                                        copiedAiTimeoutRef.current = null;
                                                    }, 2500);
                                                    track("ask_response_copied");
                                                }}
                                                className={MESSAGE_ACTION_BUTTON_CLASS}
                                                aria-label="Copy"
                                            >
                                                {copiedAiMessageIndex === i
                                                    ? <IconCheck className="w-4 h-4" />
                                                    : <IconCopy className="w-4 h-4" />}
                                            </button>
                                        </TooltipHint>
                                        {/* Thumbs up */}
                                        <TooltipHint label="Give positive feedback">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (aiFeedback[i] === "up") {
                                                        setAiFeedback(f => ({ ...f, [i]: null }));
                                                        if (m.id) fetch("/api/tutor/feedback", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message_id: m.id }) });
                                                    } else {
                                                        setFeedbackText("");
                                                        setFeedbackSubmitted(false);
                                                        setFeedbackModal({ messageIndex: i, type: "up" });
                                                        track("ask_feedback_given", { sentiment: "positive" });
                                                    }
                                                }}
                                                className={MESSAGE_ACTION_BUTTON_CLASS}
                                                aria-label="Give positive feedback"
                                                style={aiFeedback[i] === "up" ? { color: "var(--primary-400)" } : undefined}
                                            >
                                                <IconThumbsUp className="w-4 h-4" />
                                            </button>
                                        </TooltipHint>
                                        {/* Thumbs down */}
                                        <TooltipHint label="Give negative feedback">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (aiFeedback[i] === "down") {
                                                        setAiFeedback(f => ({ ...f, [i]: null }));
                                                        if (m.id) fetch("/api/tutor/feedback", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message_id: m.id }) });
                                                    } else {
                                                        setFeedbackText("");
                                                        setFeedbackSubmitted(false);
                                                        setFeedbackModal({ messageIndex: i, type: "down" });
                                                        track("ask_feedback_given", { sentiment: "negative" });
                                                    }
                                                }}
                                                className={MESSAGE_ACTION_BUTTON_CLASS}
                                                aria-label="Give negative feedback"
                                                style={aiFeedback[i] === "down" ? { color: "var(--destructive, #ef4444)" } : undefined}
                                            >
                                                <IconThumbsDown className="w-4 h-4" />
                                            </button>
                                        </TooltipHint>
                                        {/* Read aloud — powered by Sarvam Bulbul TTS */}
                                        <TooltipHint label={speakingId === String(i) ? "Stop" : "Read aloud"}>
                                            <button
                                                type="button"
                                                onClick={() => { if (speakingId !== String(i)) track("ask_tts_played"); speakTTS(String(i), m.content); }}
                                                className="h-8 px-1.5 sm:px-2.5 shrink-0 rounded-md flex items-center gap-[5px] bg-transparent transition-all duration-150 hover:bg-slate-200/60 active:scale-95 cursor-pointer"
                                                style={{ color: speakingId === String(i) ? "var(--primary-400)" : "var(--base-500)" }}
                                                aria-label={speakingId === String(i) ? "Stop" : "Read aloud"}
                                            >
                                                {ttsLoading && speakingId === String(i)
                                                    ? <IconSpinner className="w-4 h-4" />
                                                    : speakingId === String(i)
                                                        ? <IconCircleStop className="w-4 h-4" />
                                                        : <IconVolume2 className="w-4 h-4" />}
                                                <span className="hidden sm:inline" style={{ fontSize: 14, fontWeight: 400 }}>
                                                    {speakingId === String(i) ? "Stop" : "Read aloud"}
                                                </span>
                                            </button>
                                        </TooltipHint>
                                    </div>
                                    {/* Right: Sources button */}
                                    {m.citations && m.citations.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const firstIdx = [...m.citations!].sort((a, b) => a.index - b.index)[0].index;
                                                setSourcesOpen({ msgIndex: i, citationIndex: firstIdx });
                                            }}
                                            className="h-8 px-2.5 shrink-0 rounded-md flex items-center gap-[5px] bg-transparent transition-all duration-150 hover:bg-slate-200/60 active:scale-95 cursor-pointer"
                                            style={{ color: "var(--base-500)" }}
                                            aria-label="View sources"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
                                            </svg>
                                            <span style={{ fontSize: 14, fontWeight: 400 }}>
                                                {m.citations.length} {m.citations.length === 1 ? "Source" : "Sources"}
                                            </span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                );
            });
            })()}
            {/* Live thinking block + streaming response — only shown while not yet done */}
            {streamState && !streamState.isDone && (
                <div className="flex justify-start mt-10">
                    <div className="w-full" style={{ fontFamily: "var(--font-inter)" }}>
                        <ThinkingBlock
                            steps={streamState.steps}
                            isDone={streamState.isDone}
                            isStreaming={streamState.isStreaming}
                            elapsed={streamState.elapsed}
                            sourcesCount={streamState.sourcesCount}
                        />
                        {streamingDisplayText && (() => {
                            let splitAt = 0;
                            const lastPara = streamingDisplayText.lastIndexOf("\n\n");
                            if (lastPara >= 0) {
                                splitAt = lastPara + 2;
                            } else {
                                const blockRe = /\n(?=[-*+>]|\d+\.\s|#{1,6}\s|```)/g;
                                let m: RegExpExecArray | null;
                                let lastBlock = -1;
                                while ((m = blockRe.exec(streamingDisplayText)) !== null) lastBlock = m.index + 1;
                                if (lastBlock > 10 && streamingDisplayText.length - lastBlock > 5) splitAt = lastBlock;
                            }
                            const settled = streamingDisplayText.slice(0, splitAt);
                            const fresh = streamingDisplayText.slice(splitAt);
                            return (
                                <div className="w-full text-[16px] leading-8" style={{ color: "var(--base-800)" }}>
                                    {settled && (
                                        <MarkdownRenderer
                                            content={settled}
                                            graphArtifacts={streamingGraphArtifacts}
                                            renderPendingGraphs
                                        />
                                    )}
                                    {fresh && (
                                        <motion.div
                                            key={`ask-fresh-${splitAt}`}
                                            initial={{ opacity: 0, filter: "blur(8px)", y: 4 }}
                                            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                                            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                                        >
                                            <MarkdownRenderer
                                                content={fresh}
                                                graphArtifacts={streamingGraphArtifacts}
                                                renderPendingGraphs
                                            />
                                        </motion.div>
                                    )}
                                    {streamState.isStreaming && (
                                        <span
                                            className="inline-block w-[2px] h-[1em] ml-[1px] animate-pulse align-middle"
                                            style={{ background: "var(--base-500)" }}
                                        />
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}
            {/* Spacer: gives the user message room to sit at the top while AI is responding.
                Collapses naturally as AI content fills in. */}
            {streamState && !streamState.isDone && (
                <div style={{ minHeight: "45vh" }} />
            )}
            <div ref={messagesEndRef} />
        </div>
    );

    if (isChatView) {
        return (
            <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div className="flex h-full min-h-0 overflow-hidden">
                <div
                    className={`relative flex min-h-0 w-full flex-1 flex-col bg-[#fcfcfc] transition-all duration-300 h-full ${
                        docPanel.open ? "lg:mr-[500px]" : ""
                    }`}
                >
                    {/* Scroll-to-bottom button */}
                    <AnimatePresence>
                        {!isAtBottom && (
                            <motion.button
                                key="scroll-to-bottom"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 6 }}
                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                onClick={() => scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: "smooth" })}
                                style={{
                                    position: "absolute",
                                    bottom: 160,
                                    left: "calc(50% - 18px)",
                                    zIndex: 20,
                                    width: 36,
                                    height: 36,
                                    borderRadius: "50%",
                                    background: "rgba(255,255,255,0.85)",
                                    border: "0.5px solid #d1d5db",
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    backdropFilter: "blur(6px)",
                                }}
                                aria-label="Scroll to bottom"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
                                </svg>
                            </motion.button>
                        )}
                    </AnimatePresence>
                    <div
                        ref={scrollContainerRef}
                        className="scrollbar-chat flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y"
                    >
                        <div className="flex flex-col justify-end min-h-full">
                            <div className="mx-auto w-full px-3 min-[480px]:px-6 pt-8 min-[480px]:pt-10 pb-36 min-[480px]:pb-44" style={{ maxWidth: CHAT_WIDTH }}>
                                {pendingShareToken && (
                                    <div
                                        className="mb-5 rounded-xl border border-[#fcd34d] bg-[#fffbeb] px-4 py-3 text-[13px] leading-snug"
                                        style={{ fontFamily: "var(--font-inter)", color: "var(--base-800)" }}
                                        role="status"
                                    >
                                        You&apos;re viewing a shared tutor chat. When you send a message, we&apos;ll save a copy to{" "}
                                        <span className="font-semibold">your</span> chat history and continue from there.
                                    </div>
                                )}
                                {messageList}
                            </div>
                        </div>
                    </div>
                    <div className="shrink-0 px-3 min-[480px]:px-6 pb-4 min-[480px]:pb-6 pt-0 border-t border-[var(--base-100)] bg-[#fcfcfc]">
                        <div
                            className="mx-auto flex w-full min-w-0 justify-center transition-[max-width] duration-200 ease-out"
                            style={{ maxWidth: CHAT_WIDTH }}
                        >
                            <DashboardTextbox
                                ref={textboxRef}
                                placeholder={placeholder}
                                initialSubjectId={initialSubject}
                                forceExpanded
                                onSendMessage={handleSendMessage}
                                isStreaming={!!(streamState && !streamState.isDone) || isDocStreaming}
                                onStop={() => {
                                    abortControllerRef.current?.abort();
                                    docAbortControllerRef.current?.abort();
                                }}
                                currentSessionId={activeSessionId}
                                onSubjectSelectionChange={onChatSubjectPickerChange}
                                subjectOptions={filteredSubjectOptions}
                                externalTask={quickTaskSelection}
                                onExternalTaskChange={setQuickTaskSelection}
                                onMultilineComposerChange={setWideComposerLayout}
                            />
                        </div>
                    </div>
                </div>

                {/* Document preview — full-screen modal */}
                {docPanel.open && docPanel.document && createPortal(
                    <AnimatePresence>
                        <motion.div
                            key="doc-modal-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-[9990] flex items-center justify-center p-4 sm:p-8"
                            style={{ backdropFilter: "blur(14px)", background: "rgba(0,0,0,0.55)" }}
                            onClick={(e) => {
                                if (e.target === e.currentTarget)
                                    setDocPanel({ open: false, document: null, doc_id: null, regenerating_topics: [] });
                            }}
                        >
                            <motion.div
                                key="doc-modal-panel"
                                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.97, y: 6 }}
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                className="w-full"
                                style={{ maxWidth: 860 }}
                                onClick={e => e.stopPropagation()}
                            >
                                <DocumentPreviewPanel
                                    document={docPanel.document}
                                    regenerating_topics={docPanel.regenerating_topics}
                                    onClose={() => setDocPanel({ open: false, document: null, doc_id: null, regenerating_topics: [] })}
                                />
                            </motion.div>
                        </motion.div>
                    </AnimatePresence>,
                    document.body
                )}

                </div>

                {/* ── Feedback modal ──────────────────────────────────────────── */}
                {feedbackModal && createPortal(
                    <AnimatePresence>
                        <motion.div
                            key="feedback-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-[9999] flex items-center justify-center"
                            style={{ backdropFilter: "blur(12px)", background: "rgba(0,0,0,0.45)" }}
                            onClick={() => setFeedbackModal(null)}
                        >
                            <motion.div
                                key="feedback-card"
                                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                onClick={e => e.stopPropagation()}
                                style={{
                                    fontFamily: "var(--font-inter)",
                                    width: "min(480px, calc(100vw - 2rem))",
                                    maxWidth: "calc(100vw - 2rem)",
                                    background: "var(--base-100)",
                                    border: "1px solid var(--base-200)",
                                    borderRadius: 16,
                                    boxShadow: "0 10px 15px -3px rgba(43,127,255,0.10), 0 4px 6px -4px rgba(43,127,255,0.10)",
                                    overflow: "hidden",
                                }}
                            >
                                {feedbackSubmitted ? (
                                    /* ── Thank-you state ── */
                                    <div style={{ padding: "40px 32px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                                        <div style={{
                                            width: 48, height: 48, borderRadius: "50%",
                                            background: "var(--primary-10)", display: "flex", alignItems: "center", justifyContent: "center",
                                        }}>
                                            <IconCheck className="w-5 h-5 text-[var(--primary-400)]" />
                                        </div>
                                        <p style={{ fontSize: 18, fontWeight: 600, color: "var(--base-800)" }}>Thanks for your feedback!</p>
                                        <p style={{ fontSize: 14, color: "var(--base-400)", lineHeight: 1.5 }}>
                                            Your input helps us improve Lerno&apos;s responses over time.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setFeedbackModal(null)}
                                            style={{
                                                marginTop: 8, height: 40, padding: "0 24px", borderRadius: 10,
                                                background: "var(--primary-400)", color: "#fff",
                                                fontSize: 14, fontWeight: 500, border: "none", cursor: "pointer",
                                            }}
                                        >
                                            Done
                                        </button>
                                    </div>
                                ) : (
                                    /* ── Input state ── */
                                    <>
                                        <div style={{ padding: "28px 28px 24px" }}>
                                            <p style={{ fontSize: 20, fontWeight: 600, color: "var(--base-800)", marginBottom: 6 }}>
                                                {feedbackModal.type === "up" ? "What did Lerno get right?" : "What could Lerno do better?"}
                                            </p>
                                            <p style={{ fontSize: 14, color: "var(--base-500)", marginBottom: 20 }}>
                                                Please provide details&nbsp;
                                                <span style={{ color: "var(--base-400)" }}>(optional)</span>
                                            </p>
                                            <textarea
                                                autoFocus
                                                value={feedbackText}
                                                onChange={e => setFeedbackText(e.target.value)}
                                                placeholder={feedbackModal.type === "up"
                                                    ? "What was helpful or well-explained?"
                                                    : "What was wrong, missing, or confusing?"}
                                                rows={4}
                                                style={{
                                                    width: "100%", resize: "none", outline: "none",
                                                    border: "1px solid var(--base-200)", borderRadius: 12,
                                                    padding: "14px 16px", fontSize: 14, color: "var(--base-600)",
                                                    background: "#fff", lineHeight: 1.6,
                                                    fontFamily: "var(--font-inter)",
                                                    boxSizing: "border-box",
                                                }}
                                                onFocus={e => { e.currentTarget.style.borderColor = "var(--primary-400)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(43,127,255,0.10)"; }}
                                                onBlur={e => { e.currentTarget.style.borderColor = "var(--base-200)"; e.currentTarget.style.boxShadow = "none"; }}
                                            />
                                            <p style={{ fontSize: 12, color: "var(--base-400)", marginTop: 12, lineHeight: 1.5 }}>
                                                Your feedback is used to improve Lerno. Conversation context may be reviewed by our team.
                                            </p>
                                        </div>
                                        <div style={{
                                            padding: "16px 28px", borderTop: "1px solid var(--base-200)",
                                            background: "#fff", display: "flex", justifyContent: "flex-end", gap: 10,
                                        }}>
                                            <button
                                                type="button"
                                                onClick={() => setFeedbackModal(null)}
                                                style={{
                                                    height: 40, padding: "0 20px", borderRadius: 10,
                                                    border: "1px solid var(--base-200)", background: "#fff",
                                                    fontSize: 14, fontWeight: 500, color: "var(--base-600)",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const targetMsg = messages[feedbackModal.messageIndex];
                                                    setAiFeedback(f => ({ ...f, [feedbackModal.messageIndex]: feedbackModal.type }));
                                                    setFeedbackSubmitted(true);
                                                    if (targetMsg?.id && activeSessionId) {
                                                        fetch("/api/tutor/feedback", {
                                                            method: "POST",
                                                            headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({
                                                                message_id: targetMsg.id,
                                                                session_id: activeSessionId,
                                                                type: feedbackModal.type,
                                                                comment: feedbackText.trim() || undefined,
                                                            }),
                                                        }).catch(err => console.error("[feedback] save failed:", err));
                                                    }
                                                }}
                                                style={{
                                                    height: 40, padding: "0 20px", borderRadius: 10,
                                                    background: "var(--primary-400)", color: "#fff",
                                                    fontSize: 14, fontWeight: 500, border: "none",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                Submit
                                            </button>
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        </motion.div>
                    </AnimatePresence>,
                    document.body
                )}
                {mounted && createPortal(
                    <AnimatePresence>
                        {rateLimitMsg && (
                            <motion.div
                                key="rate-limit-toast"
                                initial={{ opacity: 0, x: 80 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 80 }}
                                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                                className="fixed top-[120px] right-6 z-[10001] pl-4 pr-2 py-2.5 rounded-xl flex items-center gap-3"
                                style={{
                                    fontFamily: "var(--font-inter)",
                                    color: "var(--yellow-200)",
                                    fontSize: "14px",
                                    backgroundColor: "var(--yellow-10)",
                                    border: "1px solid rgba(255, 219, 67, 0.2)",
                                    boxShadow: "0 2px 12px -4px rgba(0,0,0,0.06)",
                                    maxWidth: 380,
                                }}
                            >
                                <Clock className="w-4 h-4 shrink-0" style={{ color: "var(--yellow-200)" }} />
                                <span>{rateLimitMsg}</span>
                                <button
                                    type="button"
                                    onClick={() => setRateLimitMsg(null)}
                                    className="shrink-0 p-1 rounded-md hover:bg-white transition-colors cursor-pointer"
                                    aria-label="Dismiss"
                                >
                                    <X className="w-5 h-5" style={{ color: "var(--yellow-200)" }} />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
        <div className="flex w-full max-w-full min-w-0 flex-col items-center gap-9 px-3 pb-20 pt-16 sm:gap-12 sm:px-6 sm:pt-[135px]">
            {/* Frame 1: Heading + Subtext */}
            <div className="flex flex-col gap-2.5 sm:gap-3 items-center text-center">
                <h1
                    className="text-[36px] sm:text-[48px] font-semibold leading-tight"
                    style={{
                        fontFamily: "var(--font-crimson-pro)",
                        color: "var(--base-800)",
                    }}
                >
                    {heading.title}
                </h1>
                <p
                    className="text-[14px] sm:text-base"
                    style={{
                        fontFamily: "var(--font-inter)",
                        fontWeight: 400,
                        lineHeight: "135%",
                        letterSpacing: "-0.02em",
                        color: "#666666",
                    }}
                >
                    {heading.subtext}
                </p>
            </div>

            {/* Frame 2: Toggle */}
            <div
                className="flex gap-1 p-[3.5px] rounded-full"
                style={{ backgroundColor: "#F5F5F5" }}
            >
                <div className="flex-1 relative flex justify-center">
                    {mode === "learn" && (
                        <motion.div
                            layoutId="toggle-pill"
                            className="absolute inset-0 rounded-full bg-white"
                            transition={{
                                type: "spring",
                                stiffness: 500,
                                damping: 35,
                            }}
                        />
                    )}
                    <button
                        type="button"
                        onClick={() => { startTopLoader(); router.push("/learn"); }}
                        className="relative z-10 h-9 px-3.5 rounded-full text-[14px] font-medium cursor-pointer"
                        style={{
                            fontFamily: "var(--font-inter)",
                            color: "var(--base-800)",
                        }}
                    >
                        Learn
                    </button>
                </div>
                <div className="flex-1 relative flex justify-center">
                    {mode === "ask" && (
                        <motion.div
                            layoutId="toggle-pill"
                            className="absolute inset-0 rounded-full bg-white"
                            transition={{
                                type: "spring",
                                stiffness: 500,
                                damping: 35,
                            }}
                        />
                    )}
                    <button
                        type="button"
                        onClick={() => { startTopLoader(); router.push("/ask"); }}
                        className="relative z-10 h-9 px-3.5 rounded-full text-[14px] font-medium cursor-pointer"
                        style={{
                            fontFamily: "var(--font-inter)",
                            color: "var(--base-800)",
                        }}
                    >
                        Ask
                    </button>
                </div>
            </div>

            {/* Frame 3: Subject Selector (Learn mode) OR Textbox + Quick Prompts (Ask mode) */}
            {mode === "learn" ? (
                <SubjectSelector grade={grade} />
            ) : (
                <div
                    className={`flex w-full min-w-0 flex-col items-center gap-5 px-0 min-[480px]:px-0 sm:gap-6 sm:px-3 ${
                        wideComposerLayout ? "max-w-[min(920px,calc(100vw-1.5rem))]" : "max-w-[740px]"
                    }`}
                >
                    <DashboardTextbox
                        ref={textboxRef}
                        placeholder={placeholder}
                        initialSubjectId={initialSubject}
                        onSendMessage={handleSendMessage}
                        isStreaming={!!(streamState && !streamState.isDone) || isDocStreaming}
                        onStop={() => {
                            abortControllerRef.current?.abort();
                            docAbortControllerRef.current?.abort();
                        }}
                        currentSessionId={activeSessionId}
                        onSubjectSelectionChange={onChatSubjectPickerChange}
                        subjectOptions={filteredSubjectOptions}
                        externalTask={quickTaskSelection}
                        onExternalTaskChange={setQuickTaskSelection}
                        onMultilineComposerChange={setWideComposerLayout}
                    />
                    {/* Task buttons + quick prompts — share a single width anchor */}
                    <div className="flex flex-col items-center gap-3 w-full">
                        {/* Task mode buttons */}
                        <div className="flex flex-wrap justify-center gap-2">
                            {QUICK_TASKS.map((task) => {
                                const Icon = TASK_ICONS[task];
                                const isActive = quickTaskSelection === task;
                                return (
                                    <button
                                        key={task}
                                        type="button"
                                        onClick={() => setQuickTaskSelection(isActive ? null : task)}
                                        className={`shrink-0 flex items-center gap-2 whitespace-nowrap cursor-pointer rounded-xl border transition-colors duration-150 active:scale-[0.97] h-9 px-4 text-[14px] ${
                                            isActive
                                                ? "bg-[#EBF4FF] border-[#C5DEFF] text-[var(--primary-500)]"
                                                : "bg-white border-[var(--base-200)] text-[var(--base-600)] hover:bg-[var(--base-100)] hover:border-[var(--base-300)]"
                                        }`}
                                        style={{ fontFamily: "var(--font-inter)", fontWeight: 400 }}
                                    >
                                        <Icon className="shrink-0 w-4 h-4" />
                                        <span className="sm:hidden text-[12px]">{QUICK_TASK_SHORT[task] ?? task}</span>
                                        <span className="hidden sm:inline">{task}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Quick prompts — draws from user's active subjects */}
                        <AnimatePresence mode="wait">
                            {quickTaskSelection && displayedPrompts.length > 0 && (
                                <motion.div
                                    key={quickTaskSelection}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 3 }}
                                    transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                                    className="w-full max-w-[560px]"
                                >
                                    <div
                                        className="rounded-[14px] overflow-hidden"
                                        style={{ border: "1px solid var(--base-200)", backgroundColor: "#fff" }}
                                    >
                                        {displayedPrompts.map((prompt, i) => (
                                            <button
                                                key={prompt}
                                                type="button"
                                                onClick={() => handleInsertPrompt(prompt)}
                                                className="quick-prompt-btn w-full flex items-center text-left cursor-pointer px-4 py-3 transition-colors duration-100"
                                                style={{
                                                    fontFamily: "var(--font-inter)",
                                                    fontWeight: 400,
                                                    fontSize: "13.5px",
                                                    color: "var(--base-500)",
                                                    borderBottom: i < displayedPrompts.length - 1 ? "1px solid #F1F5F9" : "none",
                                                    backgroundColor: "transparent",
                                                }}
                                            >
                                                {prompt}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            )}

            {/* Frame 4: Quick Resources (subjects + chapter cards) - HIDDEN until we wire it up */}
            <div className="hidden w-full max-w-[900px] flex flex-col gap-4">
                <div className="flex justify-center gap-2 overflow-x-auto overflow-y-hidden scrollbar-minimal pb-1">
                    {SUBJECT_FILTER_OPTIONS.map((subject) => {
                        const isSelected = selectedSubject === subject;
                        return (
                            <button
                                key={subject}
                                type="button"
                                onClick={() => setSelectedSubject(subject)}
                                className="shrink-0 h-9 px-4 rounded-full text-[14px] font-normal cursor-pointer transition-colors duration-150"
                                style={{
                                    fontFamily: "var(--font-inter)",
                                    color: isSelected ? "var(--primary-400)" : "var(--base-400)",
                                    backgroundColor: isSelected ? "var(--primary-10)" : "transparent",
                                    borderWidth: 1,
                                    borderStyle: "solid",
                                    borderColor: isSelected ? "var(--primary-400)" : "var(--base-200)",
                                }}
                            >
                                {subject}
                            </button>
                        );
                    })}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {filteredResources.map((resource) => (
                        <button
                            key={`${resource.subjectId}-${resource.title}`}
                            type="button"
                            className="group flex flex-col rounded-xl border border-[var(--base-200)] bg-white overflow-hidden cursor-pointer transition-shadow duration-150 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-left"
                            style={{
                                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                            }}
                        >
                            <div className="aspect-[4/3] bg-[var(--base-100)] rounded-t-xl" />
                            <div className="p-3 flex flex-col gap-1.5">
                                <span
                                    className="text-[14px] font-normal line-clamp-2"
                                    style={{
                                        fontFamily: "var(--font-inter)",
                                        color: "var(--base-800)",
                                    }}
                                >
                                    {resource.title}
                                </span>
                                <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--base-400)" }}>
                                    <Clock className="w-3.5 h-3.5 shrink-0" />
                                    <span style={{ fontFamily: "var(--font-inter)" }}>{resource.subject}</span>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
        </div>
    );
}
