"use client";

import React, { useRef, useState, useCallback } from "react";

interface OtpInputProps {
    value: string;
    onChange: (value: string) => void;
    length?: number;
    autoFocus?: boolean;
}

/**
 * Single-input OTP field with visual digit boxes.
 * Uses one hidden <input> so copy/paste, arrow keys, and select-all work natively.
 */
export default function OtpInput({ value, onChange, length = 6, autoFocus = false }: OtpInputProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isFocused, setIsFocused] = useState(false);

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const cleaned = e.target.value.replace(/\D/g, "").slice(0, length);
            onChange(cleaned);
        },
        [onChange, length]
    );

    // The "active" box is the next empty slot, or the last box when full
    const activeIdx = value.length < length ? value.length : length - 1;
    const midpoint = Math.floor(length / 2) - 1; // index after which the separator dot appears

    return (
        <div
            className="relative flex items-center gap-2 justify-center cursor-text"
            onClick={() => inputRef.current?.focus()}
        >
            {/* The real input — invisible but receives all keyboard events */}
            <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={length}
                value={value}
                onChange={handleChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                autoFocus={autoFocus}
                className="absolute inset-0 opacity-0 w-full h-full z-10 cursor-text"
                style={{ caretColor: "transparent" }}
                aria-label="Enter verification code"
            />

            {/* Visual digit boxes */}
            {Array.from({ length }, (_, idx) => {
                const char = value[idx] ?? "";
                const isActive = isFocused && idx === activeIdx;

                return (
                    <React.Fragment key={idx}>
                        <div
                            className={`
                                relative w-10 h-11 sm:w-12 sm:h-12
                                flex items-center justify-center
                                text-lg sm:text-xl font-semibold
                                rounded-xl border transition-all duration-150
                                bg-white text-slate-800 select-none
                                ${isActive
                                    ? "border-slate-400 ring-4 ring-slate-50 shadow-sm"
                                    : char
                                    ? "border-slate-300"
                                    : "border-slate-200"
                                }
                            `}
                        >
                            {char || null}
                            {/* Blinking cursor in the active empty box */}
                            {isActive && !char && (
                                <span className="absolute w-[2px] h-5 bg-slate-500 rounded animate-pulse" />
                            )}
                        </div>
                        {idx === midpoint && (
                            <span className="text-slate-300 text-xl select-none mx-0.5">•</span>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}
