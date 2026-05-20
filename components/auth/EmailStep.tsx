import React from "react";
import Link from "next/link";
import SocialButtons from "./SocialButtons";
import AuthHeader from "./AuthHeader";

interface EmailStepProps {
    email: string;
    setEmail: (email: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    isLoading: boolean;
    error: string | null;
}

export default function EmailStep({ email, setEmail, onSubmit, isLoading, error }: EmailStepProps) {
    return (
        <div className="flex flex-col w-full" style={{ gap: '24px' }}>
            <AuthHeader title="Welcome" subtitle="Login or signup below" />

            <div className="flex flex-col w-full" style={{ gap: '9px' }}>
                <form onSubmit={onSubmit} className="w-full flex flex-col" style={{ gap: '14px' }}>

                    {/* Header Label Row */}
                    <div className="flex justify-between items-center w-full">
                        <label className="font-medium text-slate-900" style={{ fontFamily: 'var(--font-inter)', fontSize: '14px' }}>
                            Email
                        </label>
                        <Link href="/forgot-password" className="font-normal hover:text-slate-600 transition-colors cursor-pointer select-none" style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: '#6B7280' }}>
                            Forgot password?
                        </Link>
                    </div>

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

                    <div className={`w-full overflow-hidden transition-all duration-300 ${email ? 'max-h-[100px] mt-[0px] opacity-100' : 'max-h-0 mt-0 opacity-0'}`}>
                        <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center text-white transition-all hover:opacity-90 active:opacity-100 cursor-pointer" style={{ backgroundColor: 'var(--base-700)', height: '46px', borderRadius: '12px', fontSize: '15px', fontWeight: 500 }}>
                            {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Continue"}
                        </button>
                    </div>
                </form>

                {error && <div className="text-red-500 text-sm text-center">{error}</div>}

                <SocialButtons />
            </div>
        </div>
    );
}
