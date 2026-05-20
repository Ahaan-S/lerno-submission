"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";

import AuthFlow from "@/components/auth/AuthFlow";
import Link from "next/link";
import { CheckCircle2, AlertCircle } from "lucide-react";

const GlassAlert = ({ msg }: { msg: { type: "error" | "success"; text: string } }) => {
    const isError = msg.type === "error";
    return (
        <div
            className={`
            absolute top-0 left-0 right-0 mx-auto mt-6 w-fit max-w-[90%] md:max-w-md p-3 rounded-full flex items-center gap-3 text-sm font-medium backdrop-blur-md border animate-in fade-in slide-in-from-top-2 duration-300 z-50 shadow-sm
            ${isError
                ? "bg-red-500/10 border-red-500/20 text-red-600"
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
            }
        `}
        >
            {isError ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
            <span>{msg.text}</span>
        </div>
    );
};

export default function AuthPageView() {
    const [message, setMessage] = React.useState<{ type: "error" | "success"; text: string } | null>(null);
    const [isEmailStep, setIsEmailStep] = React.useState(true);

    return (
        <main className="min-h-screen w-full flex items-center justify-center bg-white relative overflow-hidden">
            <div className="absolute inset-0 z-0 animate-settle-in">
                <Image
                    src="/auth-bg.webp"
                    alt="Background"
                    fill
                    priority
                    className="object-cover object-bottom"
                    unoptimized
                    quality={100}
                />
            </div>

            {message && <GlassAlert msg={message} />}

            <div className="relative z-10 w-full flex justify-center px-4 md:px-0">
                {isEmailStep && (
                    <div className="absolute -top-[85px] z-0 animate-panda-peep pointer-events-none">
                        <Image
                            src="/panda-auth.webp"
                            alt="Lerno Panda"
                            width={120}
                            height={120}
                            className="h-auto w-auto max-h-[120px] max-w-[120px] object-contain"
                            unoptimized
                        />
                    </div>
                )}

                <motion.div
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                        layout: { duration: 0.5, ease: "easeInOut" },
                        opacity: { duration: 0.5, ease: "easeOut" },
                        y: { duration: 0.5, ease: "easeOut" }
                    }}
                    className="relative z-10 flex flex-col items-center"
                    style={{
                        background: "radial-gradient(100% 100% at 50% 40%, rgba(186, 221, 241, 0.5) 0%, rgba(255, 255, 255, 1) 70%)",
                        backgroundColor: "#FFFFFF",
                        backdropFilter: "blur(12px)",
                        width: "440px",
                        maxWidth: "100%",
                        paddingTop: "42px",
                        paddingBottom: "32px",
                        paddingLeft: "32px",
                        paddingRight: "32px",
                        gap: "24px",
                        borderRadius: "24px",
                        boxShadow: "0 20px 40px -12px rgba(0,0,0,0.06), 0 0 2px rgba(0,0,0,0.04)",
                        border: "1px solid rgba(255, 255, 255, 0.8)",
                        overflow: "hidden"
                    }}
                >
                    <AuthFlow setMessage={setMessage} onEmailStepChange={setIsEmailStep} />

                    <div className="flex justify-between w-full" style={{ paddingTop: "36px" }}>
                        <Link
                            href="https://lerno.in/terms"
                            className="font-normal transition-colors hover:text-slate-900"
                            style={{
                                fontFamily: "var(--font-inter)",
                                fontSize: "13.5px",
                                color: "#79716B"
                            }}
                        >
                            Terms of Service
                        </Link>
                        <Link
                            href="https://lerno.in/privacy"
                            className="font-normal transition-colors hover:text-slate-900"
                            style={{
                                fontFamily: "var(--font-inter)",
                                fontSize: "13.5px",
                                color: "#79716B"
                            }}
                        >
                            Privacy Policy
                        </Link>
                    </div>
                </motion.div>
            </div>
        </main>
    );
}
