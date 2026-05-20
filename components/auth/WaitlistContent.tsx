"use client";

import React from "react";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function WaitlistContent() {
    const router = useRouter();
    const supabase = createClient();

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push("/auth");
    };

    return (
        <div className="flex flex-col items-center text-center w-full" style={{ gap: '24px' }}>
            {/* Logo */}
            <div className="relative w-[60px] h-[60px]">
                <Image
                    src="/lerno-cap.webp?v=2"
                    alt="Lerno Cap"
                    width={60}
                    height={60}
                    className="object-contain"
                    unoptimized
                />
            </div>

            {/* Text Content */}
            <div className="space-y-3">
                <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'var(--font-inter)' }}>
                    You&apos;re on the waitlist
                </h1>
                <p className="text-slate-500 text-[15px] leading-relaxed max-w-sm mx-auto">
                    Thanks for joining! We&apos;re rolling out access gradually to ensure the best experience. We&apos;ll notify you via email as soon as your account is ready.
                </p>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-full border border-amber-100 text-amber-700 text-sm font-medium">
                <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
                Spot reserved
            </div>

            {/* Divider */}
            <div className="w-full h-[1px] bg-slate-100 my-2"></div>

            {/* Sign Out */}
            <button
                onClick={handleSignOut}
                className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors text-sm font-medium cursor-pointer"
            >
                <LogOut className="w-4 h-4" />
                Sign out
            </button>
        </div>
    );
}
