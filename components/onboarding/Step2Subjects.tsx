"use client";

import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ProfileData } from "./types";
import { motion } from "framer-motion";

interface Step2SubjectsProps {
    data: ProfileData;
    updateData: (key: keyof ProfileData, value: unknown) => void;
    onSubmit: () => void;
    onBack: () => void;
    loading: boolean;
}

/** Class 10 onboarding: only subjects currently supported in-app (expand later). */
const SUBJECTS_GRADE_10 = [
    { id: "math", label: "Mathematics", icon: "/subjects/math.webp" },
    { id: "social", label: "Social Science", icon: "/subjects/sst.webp" },
    { id: "science", label: "Science", icon: "/subjects/science.webp" },
];

/** Class 11 onboarding: core commerce + PCM only for now (expand later). */
const SUBJECTS_GRADE_11 = [
    { id: "physics", label: "Physics", icon: "/subjects/science.webp" },
    { id: "chemistry", label: "Chemistry", icon: "/subjects/chemistry.webp" },
    { id: "math", label: "Mathematics", icon: "/subjects/math.webp" },
    { id: "economics", label: "Economics", icon: "/subjects/economics.webp" },
    { id: "business_studies", label: "Business Studies", icon: "/subjects/bst.webp" },
    { id: "accountancy", label: "Accountancy", icon: "/subjects/sst.webp" },
];

export default function Step2Subjects({ data, updateData, onSubmit, onBack, loading }: Step2SubjectsProps) {
    const selectedSubjects = data.selectedSubjects;
    const SUBJECTS = data.grade === "Class 11" ? SUBJECTS_GRADE_11 : SUBJECTS_GRADE_10;

    const toggleSubject = (subjectId: string) => {
        if (selectedSubjects.includes(subjectId)) {
            updateData("selectedSubjects", selectedSubjects.filter((id) => id !== subjectId));
        } else {
            updateData("selectedSubjects", [...selectedSubjects, subjectId]);
        }
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 md:flex-none w-full">
            <div className="flex-1 min-h-0 overflow-y-auto md:flex-none md:overflow-visible overscroll-y-contain scrollbar-none flex flex-col gap-6 sm:gap-7 md:gap-[22.5px] pt-1 sm:pt-2 pb-4 md:pb-6 pr-0.5">
                <div className="flex justify-center w-full gap-2 sm:gap-2.5 pt-1">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="rounded-full transition-colors duration-300 w-1.5 h-1.5 sm:w-2 sm:h-2"
                            style={{
                                backgroundColor: i <= 2 ? "var(--base-400)" : "var(--base-200)",
                            }}
                        />
                    ))}
                </div>

                <div className="flex flex-col text-center items-center gap-2 sm:gap-2.5 px-1">
                    <h2 className="font-inter font-medium text-center text-lg sm:text-xl md:text-[27px] leading-snug md:leading-[135%] text-[var(--base-700)]">
                        What do you want to master?
                    </h2>
                    <p className="font-inter font-normal text-sm sm:text-base md:text-lg leading-snug text-[var(--base-400)] px-1">
                        Choose all the subjects you study.
                    </p>
                </div>

                <motion.div
                    className="grid grid-cols-2 gap-3 sm:gap-3.5 md:gap-[22.5px] w-full md:flex md:flex-wrap md:justify-center"
                    initial="stateHidden"
                    animate="stateVisible"
                    variants={{
                        stateHidden: { opacity: 0 },
                        stateVisible: {
                            opacity: 1,
                            transition: { staggerChildren: 0.06 },
                        },
                    }}
                >
                    {SUBJECTS.map((subject) => {
                        const isSelected = selectedSubjects.includes(subject.id);
                        return (
                            <motion.button
                                key={subject.id}
                                type="button"
                                onClick={() => toggleSubject(subject.id)}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                variants={{
                                    stateHidden: { opacity: 0 },
                                    stateVisible: { opacity: 1, transition: { duration: 0.35, ease: "easeOut" } },
                                }}
                                className="flex items-center justify-start w-full md:w-auto min-w-0 bg-white transition-all duration-200 cursor-pointer rounded-xl sm:rounded-2xl md:rounded-[22.5px] gap-2 sm:gap-2.5 md:gap-[13.5px] px-2.5 py-2 sm:px-3 sm:py-2.5 md:pl-[13.5px] md:pr-[22.5px] md:py-[13.5px] border shadow-sm md:shadow-md"
                                style={{
                                    borderColor: isSelected ? "var(--primary-400)" : "transparent",
                                    borderWidth: isSelected ? "1.2px" : "1px",
                                    boxShadow: isSelected ? "none" : undefined,
                                }}
                            >
                                <div className="relative w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 flex-shrink-0">
                                    <div className="w-full h-full rounded-full flex items-center justify-center overflow-hidden">
                                        <Image
                                            src={subject.icon}
                                            alt={subject.label}
                                            width={40}
                                            height={40}
                                            className="object-cover w-full h-full"
                                        />
                                    </div>
                                </div>

                                <span className="font-inter font-normal text-left text-xs sm:text-sm md:text-[15.75px] leading-snug text-[var(--base-500)] min-w-0 break-words">
                                    {subject.label}
                                </span>
                            </motion.button>
                        );
                    })}
                </motion.div>
            </div>

            <div className="flex-shrink-0 flex w-full items-stretch sm:items-center justify-center gap-3 sm:gap-3 md:gap-[22.5px] pt-4 mt-2 border-t border-slate-100/90 md:border-0 md:pt-4 md:mt-0 px-0 sm:px-2 md:px-[45px] pb-[max(0.35rem,env(safe-area-inset-bottom))]">
                <Button
                    onClick={onBack}
                    variant="outline"
                    className="flex-1 h-11 sm:h-12 md:h-auto md:py-3.5 rounded-xl md:rounded-[18px] text-sm sm:text-base md:text-lg font-inter font-normal leading-snug tracking-tight text-[var(--base-400)] border border-[var(--base-400)] bg-transparent hover:bg-transparent"
                >
                    Back
                </Button>

                <Button
                    onClick={onSubmit}
                    disabled={loading || selectedSubjects.length === 0}
                    className="flex-1 h-11 sm:h-12 md:h-auto md:py-3.5 rounded-xl md:rounded-[18px] text-sm sm:text-base md:text-lg font-inter font-normal leading-snug tracking-tight text-[var(--base-200)] shadow-lg shadow-blue-900/10"
                    style={{
                        backgroundColor: selectedSubjects.length === 0 ? "var(--base-400)" : "var(--base-600)",
                        cursor: selectedSubjects.length === 0 ? "not-allowed" : "pointer",
                    }}
                >
                    {loading ? "Setting up..." : "Continue"}
                </Button>
            </div>
        </div>
    );
}
