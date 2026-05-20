"use client";

import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ProfileData } from "./types";
import { motion, Variants } from "framer-motion";

interface Step5LearningStyleProps {
    data: ProfileData;
    updateData: (key: keyof ProfileData, value: unknown) => void;
    onSubmit: () => void;
    onBack: () => void;
    loading: boolean;
}

const LEARNING_STYLES = [
    { id: "step-by-step", label: "Step-by-step\nexplanations", icon: "/learning/step.webp" },
    { id: "examples", label: "Examples\nand diagrams", icon: "/learning/examples.webp" },
    { id: "memory", label: "Memory &\nrevision trick", icon: "/learning/brain.webp", blendColor: "#15A0FC" },
    { id: "breakdown", label: "Breaking down\ncomplex topics", icon: "/learning/blocks.webp", blendColor: "#155DFC" },
    { id: "short", label: "Short and quick\nexplanations", icon: "/learning/bolt.webp", blendColor: "#001B39" },
];

const staggerContainer: Variants = {
    stateHidden: { opacity: 0 },
    stateVisible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.05,
        },
    },
};

const staggerItem: Variants = {
    stateHidden: { opacity: 0 },
    stateVisible: { opacity: 1, transition: { duration: 0.45, ease: "easeOut" } },
};

export default function Step5LearningStyle({ data, updateData, onSubmit, onBack, loading }: Step5LearningStyleProps) {
    const toggleStyle = (id: string) => {
        const current = data.learningStyle || [];
        if (current.includes(id)) {
            updateData("learningStyle", current.filter((item) => item !== id));
        } else {
            updateData("learningStyle", [...current, id]);
        }
    };

    const hasSelection = (data.learningStyle || []).length > 0;

    return (
        <div className="flex flex-col flex-1 min-h-0 md:flex-none w-full">
            <div className="flex-1 min-h-0 overflow-y-auto md:flex-none md:overflow-visible overscroll-y-contain scrollbar-none flex flex-col gap-6 sm:gap-7 md:gap-9 pt-1 sm:pt-2 pb-4 md:pb-6 pr-0.5">
                <div className="flex justify-center w-full gap-2 sm:gap-2.5 pt-1">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="rounded-full transition-colors duration-300 w-1.5 h-1.5 sm:w-2 sm:h-2"
                            style={{
                                backgroundColor: "var(--base-400)",
                            }}
                        />
                    ))}
                </div>

                <div className="flex flex-col text-center items-center gap-2 sm:gap-2.5 px-1">
                    <h2 className="font-inter font-medium text-center text-lg sm:text-xl md:text-[27px] leading-snug text-[var(--base-700)]">
                        How do you learn best?
                    </h2>
                    <p className="font-inter font-normal text-sm sm:text-base md:text-lg leading-snug text-[var(--base-400)]">
                        We&apos;ll adapt our teaching style for you.
                    </p>
                </div>

                <motion.div
                    className="grid grid-cols-2 gap-3 sm:gap-3.5 md:flex md:flex-wrap md:justify-center md:gap-[18px] w-full"
                    variants={staggerContainer}
                    initial="stateHidden"
                    animate="stateVisible"
                >
                    {LEARNING_STYLES.map((style) => {
                        const isSelected = (data.learningStyle || []).includes(style.id);
                        return (
                            <motion.button
                                key={style.id}
                                type="button"
                                variants={staggerItem}
                                onClick={() => toggleStyle(style.id)}
                                whileHover={{ scale: 1.02, backgroundColor: "var(--base-50)" }}
                                whileTap={{ scale: 0.98 }}
                                className="flex items-center text-left transition-all duration-200 cursor-pointer w-full min-h-0 md:w-auto md:min-w-[200px] rounded-xl sm:rounded-2xl md:rounded-[25px] gap-2 sm:gap-2.5 md:gap-[13.5px] px-2.5 py-2 sm:px-3 sm:py-2.5 md:p-[13.5px] md:pr-[22.5px] h-[72px] sm:h-20 md:h-[90px] bg-white border shadow-sm md:shadow-md"
                                style={{
                                    borderColor: isSelected ? "var(--primary-400)" : "transparent",
                                    borderWidth: isSelected ? "1.2px" : "1px",
                                    boxShadow: isSelected ? "none" : undefined,
                                }}
                            >
                                <div className="relative w-9 h-9 sm:w-10 sm:h-10 md:w-[63px] md:h-[63px] flex-shrink-0">
                                    <Image
                                        src={style.icon}
                                        alt={style.label.replace(/\n/g, " ")}
                                        fill
                                        className="object-contain"
                                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                                    />
                                    {style.blendColor && (
                                        <div
                                            className="absolute inset-0 w-full h-full pointer-events-none"
                                            style={{
                                                backgroundColor: style.blendColor,
                                                mixBlendMode: "hue",
                                                maskImage: `url(${style.icon})`,
                                                WebkitMaskImage: `url(${style.icon})`,
                                                maskSize: "contain",
                                                maskRepeat: "no-repeat",
                                                maskPosition: "center",
                                            }}
                                        />
                                    )}
                                </div>

                                <span className="font-inter font-normal whitespace-pre-line text-xs sm:text-sm md:text-[18px] leading-snug tracking-tight text-[var(--base-600)] min-w-0">
                                    {style.label}
                                </span>
                            </motion.button>
                        );
                    })}
                </motion.div>

                <div className="flex flex-col w-full gap-3 sm:gap-3.5 md:gap-[13.5px]">
                    <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
                        <span className="font-inter font-normal text-sm sm:text-[15px] md:text-[15.75px] leading-snug tracking-tight text-[var(--base-600)]">
                            Anything you want us to know?
                        </span>
                        <span className="font-inter font-normal text-sm sm:text-[15px] md:text-[15.75px] text-[#90A1B9]">
                            (Optional)
                        </span>
                    </div>

                    <textarea
                        placeholder="E.g., I prefer visual learning, I have exams coming up in March..."
                        value={data.additionalInfo || ""}
                        onChange={(e) => updateData("additionalInfo", e.target.value)}
                        className="scrollbar-none w-full resize-none outline-none font-inter font-normal transition-all duration-200 focus:border-primary-300 focus:bg-white text-sm sm:text-[15px] md:text-[15.75px] leading-snug h-20 sm:h-24 md:h-[120px] rounded-xl md:rounded-[18px] px-3 py-2.5 sm:px-4 sm:py-3 md:p-[15.75px] md:px-[18px] text-[var(--base-700)] bg-slate-50/80 border border-slate-200/60"
                    />
                    <style jsx>{`
                        textarea::placeholder {
                            color: #90a1b9;
                        }
                    `}</style>
                </div>
            </div>

            <div className="flex-shrink-0 w-full pt-4 mt-2 border-t border-slate-100/90 md:border-0 md:pt-4 md:mt-0 px-0 sm:px-2 md:px-[45px] pb-[max(0.35rem,env(safe-area-inset-bottom))]">
                {/* Mobile: Finish centered above full-width Back; md: side-by-side */}
                <div className="flex flex-col gap-3 md:flex-row md:gap-[22.5px] md:items-stretch">
                    <Button
                        onClick={onSubmit}
                        disabled={loading || !hasSelection}
                        className="order-1 h-12 sm:h-[3.25rem] md:order-2 md:flex-1 md:max-w-none rounded-xl md:rounded-[18px] text-sm sm:text-base md:text-lg font-inter font-normal text-[var(--base-200)] shadow-lg shadow-blue-900/10 w-full max-w-[min(20rem,calc(100%-0.5rem))] mx-auto md:mx-0 md:h-auto md:py-3.5"
                        style={{
                            backgroundColor: !hasSelection ? "var(--base-400)" : "var(--base-600)",
                            cursor: !hasSelection ? "not-allowed" : "pointer",
                        }}
                    >
                        {loading ? "Setting up..." : "Finish"}
                    </Button>
                    <Button
                        onClick={onBack}
                        variant="outline"
                        className="order-2 h-11 sm:h-12 md:order-1 md:flex-1 md:h-auto md:py-3.5 rounded-xl md:rounded-[18px] text-sm sm:text-base md:text-lg font-inter font-normal text-[var(--base-400)] border border-[var(--base-400)] bg-transparent hover:bg-transparent w-full"
                    >
                        Back
                    </Button>
                </div>
            </div>
        </div>
    );
}
