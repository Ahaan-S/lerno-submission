import React from "react";
import Image from "next/image";

interface AuthHeaderProps {
    title: string;
    subtitle?: string;
}

export default function AuthHeader({ title, subtitle }: AuthHeaderProps) {
    return (
        <div className="flex flex-col items-center w-full" style={{ gap: '20px' }}>
            {/* Logo */}
            <div className="relative w-[48px] h-[48px] flex items-center justify-center">
                <Image
                    src="/lerno-cap.webp?v=2"
                    alt="Lerno Cap"
                    width={48}
                    height={48}
                    className="object-contain"
                    unoptimized
                />
            </div>

            {/* Text Frame */}
            <div className="flex flex-col items-center w-full" style={{ gap: '4px' }}>
                <h1
                    className="text-center font-semibold text-slate-900"
                    style={{
                        fontFamily: 'var(--font-inter)',
                        fontSize: '20px',
                        lineHeight: '1.2',
                    }}
                >
                    {title}
                </h1>
                {subtitle && (
                    <p
                        className="text-center font-normal"
                        style={{
                            fontFamily: 'var(--font-inter)',
                            fontSize: '14px',
                            color: '#525252'
                        }}
                    >
                        {subtitle}
                    </p>
                )}
            </div>
        </div>
    );
}
