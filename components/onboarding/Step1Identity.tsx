"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProfileData } from "./types";

interface Step1IdentityProps {
    data: ProfileData;
    updateData: (key: keyof ProfileData, value: unknown) => void;
    onNext: () => void;
}

export default function Step1Identity({ data, updateData, onNext }: Step1IdentityProps) {
    const [error, setError] = useState<string | null>(null);

    const handleContinue = () => {
        const name = data.name.trim();

        if (!name) {
            setError("Please enter your name.");
            return;
        }
        if (name.length < 2) {
            setError("Name must be at least 2 characters long.");
            return;
        }
        if (!/^[a-zA-Z\s'-]+$/.test(name)) {
            setError("Name contains invalid characters. Please use letters only.");
            return;
        }

        setError(null);
        onNext();
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
                                backgroundColor: i === 1 ? "var(--base-400)" : "var(--base-200)",
                            }}
                        />
                    ))}
                </div>

                <div className="flex flex-col text-center gap-2 sm:gap-2.5 px-1">
                    <h2 className="font-inter font-semibold text-slate-700 text-lg leading-snug sm:text-xl md:text-[26px] md:leading-[135%] text-[var(--base-700)]">
                        Let&apos;s get to know your learning style
                    </h2>
                    <p className="font-inter font-normal text-sm sm:text-base md:text-lg leading-snug text-[var(--base-400)]">
                        This helps us personalize your experience.
                    </p>
                </div>

                <div className="flex flex-col w-full gap-6 sm:gap-7 md:gap-[27px]">
                    <div className="flex flex-col w-full gap-2.5 sm:gap-3 md:gap-[13.5px]">
                        <Label
                            htmlFor="name"
                            className="font-inter font-medium text-sm sm:text-[15px] md:text-[15.75px] leading-[135%] tracking-tight text-[var(--base-500)]"
                        >
                            What&apos;s your name?
                        </Label>
                        <div className="w-full group relative flex flex-col gap-1.5">
                            <Input
                                id="name"
                                placeholder="Ahaan Sirohia"
                                value={data.name || ""}
                                onChange={(e) => {
                                    updateData("name", e.target.value);
                                    if (error) setError(null);
                                }}
                                className="w-full transition-all border-none outline-none font-inter font-normal placeholder:text-[var(--base-300)] h-11 sm:h-12 md:h-[60px] px-4 md:px-[18px] rounded-2xl md:rounded-[22.5px] bg-[var(--base-100)] text-base md:text-lg leading-snug md:leading-[135%] tracking-tight text-[var(--base-700)] shadow-none"
                            />
                            <style jsx>{`
                                #name:focus {
                                    border: 1px solid #cbd5e1 !important;
                                    box-shadow: 0px 0px 0px 4px #f1f5f9, 0px 1px 2px 0px rgba(0, 0, 0, 0.05) !important;
                                    background-color: white !important;
                                }
                            `}</style>

                            {error && (
                                <p className="text-red-500 text-xs sm:text-sm px-1 animate-in fade-in slide-in-from-top-1">
                                    {error}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col w-full gap-3 sm:gap-3.5 md:gap-[13.5px]">
                        <Label className="font-inter font-medium text-sm sm:text-[15px] md:text-[15.75px] leading-[135%] tracking-tight text-[var(--base-500)]">
                            Which class are you in?
                        </Label>

                        <motion.div
                            className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-[13.5px]"
                            initial="hidden"
                            animate="visible"
                            variants={{
                                hidden: { opacity: 0 },
                                visible: {
                                    opacity: 1,
                                    transition: {
                                        delayChildren: 0.15,
                                        staggerChildren: 0.08,
                                    },
                                },
                            }}
                        >
                            {["Class 10", "Class 11"].map((grade) => {
                                const isSelected = data.grade === grade;
                                const imageSrc = grade === "Class 10" ? "/panda-grade10.webp" : "/panda-grade9.webp";

                                return (
                                    <motion.button
                                        key={grade}
                                        type="button"
                                        onClick={() => updateData("grade", grade)}
                                        className="relative flex flex-col items-center justify-center transition-all duration-200 bg-white hover:bg-slate-50 cursor-pointer rounded-xl sm:rounded-2xl md:rounded-[22.5px] border-[1.2px] px-2 py-2.5 sm:p-3 md:px-[22.5px] md:py-[13.5px] gap-1.5 sm:gap-2 md:gap-[13.5px]"
                                        style={{
                                            borderColor: isSelected ? "var(--primary-400)" : "var(--primary-100)",
                                        }}
                                        variants={{
                                            hidden: { opacity: 0, y: 12 },
                                            visible: {
                                                opacity: 1,
                                                y: 0,
                                                transition: { type: "spring", stiffness: 120, damping: 16 },
                                            },
                                        }}
                                    >
                                        <div className="relative w-full flex justify-center h-20 sm:h-28 md:h-[135px]">
                                            <div className="relative h-full w-auto max-w-[100%]">
                                                <Image
                                                    src={imageSrc}
                                                    alt={grade}
                                                    width={135}
                                                    height={135}
                                                    className="object-contain h-full w-auto max-h-full relative z-10"
                                                />
                                                <div
                                                    className="absolute inset-0 z-20 pointer-events-none rounded-lg overflow-hidden"
                                                    style={{
                                                        backgroundColor: "#155DFC",
                                                        mixBlendMode: "hue",
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <span
                                            className="font-inter font-normal text-sm sm:text-base md:text-lg leading-tight tracking-tight"
                                            style={{
                                                color: isSelected ? "#006edd" : "var(--base-400)",
                                            }}
                                        >
                                            {grade === "Class 10" ? "10th Standard" : "11th Standard"}
                                        </span>
                                    </motion.button>
                                );
                            })}
                        </motion.div>
                    </div>
                </div>
            </div>

            <div className="flex-shrink-0 pt-4 mt-2 border-t border-slate-100/90 md:border-0 md:pt-4 md:mt-0 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
                <Button
                    onClick={handleContinue}
                    disabled={!data.name || !data.grade}
                    className="w-full shadow-lg shadow-blue-900/10 transition-all duration-200 hover:opacity-90 active:opacity-75 h-11 sm:h-12 md:h-auto md:py-3.5 rounded-xl md:rounded-[22.5px] text-base md:text-lg font-inter font-normal leading-snug tracking-tight text-[var(--base-200)]"
                    style={{
                        backgroundColor: !data.name || !data.grade ? "var(--base-400)" : "var(--base-600)",
                        cursor: !data.name || !data.grade ? "not-allowed" : "pointer",
                    }}
                >
                    Continue
                </Button>
            </div>
        </div>
    );
}
