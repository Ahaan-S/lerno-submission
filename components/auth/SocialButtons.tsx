"use client";

import React from "react";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";

export default function SocialButtons() {
    const supabase = createClient();

    const handleSocialLogin = async (provider: 'google' | 'apple' | 'azure' | 'facebook') => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: `${location.origin}/auth/callback?next=/learn`,
                },
            });
            if (error) throw error;
        } catch (error) {
            console.error("Error logging in with social provider:", error);
            alert("Error logging in with " + provider);
        }
    };

    return (
        <div className="flex flex-col w-full" style={{ gap: '14px' }}>

            {/* Divider */}
            <div className="flex items-center justify-center w-full" style={{ gap: '8px' }}>
                <div className="h-[1px] flex-1" style={{ backgroundColor: 'rgba(23, 23, 23, 0.15)' }}></div>
                <span
                    className="text-center font-normal"
                    style={{
                        fontFamily: 'var(--font-geist-sans)',
                        fontSize: '14px',
                        color: 'rgba(23, 23, 23, 0.4)',
                        whiteSpace: 'nowrap'
                    }}
                >
                    or
                </span>
                <div className="h-[1px] flex-1" style={{ backgroundColor: 'rgba(23, 23, 23, 0.15)' }}></div>
            </div>

            {/* Platforms Frame - Horizontal Flex */}
            <div className="flex flex-row w-full" style={{ gap: '13px' }}>
                {/* Google */}
                <SocialButton
                    icon={
                        <div className="flex items-center justify-center gap-2.5">
                            <svg className="w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M23.766 12.2764C23.766 11.4607 23.6999 10.6406 23.5588 9.83807H12.24V14.4591H18.7217C18.4528 15.9494 17.5885 17.2678 16.323 18.1056V21.1039H20.19C22.4608 19.0139 23.766 15.9274 23.766 12.2764Z" fill="#4285F4" />
                                <path d="M12.2399 24.0008C15.4765 24.0008 18.2058 22.9382 20.1944 21.1039L16.3274 18.1055C15.2516 18.8375 13.8626 19.252 12.2444 19.252C9.11377 19.252 6.45935 17.1399 5.50693 14.3003H1.51648V17.3912C3.55359 21.4434 7.70278 24.0008 12.2399 24.0008Z" fill="#34A853" />
                                <path d="M5.50265 14.3003C5.00223 12.8099 5.00223 11.1961 5.50265 9.70575V6.61475H1.51661C-0.185523 10.0056 -0.185523 13.9961 1.51661 17.3869L5.50265 14.3003Z" fill="#FBBC05" />
                                <path d="M12.2399 4.74966C13.9508 4.7232 15.6043 5.36697 16.8433 6.54867L20.2694 3.12262C18.0999 1.0855 15.2207 -0.0344664 12.2399 0.000808666C7.70278 0.000808666 3.55359 2.55822 1.51648 6.61481L5.50252 9.70581C6.45052 6.86173 9.10935 4.74966 12.2399 4.74966Z" fill="#EA4335" />
                            </svg>
                            <span className="text-[#1F2937] font-medium text-[15px]" style={{ fontFamily: 'var(--font-inter)' }}>
                                Continue with Google
                            </span>
                        </div>
                    }
                    onClick={() => handleSocialLogin('google')}
                />
            </div>
        </div>
    );
}

function SocialButton({ icon, onClick }: { icon: React.ReactNode; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="social-btn flex items-center justify-center w-full transition-all duration-200 active:scale-[0.98] outline-none hover:bg-slate-200/80"
            style={{
                height: '46px',
                borderRadius: '12px',
                padding: '0px',
                border: 'none',
                cursor: 'pointer'
            }}
        >
            <div className="flex items-center justify-center">
                {icon}
            </div>
            <style jsx>{`
        .social-btn {
          background-color: #F2F4F7;
        }
        .social-btn:hover {
          background-color: #e1e5eba8 !important; /* Force override */
        }
      `}</style>
        </button>
    );
}
