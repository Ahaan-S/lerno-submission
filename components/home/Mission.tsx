"use client";

import React, { useState, useEffect, useRef } from "react";

export default function Mission() {
    const [visible, setVisible] = useState(false);
    const ref = useRef<HTMLElement>(null);

    useEffect(() => {
        const obs = new IntersectionObserver(
            ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
            { threshold: 0.2 }
        );
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, []);

    const fade = (delay: number): React.CSSProperties => ({
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(18px)',
        transition: `opacity 600ms ease-out ${delay}ms, transform 600ms ease-out ${delay}ms`,
    });

    return (
        <section
            ref={ref}
            className="w-full flex justify-center px-6 sm:px-10"
            style={{ paddingTop: '96px', paddingBottom: '100px' }}
        >
            <div className="w-full" style={{ maxWidth: '760px' }}>

                {/* Label */}
                <div style={{ ...fade(0), display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
                    <span style={{
                        display: 'inline-block',
                        width: '20px',
                        height: '1.5px',
                        backgroundColor: 'var(--primary-600)',
                        borderRadius: '2px',
                    }} />
                    <span style={{
                        fontFamily: 'var(--font-inter)',
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: 'var(--primary-600)',
                    }}>
                        Our mission
                    </span>
                </div>

                {/* Headline */}
                <h2
                    className="text-[34px] sm:text-[44px] lg:text-[52px]"
                    style={{
                        ...fade(80),
                        fontFamily: 'var(--font-inter)',
                        fontWeight: 600,
                        lineHeight: '118%',
                        letterSpacing: '-0.03em',
                        color: 'var(--base-700)',
                        marginBottom: '28px',
                    }}
                >
                    Every student in India{' '}
                    <br className="hidden sm:block" />
                    deserves a teacher{' '}
                    <span style={{
                        color: 'transparent',
                        WebkitTextStroke: '1.5px var(--base-400)',
                    }}>
                        that knows them.
                    </span>
                </h2>

                {/* Thin rule */}
                <div style={{
                    ...fade(160),
                    width: '40px',
                    height: '1px',
                    backgroundColor: 'var(--base-200)',
                    marginBottom: '28px',
                }} />

                {/* Body */}
                <p
                    className="text-[16px] sm:text-[18px]"
                    style={{
                        ...fade(220),
                        fontFamily: 'var(--font-inter)',
                        fontWeight: 400,
                        lineHeight: '168%',
                        color: 'var(--base-500)',
                        marginBottom: '48px',
                        maxWidth: '600px',
                    }}
                >
                    Most students study with textbooks and generic AI tools that weren&apos;t built for them.
                    Lerno is different — it knows your NCERT syllabus, remembers your weak spots,
                    and explains things the way your best teacher would.{' '}
                    <span style={{ color: 'var(--base-700)', fontWeight: 500 }}>
                        Free, for every CBSE student.
                    </span>
                </p>

                {/* Three values — small, tight, horizontal */}
                <div
                    style={{ ...fade(320) }}
                    className="flex flex-col sm:flex-row gap-6 sm:gap-0"
                >
                    {[
                        { number: 'Personal', label: 'Adapts to how you learn' },
                        { number: '100% Free', label: 'vs. ₹500/hr private tutors' },
                        { number: 'NCERT', label: 'Strictly curriculum-aligned' },
                    ].map((item, i) => (
                        <React.Fragment key={i}>
                            <div style={{ flex: 1 }}>
                                <span style={{
                                    display: 'block',
                                    fontFamily: 'var(--font-inter)',
                                    fontSize: '22px',
                                    fontWeight: 700,
                                    letterSpacing: '-0.03em',
                                    color: 'var(--base-700)',
                                    lineHeight: '1',
                                    marginBottom: '4px',
                                }}>
                                    {item.number}
                                </span>
                                <span style={{
                                    fontFamily: 'var(--font-inter)',
                                    fontSize: '13px',
                                    fontWeight: 400,
                                    color: 'var(--base-400)',
                                    letterSpacing: '-0.01em',
                                }}>
                                    {item.label}
                                </span>
                            </div>
                            {i < 2 && (
                                <div
                                    className="hidden sm:block"
                                    style={{
                                        width: '1px',
                                        alignSelf: 'stretch',
                                        backgroundColor: 'var(--base-200)',
                                        margin: '0 40px',
                                    }}
                                />
                            )}
                        </React.Fragment>
                    ))}
                </div>

            </div>
        </section>
    );
}
