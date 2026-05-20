import React, { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import SocialButtons from "./SocialButtons";
import AuthHeader from "./AuthHeader";

interface LoginStepProps {
    email: string;
    onChangeEmail: () => void;
    password: string;
    setPassword: (password: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    isLoading: boolean;
    error: string | null;
}

export default function LoginStep({ email, onChangeEmail, password, setPassword, onSubmit, isLoading, error }: LoginStepProps) {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div className="flex flex-col w-full" style={{ gap: '24px' }}>
            <AuthHeader title="Welcome back" />

            <div className="flex flex-col w-full" style={{ gap: '14px' }}>
                <form onSubmit={onSubmit} className="w-full flex flex-col" style={{ gap: '14px' }}>
                    {/* Read-only Email */}
                    <div className="w-full flex flex-col gap-1.5">
                        <div className="flex justify-between items-center">
                            <label className="font-medium text-slate-900" style={{ fontSize: '14px' }}>Email</label>
                            <button type="button" onClick={onChangeEmail} className="text-[#6B7280] hover:text-slate-900 transition-colors cursor-pointer" style={{ fontSize: '13px' }}>Edit</button>
                        </div>
                        <div className="w-full px-3.5 py-3 rounded-[12px] bg-slate-50 border border-slate-200 text-slate-500" style={{ fontSize: '15px' }}>
                            {email}
                        </div>
                    </div>

                    {/* Password Input */}
                    <div className="w-full flex flex-col gap-1.5 relative group">
                        <div className="flex justify-between items-center w-full">
                            <label className="font-medium text-slate-900" style={{ fontSize: '14px' }}>Password</label>
                            <Link href="/forgot-password" className="font-normal hover:text-slate-600 transition-colors cursor-pointer select-none" style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: '#6B7280' }}>
                                Forgot password?
                            </Link>
                        </div>
                        <div className="relative w-full">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className={`w-full outline-none transition-all duration-200 ${!showPassword && password ? 'font-mono text-lg tracking-wide' : 'font-sans'}`}
                                style={{
                                    height: '46px',
                                    padding: '14px',
                                    paddingRight: '40px', // Space for eye icon
                                    borderRadius: '12px',
                                    border: '1px solid #E5E7EB',
                                    backgroundColor: 'white',
                                    fontSize: !showPassword && password ? '20px' : '15px', // Increase font size for dots
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

                    <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center text-white mt-2 transition-all hover:opacity-90 active:opacity-100 cursor-pointer" style={{ backgroundColor: 'var(--base-700)', height: '46px', borderRadius: '12px', fontSize: '15px', fontWeight: 500 }}>
                        {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Log in"}
                    </button>
                </form>

                {error && <div className="text-red-500 text-sm text-center">{error}</div>}

                <SocialButtons />
            </div>
        </div>
    );
}
