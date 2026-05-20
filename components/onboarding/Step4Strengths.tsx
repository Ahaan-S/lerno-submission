"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button"; // Standard button for Nav
import { ProfileData } from "./types";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, ChevronDown, ChevronUp } from "lucide-react";
import {
    CHAPTER_DATA_9,
    CHAPTER_DATA_10,
    CHAPTER_DATA_11,
    SUBJECT_LABELS,
} from "@/lib/chapters";

interface Step4StrengthsProps {
    data: ProfileData;
    updateData: (key: keyof ProfileData, value: unknown) => void;
    /** Atomic multi-field updates (e.g. sync strengths + weaknesses). */
    patchFormData: (partial: Partial<ProfileData>) => void;
    onSubmit: () => void;
    onBack: () => void;
    loading: boolean;
}

type SectionType = 'strengths' | 'weaknesses' | null;


const fadeContainer = {
    stateHidden: { opacity: 0 },
    stateVisible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.15,
            delayChildren: 0.1
        }
    }
};

const fadeItem = {
    stateHidden: { opacity: 0 },
    stateVisible: { opacity: 1, transition: { duration: 0.6 } }
};

export default function Step4Strengths({ data, updateData, patchFormData, onSubmit, onBack, loading }: Step4StrengthsProps) {
    const [expandedSection, setExpandedSection] = useState<SectionType>(null);
    const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({}); // Key: "type-subjectId" e.g. "strengths-math"

    // Select Data based on Grade
    const CHAPTER_DATA = data.grade === "Class 9" ? CHAPTER_DATA_9
        : data.grade === "Class 11" ? CHAPTER_DATA_11
        : CHAPTER_DATA_10;

    // Helper to toggle main section
    const toggleSection = (section: SectionType) => {
        if (expandedSection === section) {
            setExpandedSection(null);
        } else {
            setExpandedSection(section);
        }
    };

    // Helper to toggle subject accordion
    const toggleSubjectAccordion = (type: string, subjectId: string) => {
        const key = `${type}-${subjectId}`;
        setExpandedSubjects(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Selection Logic
    const getSelectedChapters = (type: 'strengths' | 'weaknesses', subjectId: string) => {
        const repo = type === 'strengths' ? data.topicStrengths : data.topicWeaknesses;
        return repo?.[subjectId] || []; // Optional chain in case repo is undefined initially
    };

    const strengthChaptersFor = (subjectId: string) => data.topicStrengths?.[subjectId] ?? [];

    const weaknessEligibleChapters = (subjectId: string) => {
        const sections = CHAPTER_DATA[subjectId] || [];
        const allChapters = sections.flatMap(s => s.items);
        const strong = new Set(strengthChaptersFor(subjectId));
        return allChapters.filter((ch) => !strong.has(ch));
    };

    const isAllSelected = (type: 'strengths' | 'weaknesses', subjectId: string) => {
        const sections = CHAPTER_DATA[subjectId] || [];
        const allChapters = sections.flatMap(s => s.items);
        if (type === "weaknesses") {
            const eligible = weaknessEligibleChapters(subjectId);
            const selected = getSelectedChapters(type, subjectId).filter((c) => eligible.includes(c));
            return eligible.length > 0 && selected.length === eligible.length;
        }
        const selected = getSelectedChapters(type, subjectId);
        return allChapters.length > 0 && selected.length === allChapters.length;
    };

    const toggleSubjectSelection = (type: 'strengths' | 'weaknesses', subjectId: string) => {
        const sections = CHAPTER_DATA[subjectId] || [];
        const allChapters = sections.flatMap(s => s.items);

        const currentSelected = getSelectedChapters(type, subjectId);
        const targetRepoKey = type === 'strengths' ? 'topicStrengths' : 'topicWeaknesses';
        const currentRepo = data[targetRepoKey] || {};

        let newSelected: string[];
        if (type === "weaknesses") {
            const eligible = weaknessEligibleChapters(subjectId);
            const selectedEligible = currentSelected.filter((c) => eligible.includes(c));
            if (eligible.length > 0 && selectedEligible.length === eligible.length) {
                newSelected = [];
            } else {
                newSelected = [...eligible];
            }
            updateData(targetRepoKey, { ...currentRepo, [subjectId]: newSelected });
            return;
        }

        // strengths
        if (currentSelected.length === allChapters.length) {
            newSelected = [];
        } else {
            newSelected = [...allChapters];
        }
        const newStrengthRepo = { ...currentRepo, [subjectId]: newSelected };
        const tw = { ...(data.topicWeaknesses || {}) };
        const w = tw[subjectId] || [];
        tw[subjectId] = w.filter((ch) => !newSelected.includes(ch));
        patchFormData({ topicStrengths: newStrengthRepo, topicWeaknesses: tw });
    };

    const toggleChapterSelection = (type: 'strengths' | 'weaknesses', subjectId: string, chapter: string) => {
        const currentSelected = getSelectedChapters(type, subjectId);
        const targetRepoKey = type === 'strengths' ? 'topicStrengths' : 'topicWeaknesses';
        const currentRepo = data[targetRepoKey] || {};

        if (type === "weaknesses") {
            const eligible = weaknessEligibleChapters(subjectId);
            if (!currentSelected.includes(chapter) && !eligible.includes(chapter)) return;
        }

        let newSelected: string[];
        if (currentSelected.includes(chapter)) {
            newSelected = currentSelected.filter(c => c !== chapter);
        } else {
            newSelected = [...currentSelected, chapter];
        }

        if (type === "strengths") {
            const newStrengthRepo = { ...currentRepo, [subjectId]: newSelected };
            const tw = { ...(data.topicWeaknesses || {}) };
            const w = tw[subjectId] || [];
            tw[subjectId] = w.filter((ch) => !newSelected.includes(ch));
            patchFormData({ topicStrengths: newStrengthRepo, topicWeaknesses: tw });
            return;
        }

        updateData(targetRepoKey, { ...currentRepo, [subjectId]: newSelected });
    };

    // Available subjects from Step 2
    const availableSubjects = data.selectedSubjects || [];

    const renderSubjectList = (type: 'strengths' | 'weaknesses') => {
        // Strengths: hide subjects where any weakness chapter is chosen (unchanged).
        // Weaknesses: always list selected subjects; chapters exclude strength picks only.
        const filteredSubjects = type === "strengths"
            ? availableSubjects.filter((subjectId) => getSelectedChapters("weaknesses", subjectId).length === 0)
            : availableSubjects.filter((subjectId) => {
                const eligible = weaknessEligibleChapters(subjectId);
                const weak = getSelectedChapters("weaknesses", subjectId);
                return eligible.length > 0 || weak.length > 0;
            });

        return (
            <motion.div
                className="flex flex-col w-full px-2 sm:px-3 md:px-4 gap-2 sm:gap-2.5 md:gap-3 mt-2 md:mt-3"
                variants={fadeContainer}
                initial="stateHidden"
                animate="stateVisible"
            >
                {filteredSubjects.map(subjectId => {
                    const label = SUBJECT_LABELS[subjectId] || subjectId;
                    const sections = CHAPTER_DATA[subjectId] || [];
                    const allChapters = sections.flatMap(s => s.items);
                    const eligibleWeak = weaknessEligibleChapters(subjectId);
                    const isExpanded = expandedSubjects[`${type}-${subjectId}`];
                    const rawSelected = getSelectedChapters(type, subjectId);
                    const selectedCount = type === "weaknesses"
                        ? rawSelected.filter((c) => eligibleWeak.includes(c)).length
                        : rawSelected.length;
                    const totalCount = type === "weaknesses" ? eligibleWeak.length : allChapters.length;
                    const isFullSelected = isAllSelected(type, subjectId);

                    return (
                        <motion.div
                            key={subjectId}
                            variants={fadeItem}
                            className="flex flex-col w-full bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl overflow-hidden"
                        >
                            {/* Subject Header */}
                            <div
                                className="flex items-center justify-between p-3 sm:p-3.5 md:p-4 cursor-pointer hover:bg-slate-100 transition-colors gap-2"
                                onClick={() => toggleSubjectAccordion(type, subjectId)}
                            >
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                    {/* Circular Indicator for Select All Subject */}
                                    <div
                                        className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 rounded-full border flex items-center justify-center cursor-pointer transition-colors duration-200"
                                        style={{
                                            backgroundColor: isFullSelected ? '#2E81FF' : 'white',
                                            borderColor: isFullSelected ? '#2E81FF' : 'var(--base-300)'
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleSubjectSelection(type, subjectId);
                                        }}
                                    >
                                        {/* No Icon, just color change */}
                                    </div>
                                    <span className="font-inter font-medium text-slate-700 text-sm sm:text-base truncate">{label}</span>
                                    <span className="text-[10px] sm:text-xs text-slate-400 font-inter shrink-0">({selectedCount}/{totalCount})</span>
                                </div>

                                {isExpanded ? <ChevronUp className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-slate-400 shrink-0" /> : <ChevronDown className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-slate-400 shrink-0" />}
                            </div>

                            {/* Chapters List */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="flex flex-col bg-white border-t border-slate-100 p-1.5 sm:p-2">
                                            {sections.map((section, idx) => {
                                                const filteredItems = section.items.filter(
                                                    (chapter) => type === "strengths" || eligibleWeak.includes(chapter)
                                                );
                                                if (filteredItems.length === 0) return null;
                                                return (
                                                <div
                                                    key={idx}
                                                    className="flex flex-col gap-1 mb-2 sm:mb-3 last:mb-0"
                                                >
                                                    {section.title && (
                                                        <h4 className="font-inter font-semibold text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider pl-7 sm:pl-9 md:pl-10 mb-1 mt-1.5">
                                                            {section.title}
                                                        </h4>
                                                    )}
                                                    {filteredItems.map((chapter) => {
                                                        const isSelected = getSelectedChapters(type, subjectId).includes(chapter);
                                                        return (
                                                            <div
                                                                key={chapter}
                                                                className="flex items-center gap-2 sm:gap-3 py-1.5 px-1 sm:p-2 rounded-lg hover:bg-slate-50 cursor-pointer pl-7 sm:pl-9 md:pl-10"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleChapterSelection(type, subjectId, chapter);
                                                                }}
                                                            >
                                                                <div
                                                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 rounded-full border flex items-center justify-center transition-colors duration-200"
                                                                    style={{
                                                                        backgroundColor: isSelected ? '#2E81FF' : 'white',
                                                                        borderColor: isSelected ? '#2E81FF' : 'var(--base-300)'
                                                                    }}
                                                                >
                                                                </div>
                                                                <span className="font-inter text-xs sm:text-sm text-slate-600 leading-snug">{chapter}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </motion.div>
        );
    };

    // Check if anything is selected
    const hasSelection = Object.values(data.topicStrengths || {}).some(list => list.length > 0) ||
        Object.values(data.topicWeaknesses || {}).some(list => list.length > 0);

    return (
        <div className="flex flex-col flex-1 min-h-0 w-full">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain scrollbar-none flex flex-col gap-6 sm:gap-7 md:gap-9 pt-1 sm:pt-2 pb-4 md:pb-0 pr-0.5">
                <div className="flex justify-center w-full gap-2 sm:gap-2.5 pt-1">
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="rounded-full transition-colors duration-300 w-1.5 h-1.5 sm:w-2 sm:h-2"
                            style={{
                                backgroundColor: i <= 3 ? "var(--base-400)" : "var(--base-200)",
                            }}
                        />
                    ))}
                </div>

                <div className="flex flex-col text-center items-center gap-2 sm:gap-2.5 px-1">
                    <h2 className="font-inter font-medium text-center text-lg sm:text-xl md:text-[27px] leading-snug text-[var(--base-700)]">
                        Let&apos;s identify your strengths
                    </h2>
                    <p className="font-inter font-normal text-sm sm:text-base md:text-lg leading-snug text-[var(--base-400)]">
                        Tap on chapters you&apos;re confident in.
                    </p>
                </div>

                <div className="flex flex-col w-full gap-4 sm:gap-5 md:gap-[18px]">
                    {/* Strengths Section */}
                    <div className="flex flex-col w-full">
                        <div
                            className="flex items-center justify-between gap-2 p-3 sm:p-3.5 md:p-4 bg-white border border-slate-200 rounded-xl md:rounded-2xl cursor-pointer hover:bg-slate-50 transition-all"
                            onClick={() => toggleSection('strengths')}
                        >
                            <div className="flex items-center gap-2.5 sm:gap-3 md:gap-4 min-w-0">
                                <div className="relative w-10 h-10 sm:w-11 sm:h-11 md:w-[47px] md:h-[47px] flex-shrink-0">
                                    <Image
                                        src="/strengths/dumbbell.webp"
                                        alt="Strengths"
                                        width={47}
                                        height={47}
                                        className="object-contain w-full h-full"
                                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                                    />
                                    <div className="absolute inset-0 w-full h-full pointer-events-none" style={{ mixBlendMode: "color" }} />
                                </div>
                                <div className="flex flex-col gap-0.5 min-w-0">
                                    <span className="font-inter font-normal text-base sm:text-lg md:text-[18px] leading-snug tracking-tight text-[var(--primary-700)]">
                                        Strengths
                                    </span>
                                    <span className="font-inter font-normal text-xs sm:text-sm text-slate-400 leading-snug">
                                        What topics do you feel confident about?
                                    </span>
                                </div>
                            </div>
                            {expandedSection === 'strengths' ? <Minus className="w-5 h-5 shrink-0 text-slate-400" /> : <Plus className="w-5 h-5 shrink-0 text-slate-400" />}
                        </div>

                        <AnimatePresence>
                            {expandedSection === 'strengths' && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="overflow-hidden"
                                >
                                    {renderSubjectList('strengths')}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Weaknesses Section */}
                    <div className="flex flex-col w-full">
                        <div
                            className="flex items-center justify-between gap-2 p-3 sm:p-3.5 md:p-4 bg-white border border-slate-200 rounded-xl md:rounded-2xl cursor-pointer hover:bg-slate-50 transition-all"
                            onClick={() => toggleSection('weaknesses')}
                        >
                            <div className="flex items-center gap-2.5 sm:gap-3 md:gap-4 min-w-0">
                                <div className="relative w-10 h-10 sm:w-11 sm:h-11 md:w-[47px] md:h-[47px] flex-shrink-0">
                                    <Image
                                        src="/strengths/growth.webp"
                                        alt="Weaknesses"
                                        width={47}
                                        height={47}
                                        className="object-contain w-full h-full"
                                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                                    />
                                    <div
                                        className="absolute inset-0 w-full h-full"
                                        style={{
                                            backgroundColor: '#008BFC',
                                            mixBlendMode: 'color',
                                            maskImage: `url(/strengths/growth.webp)`,
                                            WebkitMaskImage: `url(/strengths/growth.webp)`,
                                            maskSize: 'contain',
                                            maskRepeat: 'no-repeat',
                                            maskPosition: 'center'
                                        }}
                                    />
                                </div>
                                <div className="flex flex-col gap-0.5 min-w-0">
                                    <span className="font-inter font-normal text-base sm:text-lg md:text-[18px] leading-snug tracking-tight text-[var(--primary-700)]">
                                        Areas to Improve
                                    </span>
                                    <span className="font-inter font-normal text-xs sm:text-sm text-slate-400 leading-snug">
                                        What topics do you feel challenging?
                                    </span>
                                </div>
                            </div>
                            {expandedSection === 'weaknesses' ? <Minus className="w-5 h-5 shrink-0 text-slate-400" /> : <Plus className="w-5 h-5 shrink-0 text-slate-400" />}
                        </div>

                        <AnimatePresence>
                            {expandedSection === 'weaknesses' && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="overflow-hidden"
                                >
                                    {renderSubjectList('weaknesses')}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                </div>
            </div>

            <div className="flex-shrink-0 flex w-full items-stretch justify-center gap-3 sm:gap-3 md:gap-[22.5px] pt-4 mt-2 border-t border-slate-100/90 md:border-0 md:pt-4 md:mt-0 px-0 sm:px-2 md:px-[45px] pb-[max(0.35rem,env(safe-area-inset-bottom))]">
                <Button
                    onClick={onBack}
                    variant="outline"
                    className="flex-1 h-11 sm:h-12 md:h-auto md:py-3.5 rounded-xl md:rounded-[18px] text-sm sm:text-base md:text-lg font-inter font-normal text-[var(--base-400)] border border-[var(--base-400)] bg-transparent hover:bg-transparent"
                >
                    Back
                </Button>

                <Button
                    onClick={onSubmit}
                    disabled={loading}
                    className="flex-1 h-11 sm:h-12 md:h-auto md:py-3.5 rounded-xl md:rounded-[18px] text-sm sm:text-base md:text-lg font-inter font-normal text-[var(--base-200)] shadow-lg shadow-blue-900/10 bg-[var(--base-600)]"
                >
                    {loading ? "Setting up..." : (hasSelection ? "Continue" : "Skip")}
                </Button>
            </div>

        </div>
    );
}
