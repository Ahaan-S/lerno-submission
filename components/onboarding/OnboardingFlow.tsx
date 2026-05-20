"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Step1Identity from "@/components/onboarding/Step1Identity";
import Step2Subjects from "@/components/onboarding/Step2Subjects";
import Step5LearningStyle from "@/components/onboarding/Step5LearningStyle";
import { ProfileData } from "@/components/onboarding/types";
import { track, setUserProperties } from "@/lib/analytics";
import { startTopLoader } from "@/components/ui/TopLoader";

export default function OnboardingFlow() {
    const supabase = createClient();
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        router.prefetch("/learn");
    }, [router]);

    const STEP_NAMES = ["identity", "subjects", "learning_style"];

    useEffect(() => {
        track("onboarding_step_viewed", { step_number: step, step_name: STEP_NAMES[step - 1] ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]);

    const [formData, setFormData] = useState<ProfileData>({
        name: "",
        grade: "",
        weakSubjects: [],
        selectedSubjects: [],
        topicStrengths: {},
        topicWeaknesses: {},
        learningStyle: [],
        additionalInfo: ""
    });

    const updateData = (key: keyof ProfileData, value: unknown) => {
        setFormData((prev) => {
            const updated = { ...prev, [key]: value };
            // Reset subject selections when grade changes to avoid stale cross-grade picks
            if (key === "grade" && value !== prev.grade) {
                updated.selectedSubjects = [];
                updated.topicStrengths = {};
                updated.topicWeaknesses = {};
            }
            return updated;
        });
    };

    const handleFinalSubmit = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                throw new Error("No user found");
            }

            const names = formData.name.trim().split(" ");
            const firstName = names[0] || "";
            const lastName = names.slice(1).join(" ") || "";

            const { error: profileError } = await supabase
                .from("profiles")
                .upsert({
                    id: user.id,
                    email: user.email,
                    full_name: formData.name,
                    first_name: firstName,
                    last_name: lastName,
                    grade: formData.grade,
                    selected_subjects: formData.selectedSubjects,
                    topic_strengths: formData.topicStrengths,
                    topic_weaknesses: formData.topicWeaknesses,
                    learning_style: formData.learningStyle,
                    additional_info: formData.additionalInfo,
                    is_waitlisted: false,
                    onboarding_completed: true,
                    updated_at: new Date().toISOString()
                });

            if (profileError) throw profileError;

            const { error: authError } = await supabase.auth.updateUser({
                data: {
                    onboarding_completed: true,
                    grade: formData.grade,
                    name: formData.name
                }
            });

            if (authError) throw authError;

            await supabase.auth.refreshSession();
            track("onboarding_completed", {
                grade: formData.grade,
                subjects_count: formData.selectedSubjects.length,
            });
            setUserProperties({
                grade: formData.grade,
                selected_subjects: formData.selectedSubjects.join(","),
                is_onboarded: true,
            });
            startTopLoader();
            router.replace("/learn");
        } catch (error) {
            console.error("Onboarding error:", error);
        } finally {
            setLoading(false);
        }
    };

    const advanceStep = (from: number, to: number) => {
        track("onboarding_step_completed", { step_number: from, step_name: STEP_NAMES[from - 1] ?? "" });
        setStep(to);
    };

    const steps = [
        <Step1Identity key="step1" data={formData} updateData={updateData} onNext={() => advanceStep(1, 2)} />,
        <Step2Subjects key="step2" data={formData} updateData={updateData} onSubmit={() => advanceStep(2, 3)} onBack={() => setStep(1)} loading={loading} />,
        <Step5LearningStyle key="step5" data={formData} updateData={updateData} onSubmit={handleFinalSubmit} onBack={() => setStep(2)} loading={loading} />
    ];

    return (
        <main
            className="min-h-dvh w-full flex flex-col overflow-hidden md:overflow-visible md:items-center md:justify-center relative font-inter px-3 sm:px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] md:p-8"
            style={{
                backgroundColor: "var(--base-100)",
                backgroundImage: `
                    linear-gradient(var(--base-200) 4px, transparent 4px),
                    linear-gradient(90deg, var(--base-200) 4px, transparent 4px)
                `,
                backgroundSize: "45px 45px"
            }}
        >
            <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-1 min-h-0 flex-col md:flex-none md:justify-center md:min-h-0">
                <motion.div
                    className={`onboarding-step-card mx-auto flex flex-col flex-1 min-h-0 md:flex-none md:h-auto relative w-full overflow-hidden md:overflow-visible transition-all duration-300 rounded-2xl sm:rounded-3xl md:rounded-[45px] px-4 pt-6 pb-4 sm:px-5 sm:pt-7 sm:pb-5 md:p-9 h-[calc(100dvh-2.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-h-[calc(100dvh-2.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] md:max-h-none md:h-auto ${step === 3 ? "md:max-w-[810px]" : "md:max-w-[742px]"}`}
                    style={{
                        backgroundColor: "rgba(255, 255, 255, 1)",
                        boxShadow: "0px 22.5px 45px rgba(0, 0, 0, 0.08), 0px 2.25px 4.5px rgba(0, 0, 0, 0.04)",
                        backdropFilter: "blur(33.75px)",
                    }}
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -12 }}
                            transition={{ duration: 0.25 }}
                            className="w-full flex flex-col flex-1 min-h-0 md:flex-none"
                        >
                            <div className="w-full flex flex-col flex-1 min-h-0 md:flex-none">
                                {steps[step - 1]}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </motion.div>
            </div>
        </main>
    );
}
