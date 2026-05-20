"use client";

import React, { useEffect, useRef, useState } from "react";

const Demo = () => {
    const [isVisible, setIsVisible] = useState(false);
    const sectionRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.2 }
        );
        if (sectionRef.current) observer.observe(sectionRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <section
            id="demo-section"
            className="scroll-mt-32"
            ref={sectionRef}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '40px',
                marginTop: '160px',
                padding: '0 clamp(20px, 5vw, 80px)',
                overflow: 'visible',
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
                transition: 'opacity 600ms ease-out, transform 700ms ease-out',
            }}
        >
            {/* Title */}
            <h2
                className="text-[32px] md:text-5xl lg:text-[48px]"
                style={{
                    fontFamily: 'var(--font-inter)',
                    fontWeight: 600,
                    lineHeight: '135%',
                    textAlign: 'center',
                }}
            >
                <span style={{ color: 'var(--base-400)' }}>See </span>
                <span style={{ color: 'var(--base-600)' }}>Lerno</span>
                <span style={{ color: 'var(--base-400)' }}> in action.</span>
            </h2>

            {/* Demo Frame Container */}
            <div style={{ position: 'relative', maxWidth: '1170px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* Carousel Container - same size as Cards rows */}
                <div
                    style={{
                        width: '100%',
                        minHeight: '320px',
                        backgroundColor: 'var(--base-600)',
                        borderRadius: '40px',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'visible',
                        boxShadow: '0px 23px 56px -6px rgba(0, 0, 0, 0.18)',
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            aspectRatio: '16 / 9',
                            maxHeight: '560px',
                            overflow: 'hidden',
                            borderRadius: '40px',
                        }}
                    >
                        <video
                            src="/demos/learn-demo.mp4"
                            controls
                            playsInline
                            preload="metadata"
                            style={{
                                width: '100%',
                                height: '100%',
                                display: 'block',
                                objectFit: 'cover',
                                backgroundColor: 'var(--base-700)',
                            }}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Demo;
