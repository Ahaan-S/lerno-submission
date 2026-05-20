"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Check, BookOpen } from "lucide-react";

const Comparison = () => {
    const [isVisible, setIsVisible] = useState(false);
    const sectionRef = useRef<HTMLElement>(null);

    const otherToolsItems = [
        "Answers from mixed internet sources",
        "Explanations beyond syllabus scope",
        "Inconsistent accuracy across chapters",
        "Not exam-focused",
        "Confusing language for students",
    ];

    const lernoItems = [
        "Answers sourced strictly from NCERT",
        "Chapter-wise, exam-focused explanations",
        "Simple language for Class 8–12 students",
        "Step-by-step learning approach",
        "Built specifically for CBSE & NCERT",
    ];

    // Single intersection observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.15 }
        );
        if (sectionRef.current) observer.observe(sectionRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <section
            ref={sectionRef}
            className={`animate-fade-up ${isVisible ? 'visible' : ''} flex flex-col items-center w-full mt-32 md:mt-40`}
        >
            {/* Header Frame */}
            <div className="flex flex-col items-center gap-3 md:gap-4 px-4 text-center max-w-[90%] md:max-w-3xl">
                {/* Main Heading */}
                <h2
                    className="text-[32px] md:text-5xl lg:text-[48px]"
                    style={{
                        fontFamily: 'var(--font-inter)',
                        fontWeight: 600,
                        lineHeight: '135%',
                        letterSpacing: '-0.02em',
                        margin: 0,
                    }}
                >
                    <span style={{ color: 'var(--base-400)' }}>No generic answers.</span>
                    <br className="hidden md:block" />
                    <span style={{ color: 'var(--base-400)' }}> Only </span>
                    <span style={{ color: 'var(--base-600)' }}>NCERT-aligned</span>
                    <span style={{ color: 'var(--base-400)' }}> learning.</span>
                </h2>

                {/* Subtext */}
                <p
                    className="text-[18px] md:text-xl lg:text-[22px]"
                    style={{
                        fontFamily: 'var(--font-inter)',
                        fontWeight: 400,
                        lineHeight: '135%',
                        letterSpacing: '-0.02em',
                        color: 'var(--base-400)',
                        margin: 0,
                    }}
                >
                    How does Lerno ensure accurate, syllabus-first learning?
                </p>
            </div>

            {/* Main Container Frame */}
            <div className="flex flex-col gap-10 w-full max-w-7xl px-4 md:px-10 mt-10 md:mt-12">
                {/* Comparison Frame - glass container */}
                <div
                    className="p-6 md:p-10 rounded-3xl md:rounded-[24px]"
                    style={{
                        background: 'rgba(255, 255, 255, 0.60)',
                        border: '1px solid rgba(255, 255, 255, 0.80)',
                        boxShadow: `
                            0px 20px 25px -5px rgba(226, 232, 240, 0.50),
                            0px 8px 10px -6px rgba(226, 232, 240, 0.50)
                        `,
                    }}
                >
                    {/* Inner flex with 2 cards */}
                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* Other AI Study Tools Card */}
                        <div
                            className="flex-1 rounded-2xl p-6 md:p-10 flex flex-col gap-6"
                            style={{
                                background: 'linear-gradient(-45deg, #F8FAFC, #F2F6FA)',
                            }}
                        >
                            <h3
                                className="text-xl md:text-2xl"
                                style={{
                                    fontFamily: 'var(--font-inter)',
                                    fontWeight: 500,
                                    lineHeight: '135%',
                                    letterSpacing: '0',
                                    color: 'var(--base-800)',
                                    margin: 0,
                                }}
                            >
                                Other AI Study Tools
                            </h3>

                            <div className="flex flex-col gap-3">
                                {otherToolsItems.map((item, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            opacity: isVisible ? 1 : 0,
                                            transform: isVisible ? 'translateX(0)' : 'translateX(-20px)',
                                            transition: 'opacity 400ms ease-out, transform 400ms ease-out',
                                            transitionDelay: `${300 + index * 100}ms`,
                                        }}
                                    >
                                        <div
                                            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-base-200"
                                        >
                                            <X size={14} color="var(--base-400)" strokeWidth={1.2} />
                                        </div>
                                        <span
                                            className="ml-3 text-sm md:text-base text-base-600"
                                            style={{
                                                fontFamily: 'var(--font-inter)',
                                                fontWeight: 400,
                                                lineHeight: '135%',
                                                letterSpacing: '-0.02em',
                                            }}
                                        >
                                            {item}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Lerno Card */}
                        <div
                            className="flex-1 rounded-2xl p-6 md:p-10 flex flex-col gap-6"
                            style={{
                                background: 'linear-gradient(45deg, rgba(239, 246, 255, 0.80), rgba(238, 242, 255, 0.60))',
                            }}
                        >
                            <h3
                                className="text-xl md:text-2xl"
                                style={{
                                    fontFamily: 'var(--font-inter)',
                                    fontWeight: 500,
                                    lineHeight: '135%',
                                    letterSpacing: '0',
                                    color: 'var(--base-800)',
                                    margin: 0,
                                }}
                            >
                                Lerno
                            </h3>

                            <div className="flex flex-col gap-3">
                                {lernoItems.map((item, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            opacity: isVisible ? 1 : 0,
                                            transform: isVisible ? 'translateX(0)' : 'translateX(-20px)',
                                            transition: 'opacity 400ms ease-out, transform 400ms ease-out',
                                            transitionDelay: `${400 + index * 100}ms`,
                                        }}
                                    >
                                        <div
                                            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                                            style={{
                                                backgroundColor: 'rgba(0, 188, 125, 0.20)',
                                            }}
                                        >
                                            <Check size={14} color="#009966" strokeWidth={1.2} />
                                        </div>
                                        <span
                                            className="ml-3 text-sm md:text-base text-base-600"
                                            style={{
                                                fontFamily: 'var(--font-inter)',
                                                fontWeight: 400,
                                                lineHeight: '135%',
                                                letterSpacing: '-0.02em',
                                            }}
                                        >
                                            {item}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Mockup Frame */}
                            <div
                                className="flex flex-col rounded-2xl bg-white/90 border border-primary-100 shadow-[0px_12px_17px_-3px_rgba(219,234,254,0.50)]"
                            >
                                {/* Example Answer Frame */}
                                <div className="p-5 flex flex-col gap-3">
                                    <span
                                        className="text-xs text-base-400"
                                        style={{
                                            fontFamily: 'var(--font-inter)',
                                            fontWeight: 400,
                                            lineHeight: '135%',
                                            letterSpacing: '-0.02em',
                                        }}
                                    >
                                        Example Answer
                                    </span>

                                    <p
                                        className="text-sm text-base-600 m-0"
                                        style={{
                                            fontFamily: 'var(--font-inter)',
                                            fontWeight: 400,
                                            lineHeight: '135%',
                                            letterSpacing: '-0.02em',
                                        }}
                                    >
                                        Photosynthesis is the process by which green plants use sunlight to synthesize nutrients from carbon dioxide and water.
                                    </p>

                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-start gap-2">
                                            <div className="w-[5px] h-[5px] rounded-full bg-primary-400 mt-[6px] shrink-0" />
                                            <span
                                                className="text-xs text-base-400"
                                                style={{
                                                    fontFamily: 'var(--font-inter)',
                                                    fontWeight: 400,
                                                    lineHeight: '135%',
                                                    letterSpacing: '-0.02em',
                                                }}
                                            >
                                                Light energy is absorbed by chlorophyll
                                            </span>
                                        </div>

                                        <div className="flex items-start gap-2">
                                            <div className="w-[5px] h-[5px] rounded-full bg-primary-400 mt-[6px] shrink-0" />
                                            <span
                                                className="text-xs text-base-400"
                                                style={{
                                                    fontFamily: 'var(--font-inter)',
                                                    fontWeight: 400,
                                                    lineHeight: '135%',
                                                    letterSpacing: '-0.02em',
                                                }}
                                            >
                                                Water molecules are split into hydrogen and oxygen
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* NCERT Source Frame */}
                                <div
                                    className="px-5 flex items-center gap-2 h-11 border-t border-[#DBEAFE] rounded-b-2xl"
                                    style={{
                                        background: 'linear-gradient(90deg, rgba(239, 246, 255, 0.80), rgba(238, 242, 255, 0.80))',
                                    }}
                                >
                                    <BookOpen size={14} color="var(--primary-400)" />
                                    <span
                                        className="text-[13px] text-primary-400"
                                        style={{
                                            fontFamily: 'var(--font-inter)',
                                            fontWeight: 400,
                                            lineHeight: '135%',
                                            letterSpacing: '-0.02em',
                                        }}
                                    >
                                        NCERT source
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Text */}
                <p
                    className="text-center text-lg md:text-[18px] text-base-400 m-0"
                    style={{
                        fontFamily: 'var(--font-inter)',
                        fontWeight: 400,
                        lineHeight: '135%',
                        letterSpacing: '-0.02em',
                    }}
                >
                    Trusted by CBSE students across India
                </p>
            </div>
        </section>
    );
};

export default Comparison;
