"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { checkUserExists } from "@/app/actions/auth";
import { ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import EmailStep from "./EmailStep";
import LoginStep from "./LoginStep";
import SignupStep from "./SignupStep";
import AuthHeader from "./AuthHeader";
import OtpInput from "./OtpInput";
import { track } from "@/lib/analytics";
import { startTopLoader } from "@/components/ui/TopLoader";

type AuthStep = 'EMAIL' | 'LOGIN_PASSWORD' | 'SIGNUP_PASSWORD' | 'VERIFICATION' | 'OAUTH_ONLY';

interface AuthFlowProps {
    setMessage: (msg: { type: 'error' | 'success', text: string } | null) => void;
    onEmailStepChange?: (isEmailStep: boolean) => void;
}

export default function AuthFlow({ setMessage, onEmailStepChange }: AuthFlowProps) {
    const [step, setStep] = useState<AuthStep>('EMAIL');
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [otp, setOtp] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccessScreen, setIsSuccessScreen] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        setMessage(null);
        setIsSuccessScreen(false);
        if (onEmailStepChange) {
            onEmailStepChange(step === "EMAIL");
        }
    }, [step, setMessage, onEmailStepChange]);

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        const result = await checkUserExists(email);

        setIsLoading(false);

        if ("error" in result) {
            setMessage({ type: 'error', text: "Something went wrong. Please try again." });
            track("auth_error", { step: "email", error_message: "check_user_failed" });
            return;
        }

        track("auth_email_submitted", { user_exists: result.exists });

        if (result.exists) {
            if (result.isOAuthOnly) {
                setStep("OAUTH_ONLY");
            } else {
                setStep("LOGIN_PASSWORD");
            }
        } else {
            setStep("SIGNUP_PASSWORD");
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        setIsLoading(false);

        if (error) {
            setMessage({ type: 'error', text: error.message });
            track("auth_error", { step: "login", error_message: error.message });
        } else {
            track("auth_login", { method: "password" });
            startTopLoader();
            window.location.href = '/learn';
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${location.origin}/auth/callback?next=/learn`
            }
        });

        setIsLoading(false);

        if (error) {
            if (error.message.includes("already registered") || error.message.includes("already exists")) {
                setStep('LOGIN_PASSWORD');
                setMessage({ type: 'error', text: "User already registered. Please log in." });
            } else {
                setMessage({ type: 'error', text: error.message });
                track("auth_error", { step: "signup", error_message: error.message });
            }
        } else {
            track("auth_signup", { method: "password" });
            track("auth_otp_sent");
            setStep('VERIFICATION');
        }
    };

    const handleGoogleLogin = async () => {
        track("auth_google_initiated");
        startTopLoader();
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${location.origin}/auth/callback?next=/learn`,
                },
            });
            if (error) throw error;
        } catch (error) {
            console.error("Error logging in with Google:", error);
            setMessage({ type: 'error', text: "Error logging in with Google" });
            track("auth_error", { step: "google_oauth", error_message: "oauth_failed" });
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const token = otp;

        const { error } = await supabase.auth.verifyOtp({
            email,
            token,
            type: 'signup'
        });

        setIsLoading(false);

        if (error) {
            setMessage({ type: 'error', text: error.message });
            track("auth_error", { step: "otp_verify", error_message: error.message });
        } else {
            track("auth_otp_verified");
            track("auth_login", { method: "password" });
            setMessage(null);
            setIsSuccessScreen(true);
        }
    };


    const handleResend = async () => {
        setIsLoading(true);
        setMessage(null);

        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email
        });

        setIsLoading(false);

        if (error) {
            setMessage({ type: 'error', text: error.message });
        } else {
            setMessage({ type: 'success', text: "Code resent successfully!" });
        }
    };

    const renderStep = () => {
        if (isSuccessScreen) {
            return (
                <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col w-full items-center"
                    style={{ gap: '24px', paddingBottom: '10px' }}
                >
                    <AuthHeader title="Email verified" subtitle="You're all set. Let's get started." />

                    <button
                        onClick={() => { startTopLoader(); window.location.href = '/learn'; }}
                        className="w-full flex items-center justify-center gap-2 text-white transition-all hover:opacity-90 active:opacity-100 cursor-pointer"
                        style={{
                            backgroundColor: 'var(--base-700)',
                            height: '46px',
                            borderRadius: '12px',
                            fontSize: '15px',
                            fontWeight: 500,
                        }}
                    >
                        Start
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </motion.div>
            );
        }

        switch (step) {
            case 'EMAIL':
                return (
                    <motion.div
                        key="EMAIL"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="w-full"
                    >
                        <EmailStep
                            email={email}
                            setEmail={setEmail}
                            onSubmit={handleEmailSubmit}
                            isLoading={isLoading}
                            error={null}
                        />
                    </motion.div>
                );
            case 'LOGIN_PASSWORD':
                return (
                    <motion.div
                        key="LOGIN_PASSWORD"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="w-full"
                    >
                        <LoginStep
                            email={email}
                            onChangeEmail={() => setStep('EMAIL')}
                            password={password}
                            setPassword={setPassword}
                            onSubmit={handleLogin}
                            isLoading={isLoading}
                            error={null}
                        />
                    </motion.div>
                );
            case 'SIGNUP_PASSWORD':
                return (
                    <motion.div
                        key="SIGNUP_PASSWORD"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="w-full"
                    >
                        <SignupStep
                            email={email}
                            onChangeEmail={() => setStep('EMAIL')}
                            password={password}
                            setPassword={setPassword}
                            onSubmit={handleSignup}
                            isLoading={isLoading}
                            error={null}
                        />
                    </motion.div>
                );
            case 'OAUTH_ONLY':
                return (
                    <motion.div
                        key="OAUTH_ONLY"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-col w-full"
                        style={{ gap: '24px' }}
                    >
                        <AuthHeader title="Welcome back" subtitle="This account uses Google sign-in" />

                        <div className="flex flex-col w-full" style={{ gap: '14px' }}>
                            {/* Read-only Email */}
                            <div className="w-full flex flex-col gap-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="font-medium text-slate-900" style={{ fontSize: '14px' }}>Email</label>
                                    <button type="button" onClick={() => setStep('EMAIL')} className="text-[#6B7280] hover:text-slate-900 transition-colors cursor-pointer" style={{ fontSize: '13px' }}>Edit</button>
                                </div>
                                <div className="w-full px-3.5 py-3 rounded-[12px] bg-slate-50 border border-slate-200 text-slate-500" style={{ fontSize: '15px' }}>
                                    {email}
                                </div>
                            </div>

                            {/* Google Button */}
                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                className="w-full flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.98] outline-none cursor-pointer"
                                style={{
                                    backgroundColor: '#F2F4F7',
                                    height: '46px',
                                    borderRadius: '12px',
                                    border: 'none',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#e1e5eba8')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#F2F4F7')}
                            >
                                <svg className="w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M23.766 12.2764C23.766 11.4607 23.6999 10.6406 23.5588 9.83807H12.24V14.4591H18.7217C18.4528 15.9494 17.5885 17.2678 16.323 18.1056V21.1039H20.19C22.4608 19.0139 23.766 15.9274 23.766 12.2764Z" fill="#4285F4" />
                                    <path d="M12.2399 24.0008C15.4765 24.0008 18.2058 22.9382 20.1944 21.1039L16.3274 18.1055C15.2516 18.8375 13.8626 19.252 12.2444 19.252C9.11377 19.252 6.45935 17.1399 5.50693 14.3003H1.51648V17.3912C3.55359 21.4434 7.70278 24.0008 12.2399 24.0008Z" fill="#34A853" />
                                    <path d="M5.50265 14.3003C5.00223 12.8099 5.00223 11.1961 5.50265 9.70575V6.61475H1.51661C-0.185523 10.0056 -0.185523 13.9961 1.51661 17.3869L5.50265 14.3003Z" fill="#FBBC05" />
                                    <path d="M12.2399 4.74966C13.9508 4.7232 15.6043 5.36697 16.8433 6.54867L20.2694 3.12262C18.0999 1.0855 15.2207 -0.0344664 12.2399 0.000808666C7.70278 0.000808666 3.55359 2.55822 1.51648 6.61481L5.50252 9.70581C6.45052 6.86173 9.10935 4.74966 12.2399 4.74966Z" fill="#EA4335" />
                                </svg>
                                <span className="text-[#1F2937] font-medium text-[15px]" style={{ fontFamily: 'var(--font-inter)' }}>
                                    Continue with Google
                                </span>
                            </button>

                            {/* Divider */}
                            <div className="flex items-center justify-center w-full" style={{ gap: '8px' }}>
                                <div className="h-[1px] flex-1" style={{ backgroundColor: 'rgba(23, 23, 23, 0.15)' }}></div>
                                <span className="text-center font-normal" style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '14px', color: 'rgba(23, 23, 23, 0.4)', whiteSpace: 'nowrap' }}>
                                    or
                                </span>
                                <div className="h-[1px] flex-1" style={{ backgroundColor: 'rgba(23, 23, 23, 0.15)' }}></div>
                            </div>

                            {/* Password fallback */}
                            <div className="flex flex-col items-center w-full" style={{ gap: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => setStep('LOGIN_PASSWORD')}
                                    className="font-normal hover:text-slate-600 transition-colors cursor-pointer select-none"
                                    style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: '#6B7280' }}
                                >
                                    I have a password
                                </button>
                                <a
                                    href="/forgot-password"
                                    className="font-normal hover:text-slate-600 transition-colors"
                                    style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: '#6B7280' }}
                                >
                                    Set a password for email login
                                </a>
                            </div>
                        </div>
                    </motion.div>
                );
            case 'VERIFICATION':
                return (
                    <motion.div
                        key="VERIFICATION"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-col w-full items-center"
                        style={{ gap: '24px' }}
                    >
                        <AuthHeader title="Check your email" subtitle={`We sent a code to ${email}`} />

                        <form onSubmit={handleVerify} className="w-full flex flex-col items-center" style={{ gap: '24px' }}>
                            <OtpInput value={otp} onChange={setOtp} autoFocus />

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex items-center justify-center text-white transition-all hover:opacity-90 active:opacity-100 cursor-pointer"
                                style={{ backgroundColor: 'var(--base-700)', height: '46px', borderRadius: '12px', fontSize: '15px', fontWeight: 500 }}
                            >
                                {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Verify"}
                            </button>
                        </form>

                        <div className="flex flex-col items-center w-full" style={{ gap: '6px' }}>
                            <p
                                onClick={handleResend}
                                className="font-normal hover:text-slate-600 transition-colors cursor-pointer select-none"
                                style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: '#6B7280' }}
                            >
                                Didn&apos;t receive a code? Resend
                            </p>
                            <button
                                onClick={() => setStep('EMAIL')}
                                className="font-normal hover:text-slate-600 transition-colors cursor-pointer"
                                style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: '#6B7280' }}
                            >
                                Change email
                            </button>
                        </div>
                    </motion.div>
                );
            default:
                return null;
        }
    };

    return (
        <AnimatePresence mode="popLayout" initial={false}>
            {renderStep()}
        </AnimatePresence>
    );
}
