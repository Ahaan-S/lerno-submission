"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { getAiTutorSubjectOptionsForGrade, mergeProfileSubjectsForTutorSubjects } from "@/lib/chapters";
import { ProfileSettingsPanel } from "@/components/profile/ProfileSettingsPanel";
import Link from "next/link";
import { invalidateProfileMe, useProfileMe } from "@/hooks/use-profile-me";

export type AccountSettingsMode = "settings" | "help";

export type SettingsSectionId =
    | "account"
    | "profile"
    | "personalization"
    | "notifications"
    | "pricing";


type AccountUser = {
    email?: string | null;
    user_metadata?: { full_name?: string } | null;
};

function getDisplayName(user: AccountUser): string {
    const name = user.user_metadata?.full_name;
    if (name && typeof name === "string" && name.trim()) return name.trim();
    const email = user.email ?? "";
    return email.split("@")[0] || "User";
}

function normalizeGrade(value: unknown): "Class 10" | "Class 11" {
    const str = String(value ?? "").trim();
    if (str === "Class 11" || str === "11") return "Class 11";
    return "Class 10";
}

function getDefaultSubjectsForGrade(grade: "Class 10" | "Class 11"): string[] {
    return getAiTutorSubjectOptionsForGrade(grade).map((s) => s.id);
}

function ProfilePublicLink() {
    const [uid, setUid] = useState<string | null>(null);
    useEffect(() => {
        void createClient()
            .auth.getUser()
            .then(({ data }) => setUid(data.user?.id ?? null));
    }, []);
    if (!uid) return null;
    return (
        <div className="mt-6 pt-4 border-t border-[var(--base-200)]">
            <Link
                href={`/profile/${uid}`}
                className="text-[13px] font-semibold text-[var(--primary-500)] hover:underline"
                style={{ fontFamily: "var(--font-inter)" }}
            >
                View my public profile
            </Link>
        </div>
    );
}

const SETTINGS_NAV: { id: SettingsSectionId; label: string; icon: React.ReactNode }[] = [
    {
        id: "account",
        label: "Account",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                <path d="M17.925 20.056a6 6 0 0 0-11.851.001" /><circle cx="12" cy="11" r="4" /><circle cx="12" cy="12" r="10" />
            </svg>
        ),
    },
    {
        id: "profile",
        label: "Public profile",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                <circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0 1 16 0" />
            </svg>
        ),
    },
    {
        id: "personalization",
        label: "Personalisation",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
            </svg>
        ),
    },
    {
        id: "notifications",
        label: "Notifications",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                <path d="M10.268 21a2 2 0 0 0 3.464 0" />
                <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
            </svg>
        ),
    },
    {
        id: "pricing",
        label: "Pricing",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                <path d="M6 3h12" /><path d="M6 8h12" /><path d="m6 13 8.5 8" /><path d="M6 13h3" />
                <path d="M9 13c6.667 0 6.667-10 0-10" />
            </svg>
        ),
    },
];


const LEARNING_STYLE_OPTIONS = [
    { id: "step-by-step", label: "Step-by-step" },
    { id: "examples", label: "Examples & Diagrams" },
    { id: "memory", label: "Memory tricks" },
    { id: "breakdown", label: "Breaking down topics" },
    { id: "short", label: "Short & quick" },
] as const;

function CustomSelect({
    value,
    onChange,
    options,
}: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
}) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const currentLabel = options.find((o) => o.value === value)?.label ?? value;

    const openMenu = () => {
        if (!btnRef.current) return;
        const rect = btnRef.current.getBoundingClientRect();
        setPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 120) });
        setOpen(true);
    };

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
    }, [open]);

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onClick={() => open ? setOpen(false) : openMenu()}
                className="flex items-center justify-between gap-3 min-w-[120px] rounded-xl border border-[var(--base-300)] bg-white px-3 py-2 text-[14px] text-[var(--base-700)] hover:border-[var(--base-400)] transition-colors cursor-pointer"
                style={{ fontFamily: "var(--font-inter)" }}
            >
                <span>{currentLabel}</span>
                <svg
                    width="12" height="12" viewBox="0 0 12 12" fill="none"
                    className={`shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
                    style={{ color: "#94a3b8" }}
                >
                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>
            {open && typeof document !== "undefined" && createPortal(
                <div
                    ref={menuRef}
                    className="fixed z-[10200] bg-white border border-[var(--base-300)] rounded-xl overflow-hidden py-1"
                    style={{
                        top: pos.top,
                        left: pos.left,
                        minWidth: pos.width,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
                    }}
                >
                    {options.map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            onClick={() => { onChange(o.value); setOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-[14px] cursor-pointer transition-colors ${
                                o.value === value
                                    ? "bg-[var(--base-100)] text-[var(--base-800)] font-medium"
                                    : "text-[var(--base-600)] hover:bg-[var(--base-100)]"
                            }`}
                            style={{ fontFamily: "var(--font-inter)" }}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
}

function SettingsRow({
    label,
    description,
    control,
}: {
    label: string;
    description?: string;
    control: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6 py-4 border-b border-[var(--base-200)] last:border-0">
            <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-[var(--base-800)]" style={{ fontFamily: "var(--font-inter)" }}>
                    {label}
                </p>
                {description ? (
                    <p className="text-[12px] text-[var(--base-500)] mt-0.5 leading-snug" style={{ fontFamily: "var(--font-inter)" }}>
                        {description}
                    </p>
                ) : null}
            </div>
            <div className="shrink-0 flex items-center justify-end pt-0.5 sm:pt-0">{control}</div>
        </div>
    );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`relative h-7 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
                checked ? "bg-[var(--primary-400)]" : "bg-[var(--base-200)]"
            }`}
        >
            <span
                className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    checked ? "translate-x-4" : "translate-x-0"
                }`}
            />
        </button>
    );
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

function PersonalizationPanel({
    onDirtyChange,
    onSaveStatusChange,
    saveTriggerRef,
}: {
    onDirtyChange: (dirty: boolean) => void;
    onSaveStatusChange: (status: SaveStatus) => void;
    saveTriggerRef: React.MutableRefObject<(() => Promise<void>) | null>;
}) {
    const [baseStyle, setBaseStyle] = useState("default");
    const [warm, setWarm] = useState("default");
    const [enthusiastic, setEnthusiastic] = useState("default");
    const [headersLists, setHeadersLists] = useState("default");
    const [emoji, setEmoji] = useState("default");
    const [learningStyle, setLearningStyle] = useState<string[]>(["step-by-step"]);
    const [customInstructions, setCustomInstructions] = useState("");

    type Originals = {
        baseStyle: string; warm: string; enthusiastic: string;
        headersLists: string; emoji: string; learningStyle: string[]; customInstructions: string;
    };
    const [originals, setOriginals] = useState<Originals>({
        baseStyle: "default", warm: "default", enthusiastic: "default",
        headersLists: "default", emoji: "default", learningStyle: ["step-by-step"], customInstructions: "",
    });

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) return;
            supabase
                .from("profiles")
                .select("tutor_preferences, learning_style, additional_info")
                .eq("id", user.id)
                .maybeSingle()
                .then(({ data }) => {
                    const ci = data?.additional_info ? String(data.additional_info) : "";
                    const ls: string[] =
                        Array.isArray(data?.learning_style) && (data.learning_style as string[]).length > 0
                            ? (data.learning_style as string[])
                            : ["step-by-step"];
                    const prefs = (data?.tutor_preferences ?? {}) as Record<string, string>;
                    const bs = prefs.base_style ?? "default";
                    const w = prefs.warm ?? "default";
                    const en = prefs.enthusiastic ?? "default";
                    const hl = prefs.headers_lists ?? "default";
                    const em = prefs.emoji ?? "default";

                    setCustomInstructions(ci);
                    setLearningStyle(ls);
                    setBaseStyle(bs); setWarm(w); setEnthusiastic(en); setHeadersLists(hl); setEmoji(em);
                    setOriginals({ baseStyle: bs, warm: w, enthusiastic: en, headersLists: hl, emoji: em, learningStyle: ls, customInstructions: ci });
                });
        });
    }, []);

    const isDirty = useMemo(() =>
        baseStyle !== originals.baseStyle ||
        warm !== originals.warm ||
        enthusiastic !== originals.enthusiastic ||
        headersLists !== originals.headersLists ||
        emoji !== originals.emoji ||
        customInstructions !== originals.customInstructions ||
        JSON.stringify([...learningStyle].sort()) !== JSON.stringify([...originals.learningStyle].sort()),
    [baseStyle, warm, enthusiastic, headersLists, emoji, customInstructions, learningStyle, originals]);

    useEffect(() => { onDirtyChange(isDirty); }, [isDirty, onDirtyChange]);

    const saveAll = useCallback(async () => {
        onSaveStatusChange("saving");
        try {
            const supabase = createClient();
            const { data: auth } = await supabase.auth.getUser();
            if (!auth.user) throw new Error("no user");
            const { error } = await supabase
                .from("profiles")
                .update({
                    tutor_preferences: { base_style: baseStyle, warm, enthusiastic, headers_lists: headersLists, emoji },
                    learning_style: learningStyle,
                    additional_info: customInstructions.trim() || null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", auth.user.id);
            if (error) throw error;
            setOriginals({ baseStyle, warm, enthusiastic, headersLists, emoji, learningStyle: [...learningStyle], customInstructions });
            onSaveStatusChange("saved");
            setTimeout(() => onSaveStatusChange("idle"), 3000);
        } catch {
            onSaveStatusChange("error");
        }
    }, [baseStyle, warm, enthusiastic, headersLists, emoji, learningStyle, customInstructions, onSaveStatusChange]);

    useEffect(() => { saveTriggerRef.current = saveAll; }, [saveAll, saveTriggerRef]);

    const toggleLearningStyle = (id: string) => {
        setLearningStyle((prev) => {
            if (prev.includes(id)) {
                if (prev.length <= 1) return prev;
                return prev.filter((s) => s !== id);
            }
            return [...prev, id];
        });
    };

    const CHAR_OPTIONS = [
        { value: "default", label: "Default" },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
    ];
    const BASE_STYLE_OPTIONS = [
        { value: "default", label: "Default" },
        { value: "concise", label: "Concise" },
        { value: "detailed", label: "Detailed" },
        { value: "friendly", label: "Friendly" },
    ];

    return (
        <div className="max-w-lg">
            <SettingsRow
                label="Base style and tone"
                description="Overall tone of how your tutor responds."
                control={<CustomSelect value={baseStyle} onChange={setBaseStyle} options={BASE_STYLE_OPTIONS} />}
            />
            <div className="pt-3 pb-1.5">
                <p className="text-[14px] font-medium text-[var(--base-800)]" style={{ fontFamily: "var(--font-inter)" }}>
                    Characteristics
                </p>
                <p className="text-[12px] text-[var(--base-500)] mt-0.5" style={{ fontFamily: "var(--font-inter)" }}>
                    Fine-tune on top of your base style.
                </p>
            </div>
            <SettingsRow label="Warm" control={<CustomSelect value={warm} onChange={setWarm} options={CHAR_OPTIONS} />} />
            <SettingsRow label="Enthusiastic" control={<CustomSelect value={enthusiastic} onChange={setEnthusiastic} options={CHAR_OPTIONS} />} />
            <SettingsRow label="Headers & lists" control={<CustomSelect value={headersLists} onChange={setHeadersLists} options={CHAR_OPTIONS} />} />
            <SettingsRow label="Emoji" control={<CustomSelect value={emoji} onChange={setEmoji} options={CHAR_OPTIONS} />} />
            {/* Learning style */}
            <div className="py-4 border-t border-[var(--base-200)] mt-1">
                <p className="text-[14px] font-medium text-[var(--base-800)] mb-1" style={{ fontFamily: "var(--font-inter)" }}>
                    Learning style
                </p>
                <p className="text-[12px] text-[var(--base-500)] mb-3" style={{ fontFamily: "var(--font-inter)" }}>
                    How your tutor explains concepts. Select all that apply.
                </p>
                <div className="flex flex-wrap gap-2">
                    {LEARNING_STYLE_OPTIONS.map(({ id, label }) => {
                        const isSelected = learningStyle.includes(id);
                        const isOnly = learningStyle.length === 1 && isSelected;
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => toggleLearningStyle(id)}
                                disabled={isOnly}
                                className={`px-3.5 py-1.5 rounded-full border text-[13px] font-medium transition-colors cursor-pointer ${
                                    isOnly ? "opacity-50 cursor-not-allowed " : ""
                                }${
                                    isSelected
                                        ? "bg-[var(--primary-50)] border-[var(--primary-300)] text-[var(--primary-600)]"
                                        : "bg-white border-[var(--base-300)] text-[var(--base-500)] hover:border-[var(--base-400)] hover:text-[var(--base-700)]"
                                }`}
                                style={{ fontFamily: "var(--font-inter)" }}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>
            {/* Custom instructions */}
            <div className="py-4 border-t border-[var(--base-200)]">
                <p className="text-[14px] font-medium text-[var(--base-800)] mb-1" style={{ fontFamily: "var(--font-inter)" }}>
                    Custom instructions
                </p>
                <p className="text-[12px] text-[var(--base-500)] mb-2.5" style={{ fontFamily: "var(--font-inter)" }}>
                    Any additional behaviour or preferences for your tutor.
                </p>
                <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="e.g. Always show worked examples before theory."
                    rows={3}
                    className="w-full rounded-xl border border-[var(--base-300)] bg-white px-3 py-2.5 text-[14px] text-slate-800 placeholder:text-[var(--base-400)] outline-none focus:border-[var(--base-400)] resize-none"
                    style={{ fontFamily: "var(--font-inter)" }}
                />
            </div>
        </div>
    );
}

export function AccountSettingsModal({
    open,
    onClose,
    mode,
    initialSettingsSection = "account",
    user,
}: {
    open: boolean;
    onClose: () => void;
    mode: AccountSettingsMode;
    initialSettingsSection?: SettingsSectionId;
    user: AccountUser;
}) {
    const [settingsTab, setSettingsTab] = useState<SettingsSectionId>(initialSettingsSection);
    const [emailNotif, setEmailNotif] = useState(true);
    const [studyReminders, setStudyReminders] = useState(true);
    const [origEmailNotif, setOrigEmailNotif] = useState(true);
    const [origStudyReminders, setOrigStudyReminders] = useState(true);
    const [notifSaveStatus, setNotifSaveStatus] = useState<SaveStatus>("idle");
    const [profileFullName, setProfileFullName] = useState(() => getDisplayName(user));
    const [gradeLevel, setGradeLevel] = useState<"Class 10" | "Class 11">("Class 10");
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>(getDefaultSubjectsForGrade("Class 10"));
    const [originalName, setOriginalName] = useState(() => getDisplayName(user));
    const [originalGradeLevel, setOriginalGradeLevel] = useState<"Class 10" | "Class 11">("Class 10");
    const [originalSubjects, setOriginalSubjects] = useState<string[]>(getDefaultSubjectsForGrade("Class 10"));
    const [accountSaveStatus, setAccountSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [accountSaveError, setAccountSaveError] = useState<string | null>(null);
    const [persDirty, setPersDirty] = useState(false);
    const [persSaveStatus, setPersSaveStatus] = useState<SaveStatus>("idle");
    const persSaveRef = useRef<(() => Promise<void>) | null>(null);
    /** Slide-over section list on small viewports (full-width content when closed). */
    const [mobileSectionNavOpen, setMobileSectionNavOpen] = useState(false);

    const router = useRouter();
    // SWR-backed profile — deduped with sidebar; zero extra round-trip when cache is warm.
    const { data: profileData } = useProfileMe();
    // Guard: seed form state once each time the modal opens so in-flight edits are not overwritten.
    const seededRef = useRef(false);

    useEffect(() => {
        if (!open) {
            seededRef.current = false; // reset so next open re-seeds
            return;
        }
        if (mode !== "settings") return;
        if (seededRef.current || !profileData) return;
        seededRef.current = true;

        const resolvedGrade = normalizeGrade(profileData.grade);
        let resolvedName = getDisplayName(user);
        if (profileData.full_name && profileData.full_name.trim()) {
            resolvedName = profileData.full_name.trim();
        } else {
            const fn = profileData.first_name?.trim() ?? "";
            const ln = profileData.last_name?.trim() ?? "";
            const combined = [fn, ln].filter(Boolean).join(" ");
            if (combined) resolvedName = combined;
        }
        setProfileFullName(resolvedName);
        setOriginalName(resolvedName);
        const allowedSubjectIds = new Set(getDefaultSubjectsForGrade(resolvedGrade));
        const gradeNum = resolvedGrade === "Class 11" ? 11 : 10;
        const merged = mergeProfileSubjectsForTutorSubjects(gradeNum, profileData.selected_subjects);
        const subjectsFromProfile: string[] =
            merged != null
                ? merged.filter((id) => allowedSubjectIds.has(id))
                : getDefaultSubjectsForGrade(resolvedGrade);
        const subjects = subjectsFromProfile.length > 0 ? subjectsFromProfile : getDefaultSubjectsForGrade(resolvedGrade);
        setGradeLevel(resolvedGrade);
        setOriginalGradeLevel(resolvedGrade);
        setSelectedSubjects(subjects);
        setOriginalSubjects(subjects);
        const notifPrefs = (profileData.notification_preferences ?? {}) as Record<string, boolean>;
        const eu = notifPrefs.product_updates !== undefined ? Boolean(notifPrefs.product_updates) : true;
        const sr = notifPrefs.study_reminders !== undefined ? Boolean(notifPrefs.study_reminders) : true;
        setEmailNotif(eu); setOrigEmailNotif(eu);
        setStudyReminders(sr); setOrigStudyReminders(sr);
    }, [open, mode, profileData, user]);

    useEffect(() => {
        if (!open) setMobileSectionNavOpen(false);
    }, [open]);

    useEffect(() => {
        const mq = window.matchMedia("(min-width: 1024px)");
        const onWiden = () => {
            if (mq.matches) setMobileSectionNavOpen(false);
        };
        onWiden();
        mq.addEventListener("change", onWiden);
        return () => mq.removeEventListener("change", onWiden);
    }, []);

    const isAccountDirty = useMemo(() => {
        if (settingsTab !== "account") return false;
        const nameChanged = profileFullName.trim() !== originalName;
        const gradeChanged = gradeLevel !== originalGradeLevel;
        const subjChanged =
            JSON.stringify([...selectedSubjects].sort()) !==
            JSON.stringify([...originalSubjects].sort());
        return nameChanged || gradeChanged || subjChanged;
    }, [settingsTab, profileFullName, originalName, gradeLevel, originalGradeLevel, selectedSubjects, originalSubjects]);

    const isNotifDirty = useMemo(() => {
        if (settingsTab !== "notifications") return false;
        return emailNotif !== origEmailNotif || studyReminders !== origStudyReminders;
    }, [settingsTab, emailNotif, origEmailNotif, studyReminders, origStudyReminders]);

    const showFooter = isAccountDirty || (settingsTab === "personalization" && persDirty) || isNotifDirty;

    const currentSectionLabel = useMemo(() => {
        return SETTINGS_NAV.find((n) => n.id === settingsTab)?.label ?? "Settings";
    }, [settingsTab]);

    useEffect(() => {
        if (!open) return;
        if (mode === "settings") setSettingsTab(initialSettingsSection);
    }, [open, mode, initialSettingsSection]);

    const saveAccount = async () => {
        setAccountSaveError(null);
        const name = profileFullName.trim();
        if (name.length < 2) { setAccountSaveError("Name must be at least 2 characters."); return; }
        if (!/^[a-zA-Z\s'-]+$/.test(name)) { setAccountSaveError("Use letters, spaces, hyphens, or apostrophes only."); return; }
        setAccountSaveStatus("saving");
        try {
            const supabase = createClient();
            const { data: auth } = await supabase.auth.getUser();
            if (!auth.user) throw new Error("no user");
            const parts = name.split(/\s+/);
            const { error: profileError } = await supabase
                .from("profiles")
                .update({
                    full_name: name,
                    first_name: parts[0] || "",
                    last_name: parts.slice(1).join(" ") || "",
                    grade: gradeLevel,
                    selected_subjects: selectedSubjects,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", auth.user.id);
            if (profileError) throw profileError;
            const { error: authError } = await supabase.auth.updateUser({
                data: { full_name: name, name, grade: gradeLevel },
            });
            if (authError) throw authError;
            await supabase.auth.refreshSession();
            setOriginalName(name);
            setOriginalGradeLevel(gradeLevel);
            setOriginalSubjects([...selectedSubjects]);
            setAccountSaveStatus("saved");
            // Refresh RSC layout (updates grade context + user prop)
            router.refresh();
            // Invalidate SWR profile cache so sidebar avatar/display_name update
            void invalidateProfileMe();
            setTimeout(() => setAccountSaveStatus("idle"), 3000);
        } catch {
            setAccountSaveStatus("error");
        }
    };

    const saveNotifications = async () => {
        setNotifSaveStatus("saving");
        try {
            const supabase = createClient();
            const { data: auth } = await supabase.auth.getUser();
            if (!auth.user) throw new Error("no user");
            const { error } = await supabase
                .from("profiles")
                .update({ notification_preferences: { product_updates: emailNotif, study_reminders: studyReminders }, updated_at: new Date().toISOString() })
                .eq("id", auth.user.id);
            if (error) throw error;
            setOrigEmailNotif(emailNotif);
            setOrigStudyReminders(studyReminders);
            setNotifSaveStatus("saved");
            setTimeout(() => setNotifSaveStatus("idle"), 3000);
        } catch {
            setNotifSaveStatus("error");
        }
    };

    const handleChangePassword = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/forgot-password");
    };

    const availableSubjects = useMemo(() => getAiTutorSubjectOptionsForGrade(gradeLevel), [gradeLevel]);

    const handleGradeChange = (nextGrade: "Class 10" | "Class 11") => {
        setGradeLevel(nextGrade);
        setSelectedSubjects(getDefaultSubjectsForGrade(nextGrade));
    };

    const toggleSubject = (id: string) => {
        setSelectedSubjects((prev) => {
            if (prev.includes(id)) {
                if (prev.length <= 1) return prev;
                return prev.filter((s) => s !== id);
            }
            return [...prev, id];
        });
    };

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (mobileSectionNavOpen) {
                setMobileSectionNavOpen(false);
                return;
            }
            onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose, mobileSectionNavOpen]);

    const renderSettingsContent = () => {
        switch (settingsTab) {
            case "profile":
                return (
                    <div className="max-w-lg">
                        <p className="text-[13px] text-[var(--base-500)] mb-4" style={{ fontFamily: "var(--font-inter)" }}>
                            Control how you appear to friends and what appears on your shareable profile page.
                        </p>
                        <ProfileSettingsPanel />
                        <ProfilePublicLink />
                    </div>
                );
            case "account":
                return (
                    <div className="max-w-lg">
                        <SettingsRow
                            label="Email"
                            control={
                                <span className="text-[13px] text-[var(--base-500)] break-all text-right max-w-[200px]" style={{ fontFamily: "var(--font-inter)" }}>
                                    {user.email ?? "—"}
                                </span>
                            }
                        />
                        {/* Name */}
                        <div className="py-4 border-b border-[var(--base-200)]">
                            <div className="flex items-baseline justify-between mb-1">
                                <label htmlFor="settings-display-name" className="text-[14px] font-medium text-[var(--base-800)]" style={{ fontFamily: "var(--font-inter)" }}>
                                    Name
                                </label>
                                <span className="text-[11px] text-[var(--base-400)]" style={{ fontFamily: "var(--font-inter)" }}>
                                    {profileFullName.trim().length}/25
                                </span>
                            </div>
                            <p className="text-[12px] text-[var(--base-500)] mb-2" style={{ fontFamily: "var(--font-inter)" }}>
                                Shown in the sidebar and shared with your tutor.
                            </p>
                            <input
                                id="settings-display-name"
                                type="text"
                                value={profileFullName}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^a-zA-Z\s'-]/g, "");
                                    if (val.length <= 25) setProfileFullName(val);
                                }}
                                autoComplete="name"
                                maxLength={25}
                                className="w-full rounded-xl border border-[var(--base-300)] bg-white px-3 py-2.5 text-[14px] text-slate-800 outline-none focus:border-[var(--base-400)]"
                                style={{ fontFamily: "var(--font-inter)" }}
                            />
                            {accountSaveError && (
                                <p className="text-[12px] text-red-600 mt-1.5" style={{ fontFamily: "var(--font-inter)" }}>{accountSaveError}</p>
                            )}
                        </div>
                        {/* Password */}
                        <div className="py-4 border-b border-[var(--base-200)]">
                            <p className="text-[14px] font-medium text-[var(--base-800)] mb-1" style={{ fontFamily: "var(--font-inter)" }}>Password</p>
                            <p className="text-[12px] text-[var(--base-500)] mb-3" style={{ fontFamily: "var(--font-inter)" }}>Reset or update your password. You will be signed out.</p>
                            <button
                                type="button"
                                onClick={() => void handleChangePassword()}
                                className="px-3.5 py-2 rounded-lg border border-[var(--base-300)] text-[13px] font-medium text-[var(--base-700)] bg-white hover:bg-[var(--base-100)] hover:border-[var(--base-400)] transition-colors cursor-pointer"
                                style={{ fontFamily: "var(--font-inter)" }}
                            >
                                Change password
                            </button>
                        </div>
                        {/* Grade */}
                        <div className="py-4 border-b border-[var(--base-200)]">
                            <p className="text-[14px] font-medium text-[var(--base-800)] mb-1" style={{ fontFamily: "var(--font-inter)" }}>
                                Grade
                            </p>
                            <p className="text-[12px] text-[var(--base-500)] mb-2" style={{ fontFamily: "var(--font-inter)" }}>
                                Your class level for NCERT content and tutoring.
                            </p>
                            <div className="flex items-center gap-2">
                                {(["Class 10", "Class 11"] as const).map((g) => {
                                    const active = gradeLevel === g;
                                    return (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() => handleGradeChange(g)}
                                            className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-[13px] transition-colors cursor-pointer ${
                                                active
                                                    ? "border-[var(--primary-300)] bg-[var(--primary-50)] text-[var(--primary-600)]"
                                                    : "border-[var(--base-300)] bg-white text-[var(--base-600)] hover:border-[var(--base-400)]"
                                            }`}
                                            style={{ fontFamily: "var(--font-inter)" }}
                                        >
                                            {g}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        {/* Subjects */}
                        <div className="py-4">
                            <p className="text-[14px] font-medium text-[var(--base-800)] mb-1" style={{ fontFamily: "var(--font-inter)" }}>
                                Subjects
                            </p>
                            <p className="text-[12px] text-[var(--base-500)] mb-3" style={{ fontFamily: "var(--font-inter)" }}>
                                Choose which subjects appear in your AI tutor and study feed.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {availableSubjects.map(({ id, label }) => {
                                    const isSelected = selectedSubjects.includes(id);
                                    const isOnly = selectedSubjects.length === 1 && isSelected;
                                    return (
                                        <button
                                            key={id}
                                            type="button"
                                            onClick={() => toggleSubject(id)}
                                            disabled={isOnly}
                                            className={`px-3.5 py-1.5 rounded-full border text-[13px] font-medium transition-colors cursor-pointer ${
                                                isOnly ? "opacity-50 cursor-not-allowed " : ""
                                            }${
                                                isSelected
                                                    ? "bg-[var(--primary-50)] border-[var(--primary-300)] text-[var(--primary-600)]"
                                                    : "bg-white border-[var(--base-300)] text-[var(--base-500)] hover:border-[var(--base-400)] hover:text-[var(--base-700)]"
                                            }`}
                                            style={{ fontFamily: "var(--font-inter)" }}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            case "notifications":
                return (
                    <div className="max-w-lg">
                        <SettingsRow
                            label="Product updates"
                            description="Occasional emails about new Lerno features."
                            control={<Toggle checked={emailNotif} onChange={setEmailNotif} />}
                        />
                        <SettingsRow
                            label="Study reminders"
                            description="Optional nudges for your daily study goal."
                            control={<Toggle checked={studyReminders} onChange={setStudyReminders} />}
                        />
                    </div>
                );
            case "personalization":
                return (
                    <PersonalizationPanel
                        onDirtyChange={setPersDirty}
                        onSaveStatusChange={setPersSaveStatus}
                        saveTriggerRef={persSaveRef}
                    />
                );
            case "pricing":
                return (
                    <div className="flex flex-col gap-6 max-w-md">
                        {/* Hero card */}
                        <div
                            className="relative rounded-2xl overflow-hidden p-6 flex flex-col gap-3"
                            style={{ background: "linear-gradient(135deg, var(--primary-50) 0%, #f0f7ff 60%, #e8f4fd 100%)" }}
                        >
                            {/* Decorative ring */}
                            <div
                                className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-[0.07]"
                                style={{ background: "var(--primary-400)" }}
                            />
                            <span
                                className="inline-flex items-center gap-1.5 w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold bg-white text-[var(--primary-600)]"
                                style={{ fontFamily: "var(--font-inter)", letterSpacing: "0.04em" }}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-400)] inline-block" />
                                FREE FOR EVERYONE
                            </span>
                            <p className="text-[26px] font-bold text-[var(--base-800)] leading-tight" style={{ fontFamily: "var(--font-inter)" }}>
                                No credit card.<br />No limits.
                            </p>
                            <p className="text-[13px] text-[var(--base-500)] leading-relaxed" style={{ fontFamily: "var(--font-inter)" }}>
                                Lerno is free for every CBSE student — no plans, no tiers, no catch.
                            </p>
                        </div>

                        {/* Feature list */}
                        <div className="flex flex-col gap-0 divide-y divide-slate-100">
                            {[
                                ["AI tutor for all NCERT subjects", "Science, Mathematics, Social Science"],
                                ["Guided learn mode", "Chapter by chapter, topic by topic"],
                                ["Free-form Ask mode", "Ask anything, get instant answers"],
                                ["Personalised to you", "Adapts based on your progress and style"],
                                ["Curated study feed", "Articles and summaries from your syllabus"],
                            ].map(([title, sub]) => (
                                <div key={title} className="flex items-center gap-3 py-3">
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--primary-50)" }}>
                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                            <path d="M2 5l2 2 4-4" stroke="var(--primary-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-medium text-slate-800" style={{ fontFamily: "var(--font-inter)" }}>{title}</p>
                                        <p className="text-[12px] text-[var(--base-400)]" style={{ fontFamily: "var(--font-inter)" }}>{sub}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };


    if (typeof document === "undefined") return null;

    // ── Help modal — simple, no sidebar ──────────────────────────────────────
    if (mode === "help") {
        return createPortal(
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="help-overlay"
                        className="fixed inset-0 z-[10050] flex items-center justify-center p-4 sm:p-6"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        <button
                            type="button"
                            className="absolute inset-0 bg-black/25 backdrop-blur-[1px] cursor-default"
                            aria-label="Close"
                            onClick={onClose}
                        />
                        <motion.div
                            role="dialog"
                            aria-modal="true"
                            initial={{ opacity: 0, scale: 0.98, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98, y: 8 }}
                            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                            className="relative w-full max-w-[400px] rounded-2xl border shadow-[0_24px_64px_rgba(15,23,42,0.16)] overflow-hidden"
                            style={{ fontFamily: "var(--font-inter)", borderColor: "var(--base-300)", backgroundColor: "var(--panel-bg)" }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Close button */}
                            <button
                                type="button"
                                onClick={onClose}
                                className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--base-400)] hover:bg-slate-100 hover:text-[var(--base-700)] transition-colors cursor-pointer z-10"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4" strokeWidth={2} />
                            </button>

                            {/* Content */}
                            <div className="px-8 pt-10 pb-8 flex flex-col gap-6">
                                {/* Wordmark */}
                                <div>
                                    <p className="text-[22px] font-bold text-[var(--base-800)] tracking-tight" style={{ fontFamily: "var(--font-inter)" }}>
                                        Lerno
                                    </p>
                                </div>

                                {/* Mission */}
                                <div className="flex flex-col gap-2">
                                    <p className="text-[14px] text-[var(--base-700)] leading-relaxed" style={{ fontFamily: "var(--font-inter)" }}>
                                        Every student deserves a great teacher. Lerno is an AI tutor built around the NCERT curriculum — clear explanations, guided learning, and instant answers, for free.
                                    </p>
                                    <p className="text-[14px] text-[var(--base-500)] leading-relaxed" style={{ fontFamily: "var(--font-inter)" }}>
                                        Pick a subject, open a chapter, and start learning. It&apos;s that simple.
                                    </p>
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-slate-100" />

                                {/* Contact */}
                                <div className="flex flex-col gap-1">
                                    <p className="text-[13px] font-medium text-[var(--base-700)]" style={{ fontFamily: "var(--font-inter)" }}>
                                        Need help?
                                    </p>
                                    <a
                                        href="mailto:help@lerno.in"
                                        className="text-[13px] text-[var(--primary-500)] hover:underline w-fit"
                                        style={{ fontFamily: "var(--font-inter)" }}
                                    >
                                        help@lerno.in
                                    </a>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>,
            document.body,
        );
    }

    // ── Settings modal ────────────────────────────────────────────────────────
    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    key="account-settings-overlay"
                    className="fixed inset-0 z-[10050] flex items-center justify-center p-4 min-[400px]:p-5 sm:p-6 lg:p-8 overflow-y-auto overscroll-contain box-border"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                >
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/25 backdrop-blur-[1px] cursor-default"
                        aria-label="Close settings"
                        onClick={onClose}
                    />
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="account-settings-title"
                        initial={{ opacity: 0, scale: 0.98, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 8 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        className="relative flex flex-col w-full max-w-[min(720px,calc(100vw-2rem))] h-[min(640px,calc(100dvh-3rem))] sm:h-[min(640px,calc(100dvh-3.5rem))] min-h-0 shrink-0 my-auto rounded-2xl border shadow-[0_24px_64px_rgba(15,23,42,0.16)] overflow-hidden"
                        style={{ borderColor: "var(--base-300)", backgroundColor: "var(--panel-bg)", fontFamily: "var(--font-inter)" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Top bar — desktop: close + sidebar column; mobile: hamburger + title + close */}
                        <div className="flex h-[56px] sm:h-[60px] shrink-0 border-b items-stretch relative z-[60]" style={{ borderColor: "var(--base-200)", backgroundColor: "var(--panel-bg)" }}>
                            <div className="hidden lg:flex w-[180px] shrink-0 border-r items-center px-3" style={{ borderColor: "var(--base-200)", backgroundColor: "var(--base-100)" }}>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="p-1.5 rounded-lg text-[var(--base-400)] hover:bg-[var(--base-200)]/60 hover:text-[var(--base-700)] transition-colors cursor-pointer"
                                    aria-label="Close"
                                >
                                    <X className="w-4 h-4" strokeWidth={2} />
                                </button>
                            </div>
                            <div className="flex lg:hidden items-center justify-center pl-2 pr-1 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setMobileSectionNavOpen(true)}
                                    className="p-2 rounded-lg text-[var(--base-600)] hover:bg-slate-100 transition-colors cursor-pointer"
                                    aria-label="Open settings sections"
                                    aria-expanded={mobileSectionNavOpen}
                                    aria-controls="account-settings-section-nav"
                                >
                                    <Menu className="w-5 h-5" strokeWidth={2} />
                                </button>
                            </div>
                            <div className="flex flex-1 min-w-0 items-center px-2 sm:px-3 lg:px-8">
                                <span
                                    id="account-settings-title"
                                    className="text-[17px] lg:text-[18px] font-semibold text-[var(--base-800)] truncate"
                                    style={{ fontFamily: "var(--font-inter)" }}
                                >
                                    {currentSectionLabel}
                                </span>
                            </div>
                            <div className="flex lg:hidden items-center pr-2 pl-1 shrink-0">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="p-1.5 rounded-lg text-[var(--base-400)] hover:bg-[var(--base-200)]/60 hover:text-[var(--base-700)] transition-colors cursor-pointer"
                                    aria-label="Close"
                                >
                                    <X className="w-4 h-4" strokeWidth={2} />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex flex-1 min-h-0 relative">
                            {/* Mobile: slide-over section menu */}
                            <AnimatePresence>
                                {mobileSectionNavOpen && (
                                    <>
                                        <motion.button
                                            key="settings-nav-backdrop"
                                            type="button"
                                            aria-label="Close section menu"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.15 }}
                                            className="lg:hidden absolute inset-0 z-40 bg-slate-900/30 border-0 p-0 cursor-default"
                                            onClick={() => setMobileSectionNavOpen(false)}
                                        />
                                        <motion.nav
                                            key="settings-nav-drawer"
                                            id="account-settings-section-nav"
                                            initial={{ x: "-100%" }}
                                            animate={{ x: 0 }}
                                            exit={{ x: "-100%" }}
                                            transition={{ type: "spring", stiffness: 380, damping: 38 }}
                                            className="lg:hidden absolute left-0 top-0 bottom-0 z-50 flex flex-col w-[min(288px,calc(100vw-48px))] border-r py-3 px-2 overflow-y-auto shadow-[4px_0_24px_rgba(15,23,42,0.12)]"
                                            style={{ borderColor: "var(--base-200)", backgroundColor: "var(--base-100)" }}
                                            aria-label="Settings sections"
                                        >
                                            {SETTINGS_NAV.map(({ id, label, icon }) => (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSettingsTab(id);
                                                        setMobileSectionNavOpen(false);
                                                    }}
                                                    className={`flex items-center gap-2.5 w-full text-left rounded-xl px-3 py-2.5 text-[14px] transition-colors cursor-pointer ${
                                                        settingsTab === id
                                                            ? "bg-[var(--base-200)]/60 text-slate-800 font-medium"
                                                            : "text-[var(--base-600)] hover:bg-[var(--base-200)]/40 font-normal"
                                                    }`}
                                                >
                                                    <span className="w-[18px] h-[18px] shrink-0 flex items-center justify-center">{icon}</span>
                                                    {label}
                                                </button>
                                            ))}
                                        </motion.nav>
                                    </>
                                )}
                            </AnimatePresence>

                            {/* Desktop sidebar */}
                            <nav
                                className="hidden lg:flex flex-col w-[180px] shrink-0 border-r py-2 px-2 overflow-y-auto"
                                style={{ borderColor: "var(--base-200)", backgroundColor: "var(--base-100)" }}
                                aria-label="Settings sections"
                            >
                                {SETTINGS_NAV.map(({ id, label, icon }) => (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => setSettingsTab(id)}
                                        className={`flex items-center gap-2.5 w-full text-left rounded-xl px-3 py-2.5 text-[14px] transition-colors cursor-pointer ${
                                            settingsTab === id
                                                ? "font-medium"
                                                : "font-normal"
                                        }`}
                                        style={{
                                            backgroundColor: settingsTab === id ? "var(--base-300)" : undefined,
                                            color: settingsTab === id ? "var(--base-800)" : "var(--base-600)",
                                        }}
                                    >
                                        <span className="w-[18px] h-[18px] shrink-0 flex items-center justify-center">{icon}</span>
                                        {label}
                                    </button>
                                ))}
                            </nav>

                            {/* Content column */}
                            <div className="flex flex-col flex-1 min-w-0 min-h-0 relative z-10" style={{ backgroundColor: "var(--panel-bg)" }}>
                                <div className="flex-1 overflow-y-auto scrollbar-settings px-4 pt-4 pb-4 sm:px-6 sm:pt-5 lg:px-8 lg:pt-5 min-w-0" style={{ backgroundColor: "var(--panel-bg)" }}>
                                    {renderSettingsContent()}
                                </div>

                                {/* Save footer — only when dirty */}
                                <AnimatePresence>
                                    {showFooter && (
                                        <motion.div
                                            key="save-footer"
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 8 }}
                                            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                                            className="shrink-0 border-t px-4 py-3 sm:px-6 lg:px-8 flex flex-col-reverse min-[400px]:flex-row items-stretch min-[400px]:items-center justify-between gap-3 min-[400px]:gap-4 min-w-0"
                                            style={{ borderColor: "var(--base-200)", backgroundColor: "var(--panel-bg)" }}
                                        >
                                            <span className="text-[12px] text-[var(--base-400)]" style={{ fontFamily: "var(--font-inter)" }}>
                                                {(settingsTab === "account" ? accountSaveStatus : settingsTab === "notifications" ? notifSaveStatus : persSaveStatus) === "error"
                                                    ? "Could not save — please try again."
                                                    : "You have unsaved changes."}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (settingsTab === "account") void saveAccount();
                                                    else if (settingsTab === "notifications") void saveNotifications();
                                                    else void persSaveRef.current?.();
                                                }}
                                                disabled={(settingsTab === "account" ? accountSaveStatus : settingsTab === "notifications" ? notifSaveStatus : persSaveStatus) === "saving"}
                                                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white bg-[var(--primary-400)] hover:opacity-90 disabled:opacity-60 transition-opacity cursor-pointer"
                                                style={{ fontFamily: "var(--font-inter)", minWidth: 110 }}
                                            >
                                                {(() => {
                                                    const s = settingsTab === "account" ? accountSaveStatus : settingsTab === "notifications" ? notifSaveStatus : persSaveStatus;
                                                    return s === "saving" ? "Saving…" : s === "saved" ? "Saved" : "Save changes";
                                                })()}
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body,
    );
}
