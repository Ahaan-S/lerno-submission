"use client";

import React, { useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

const GAP = 6; // Slightly reduced from 8px (mt-2)

export function TooltipHint({
    children,
    label,
    side = "bottom",
}: {
    children: React.ReactNode;
    label: string;
    side?: "top" | "bottom" | "left" | "right";
}) {
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0, transform: "translate(-50%, 0)" });
    const triggerRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!visible || !triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        let top = 0;
        let left = rect.left + rect.width / 2;
        let transformStr = "translate(-50%, 0)";
        if (side === "bottom") {
            top = rect.bottom + GAP;
        } else if (side === "top") {
            top = rect.top - GAP;
            transformStr = "translate(-50%, -100%)";
        } else if (side === "right") {
            left = rect.right + GAP;
            top = rect.top + rect.height / 2;
            transformStr = "translate(0, -50%)";
        } else {
            left = rect.left - GAP;
            top = rect.top + rect.height / 2;
            transformStr = "translate(-100%, -50%)";
        }
        setPos({ top, left, transform: transformStr });
    }, [visible, side]);

    return (
        <div
            ref={triggerRef}
            className="relative inline-flex"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            {children}
            {visible &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        className="fixed px-2.5 py-1.5 rounded-md bg-black text-white text-xs font-normal whitespace-nowrap z-[10002] pointer-events-none"
                        style={{
                            fontFamily: "var(--font-inter)",
                            left: pos.left,
                            top: pos.top,
                            transform: pos.transform,
                        }}
                    >
                        {label}
                    </div>,
                    document.body
                )}
        </div>
    );
}
