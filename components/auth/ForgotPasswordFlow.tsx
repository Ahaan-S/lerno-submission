"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import AuthHeader from "./AuthHeader";
import OtpInput from "./OtpInput";

type ForgotPasswordStep = 'ENTER_EMAIL' | 'VERIFY_CODE' | 'NEW_PASSWORD' | 'SUCCESS';

interface ForgotPasswordFlowProps {
    setMessage: (msg: { type: 'error' | 'success', text: string } | null) => void;
}

export default function ForgotPasswordFlow({ setMessage }: ForgotPasswordFlowProps) {
    const [step, setStep] = useState<ForgotPasswordStep>('ENTER_EMAIL');
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const router = useRouter();
    const supabase = createClient();

    // Reset message when step changes
    useEffect(() => {
        setMessage(null);
    }, [step, setMessage]);

    // Step 1: Send recovery email
    const handleSendRecoveryEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${location.origin}/forgot-password`
        });

        setIsLoading(false);

        if (error) {
            setMessage({ type: 'error', text: error.message });
        } else {
            setStep('VERIFY_CODE');
        }
    };

    // Step 2: Verify recovery code
    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const token = otp;

        const { error } = await supabase.auth.verifyOtp({
            email,
            token,
            type: 'recovery'
        });

        setIsLoading(false);

        if (error) {
            setMessage({ type: 'error', text: error.message });
        } else {
            setStep('NEW_PASSWORD');
        }
    };

    // Step 3: Update password
    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        setIsLoading(false);

        if (error) {
            setMessage({ type: 'error', text: error.message });
        } else {
            setMessage(null);
            setStep('SUCCESS');
        }
    };


    const handleResend = async () => {
        setIsLoading(true);
        setMessage(null);

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${location.origin}/forgot-password`
        });

        setIsLoading(false);

        if (error) {
            setMessage({ type: 'error', text: error.message });
        } else {
            setMessage({ type: 'success', text: "Recovery code resent successfully!" });
        }
    };

    // --- STEP 1: Enter Email ---
    if (step === 'ENTER_EMAIL') {
        return (
            <div className="flex flex-col w-full" style={{ gap: '24px' }}>
                <AuthHeader title="Recover your account" />

                <form onSubmit={handleSendRecoveryEmail} className="w-full flex flex-col" style={{ gap: '14px' }}>
                    {/* Email Input */}
                    <div className="w-full flex flex-col gap-1.5">
                        <label className="font-medium text-slate-900" style={{ fontFamily: 'var(--font-inter)', fontSize: '14px' }}>
                            Email
                        </label>
                        <div className="w-full relative group">
                            <input
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full outline-none transition-all duration-200"
                                style={{
                                    height: '46px',
                                    padding: '14px',
                                    borderRadius: '12px',
                                    border: '1px solid #E5E7EB',
                                    backgroundColor: 'white',
                                    fontFamily: 'var(--font-inter)',
                                    fontSize: '15px',
                                    color: '#0F172A',
                                    boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)',
                                }}
                            />
                            <style jsx>{`
                                input:focus {
                                    outline: none;
                                    border-color: #cbd5e1 !important;
                                    box-shadow: 0px 0px 0px 4px #F1F5F9, 0px 1px 2px 0px rgba(0, 0, 0, 0.05) !important;
                                }
                                input::placeholder { color: #9CA3AF; font-size: 15px; }
                            `}</style>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex items-center justify-center text-white mt-2 transition-all hover:opacity-90 active:opacity-100 cursor-pointer"
                        style={{ backgroundColor: 'var(--base-700)', height: '46px', borderRadius: '12px', fontSize: '15px', fontWeight: 500 }}
                    >
                        {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Send me a code by email"}
                    </button>
                </form>

                {/* Back to Login */}
                <div className="w-full text-center">
                    <Link href="/auth" className="text-slate-500 font-medium text-sm hover:text-slate-800 transition-colors cursor-pointer">
                        Back to login
                    </Link>
                </div>
            </div>
        );
    }

    // --- STEP 2: Verify Recovery Code ---
    if (step === 'VERIFY_CODE') {
        return (
            <div className="flex flex-col w-full items-center relative" style={{ gap: '20px' }}>
                <AuthHeader title="" />

                <div className="text-center space-y-2">
                    <p className="text-slate-600 text-[15px] px-4">
                        An email containing a recovery code has been sent to <strong>{email}</strong>
                    </p>
                </div>

                <form onSubmit={handleVerifyCode} className="w-full flex flex-col items-center" style={{ gap: '24px' }}>
                    <OtpInput value={otp} onChange={setOtp} autoFocus />

                    <p onClick={handleResend} className="text-slate-400 text-sm hover:text-slate-600 cursor-pointer transition-colors">
                        Did not receive your code? Resend one.
                    </p>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex items-center justify-center text-white transition-all hover:opacity-90 active:opacity-100 cursor-pointer"
                        style={{ backgroundColor: 'var(--base-700)', height: '46px', borderRadius: '12px', fontSize: '15px', fontWeight: 500 }}
                    >
                        {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Verify"}
                    </button>
                </form>

                <div className="w-full border-t border-slate-100 pt-4 text-center">
                    <p className="text-slate-400 text-sm">{email}</p>
                    <button onClick={() => setStep('ENTER_EMAIL')} className="text-slate-500 font-medium text-sm hover:text-slate-800 mt-1 cursor-pointer transition-colors">
                        Change account
                    </button>
                </div>
            </div>
        );
    }

    // --- STEP 3: Enter New Password ---
    if (step === 'NEW_PASSWORD') {
        return (
            <div className="flex flex-col w-full" style={{ gap: '24px' }}>
                <AuthHeader title="Account successfully recovered" subtitle="Please change your password." />

                <form onSubmit={handleUpdatePassword} className="w-full flex flex-col" style={{ gap: '14px' }}>
                    {/* Password Input */}
                    <div className="w-full flex flex-col gap-1.5 relative group">
                        <label className="font-medium text-slate-900" style={{ fontSize: '14px' }}>Password</label>
                        <div className="relative w-full">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                className={`w-full outline-none transition-all duration-200 ${!showPassword && newPassword ? 'font-mono text-lg tracking-wide' : 'font-sans'}`}
                                style={{
                                    height: '46px',
                                    padding: '14px',
                                    paddingRight: '40px',
                                    borderRadius: '12px',
                                    border: '1px solid #E5E7EB',
                                    backgroundColor: 'white',
                                    fontSize: !showPassword && newPassword ? '20px' : '15px',
                                    color: '#0F172A',
                                    boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)',
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        <style jsx>{`
                            input:focus {
                                outline: none;
                                border-color: #cbd5e1 !important;
                                box-shadow: 0px 0px 0px 4px #F1F5F9, 0px 1px 2px 0px rgba(0, 0, 0, 0.05) !important;
                            }
                        `}</style>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 text-white mt-2 transition-all hover:opacity-90 active:opacity-100 cursor-pointer"
                        style={{ backgroundColor: 'var(--base-700)', height: '46px', borderRadius: '12px', fontSize: '15px', fontWeight: 500 }}
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                Change password
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </form>

                <div className="w-full border-t border-slate-100 pt-4 text-center">
                    <p className="text-slate-400 text-sm">{email}</p>
                </div>
            </div>
        );
    }

    // --- STEP 4: Success ---
    if (step === 'SUCCESS') {
        return (
            <div className="flex flex-col w-full items-center animate-in fade-in zoom-in-95 duration-500" style={{ gap: '24px', paddingBottom: '10px' }}>
                {/* Lerno Logo */}
                <div className="mb-4 relative w-[48px] h-[48px] flex items-center justify-center">
                    <Image
                        src="/lerno-cap.webp?v=2"
                        alt="Lerno Cap"
                        width={48}
                        height={48}
                        className="object-contain"
                        unoptimized
                    />
                </div>

                <div className="text-center">
                    <h2 className="text-[17px] font-normal text-slate-700" style={{ fontFamily: 'var(--font-inter)' }}>
                        Password successfully reset
                    </h2>
                </div>

                <div className="w-full pt-2 flex justify-center">
                    <button
                        onClick={() => router.push('/auth')}
                        className="flex items-center justify-center gap-2 transition-all hover:opacity-90 active:opacity-100 cursor-pointer"
                        style={{
                            backgroundColor: '#111',
                            color: 'white',
                            height: '44px',
                            borderRadius: '10px',
                            paddingLeft: '24px',
                            paddingRight: '24px',
                            fontSize: '15px',
                            fontWeight: 500
                        }}
                    >
                        Back to login
                        <ArrowRight className="w-4 h-4 ml-1" />
                    </button>
                </div>
            </div>
        );
    }

    return null;
}
