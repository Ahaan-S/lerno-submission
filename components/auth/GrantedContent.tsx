"use client";

import React from "react";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function GrantedContent() {
    const router = useRouter();
    const supabase = createClient();

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push("/auth");
    };

    return (
        <div className="flex flex-col items-center text-center w-full" style={{ gap: "24px" }}>
            <div className="relative w-[60px] h-[60px]">
                <Image
                    src="/lerno-cap.webp?v=2"
                    alt="Lerno"
                    width={60}
                    height={60}
                    className="object-contain"
                    unoptimized
                />
            </div>
            <div className="space-y-3">
                <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-inter)" }}>
                    You&apos;re in
                </h1>
                <p className="text-slate-500 text-[15px] leading-relaxed max-w-sm mx-auto">
                    Your account has access. Welcome to Lerno.
                </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100 text-emerald-700 text-sm font-medium">
                Access granted
            </div>
            <div className="w-full h-[1px] bg-slate-100 my-2" />
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
