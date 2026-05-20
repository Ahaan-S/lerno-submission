"use client";

import React, { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function EmailForm() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const supabase = createClient();

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: `${location.origin}/auth/callback`,
                },
            });

            if (error) {
                alert("Error: " + error.message);
            } else {
                alert("Check your email for the login link!");
            }
        } catch (err) {
            console.error(err);
            alert("Something went wrong");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleEmailSubmit} className="w-full flex flex-col" style={{ gap: '14px' }}> {/* Gap increased slightly for better spacing with smaller elements */}
            {/* Header Row */}
            <div className="flex justify-between items-center w-full">
                <label
                    htmlFor="email"
                    className="font-medium text-slate-900"
                    style={{
                        fontFamily: 'var(--font-inter)',
                        fontSize: '14px', // Reduced from 16px
                        color: 'var(--base-800, #0F172A)'
                    }}
                >
                    Email
                </label>
                <Link
                    href="/forgot-password"
                    className="font-normal transition-colors hover:text-slate-600 cursor-pointer select-none"
                    style={{
                        fontFamily: 'var(--font-inter)',
                        fontSize: '14px', // Reduced from 16px
                        color: '#6B7280'
                    }}
                >
                    Forgot password?
                </Link>
            </div>

            {/* Input Field */}
            <div className="w-full relative group">
                <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full outline-none transition-all duration-200"
                    style={{
                        height: '46px', // Reduced from 58.5px
                        padding: '14px', // Reduced from 18px
                        borderRadius: '12px',
                        border: '1px solid #E5E7EB',
                        backgroundColor: 'white',
                        fontFamily: 'var(--font-inter)',
                        fontSize: '15px', // Reduced from 17px
                        color: 'var(--base-800, #0F172A)',
                        boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)',
                    }}
                />
                {/* Placeholder styling via style tag */}
                <style jsx>{`
            input::placeholder {
              color: #9CA3AF;
              font-family: var(--font-inter);
              font-weight: 400;
              font-size: 15px; /* Reduced */
            }
            /* Custom focus shadow similar to image provided */
            input:focus {
               outline: none;
               border-color: #cbd5e1 !important;
               box-shadow: 
                 0px 0px 0px 4px #F1F5F9, /* The thick light gray ring */
                 0px 1px 2px 0px rgba(0, 0, 0, 0.05) !important; /* The subtle drop shadow */
            }
         `}</style>
            </div>

            {/* Continue Button - Conditionally Rendered with smooth transition */}
            <div
                className={`w-full overflow-hidden transition-all duration-500 ease-in-out ${email ? 'max-h-[100px] opacity-100' : 'max-h-0 opacity-0'}`}
                style={{
                    marginTop: email ? '0px' : '0px'
                }}
            >
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center text-white transition-all hover:brightness-110 active:scale-[0.98]"
                    style={{
                        backgroundColor: 'var(--base-700)',
                        height: '46px', // Reduced from 56px
                        borderRadius: '12px',
                        fontSize: '15px', // Reduced from 17px
                        fontFamily: 'var(--font-inter)',
                        fontWeight: 500,
                    }}
                >
                    {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        "Continue"
                    )}
                </button>
            </div>
        </form>
    );
}
