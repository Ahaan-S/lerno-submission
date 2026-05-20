"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import { track } from "@/lib/analytics";
import { useMarketingCta } from "./useMarketingCta";

// Animated word component
const AnimatedWord = ({
    word,
    delay,
    isVisible
}: {
    word: string;
    delay: number;
    isVisible: boolean;
}) => {
    return (
        <span
            className="inline-block overflow-hidden"
            style={{ verticalAlign: 'top', paddingBottom: '0.18em', marginBottom: '-0.18em' }}
        >
            <span
                className="inline-block transition-all ease-out"
                style={{
                    transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
                    opacity: isVisible ? 1 : 0,
                    transitionDuration: '350ms',
                    transitionDelay: `${delay}ms`,
                }}
            >
                {word}
            </span>
        </span>
    );
};

const Hero = () => {
    const [scrollY, setScrollY] = useState(0);
    const [animationStarted, setAnimationStarted] = useState(false);
    const [animationComplete, setAnimationComplete] = useState(false);
    const [isButtonHovered, setIsButtonHovered] = useState(false);
    const cta = useMarketingCta();
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [posterSrc, setPosterSrc] = useState<string | null>(null);
    const [pandaMargin, setPandaMargin] = useState('-24px');

    useEffect(() => {
        const update = () => {
            const w = window.innerWidth;
            if (w < 768) setPandaMargin('-10px');
            else if (w < 1024) setPandaMargin('-14px');
            else setPandaMargin('-24px');
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            setScrollY(window.scrollY);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Trigger animation on mount with a small delay
    useEffect(() => {
        const timer = setTimeout(() => {
            setAnimationStarted(true);
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    // Start video playback after 2s so the placeholder animation lands first
    useEffect(() => {
        const timer = setTimeout(() => {
            videoRef.current?.play().catch(() => {});
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    // Capture first frame to canvas as soon as video has data — used as fallback poster
    const handleVideoLoaded = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setPosterSrc(canvas.toDataURL('image/jpeg', 0.9));
    };

    // Mark animation as complete after all elements have animated
    useEffect(() => {
        if (animationStarted) {
            // Wait for the longest animation (panda) to complete
            const timer = setTimeout(() => {
                setAnimationComplete(true);
            }, 2500); // Total time for all animations to finish
            return () => clearTimeout(timer);
        }
    }, [animationStarted]);

    // Video parallax: only apply within hero section, clamped to prevent overlap
    const maxParallax = 60; // Maximum offset in pixels
    const rawParallax = scrollY * -0.1;
    const videoParallax = Math.max(rawParallax, -maxParallax);

    // Headline words split by line
    const line1Words = ['Your', 'Personal', 'AI', 'Tutor'];
    const line2Words = ['for', 'CBSE', 'Class', '10 & 11'];
    const wordDelay = 100; // ms between each word
    const pauseBetweenLines = 200; // slight pause after line 1 completes

    // Calculate when headline finishes
    const headlineEndDelay = (line1Words.length * wordDelay) + pauseBetweenLines + (line2Words.length * wordDelay);
    const lineDelay = headlineEndDelay + 550; // delay before the line appears
    const subheadingStartDelay = lineDelay + 50; // delay before subheading starts (after line)
    const videoStartDelay = subheadingStartDelay + 300; // delay before video drops in
    const pandaStartDelay = videoStartDelay + 650; // delay before panda drops (after video lands)

    return (
        <section className="relative flex flex-col items-center justify-start min-h-screen overflow-hidden gap-8 pb-10 sm:gap-10 sm:pb-12 md:gap-12 lg:justify-between lg:gap-0 lg:pb-16">
            {/* Background Gradient */}
            <div
                className="absolute top-0 left-0 w-full z-0 pointer-events-none"
                style={{
                    height: '100%',
                    minHeight: '876px',
                    // Default for mobile (adjust size/position if needed, or keep same but ensure it covers)
                    background: 'radial-gradient(100% 100% at 50% 0%, #0077ED 0%, #FFFFFF 100%)',
                }}
            >
                <style jsx>{`
                    @media (min-width: 768px) {
                        div[style*="radial-gradient"] {
                            background: radial-gradient(1400px 876px at 50% 0%, #0077ED 0%, #FFFFFF 100%) !important;
                        }
                    }
                `}</style>
            </div>
            <div className="flex flex-col items-center text-center px-4 relative z-10 w-full max-w-7xl mx-auto pt-28 sm:pt-32 md:pt-40 lg:pt-[158px] gap-8 sm:gap-10 md:gap-12">

                {/* Header Frame (Headline + Subtext) */}
                <div className="flex flex-col items-center w-full gap-6 sm:gap-7 md:gap-9">
                    {/* Headline with word-by-word animation */}
                    <h1
                        className="text-center text-4xl sm:text-5xl md:text-7xl lg:text-[80px]"
                        style={{
                            fontFamily: 'var(--font-crimson-pro)',
                            fontWeight: 500,
                            lineHeight: '1.08',
                            letterSpacing: '-0.04em',
                            color: 'white',
                        }}
                    >
                        {/* Line 1 */}
                        <span className="block mb-1 md:mb-0">
                            {line1Words.map((word, index) => (
                                <React.Fragment key={index}>
                                    <AnimatedWord
                                        word={word}
                                        delay={index * wordDelay}
                                        isVisible={animationStarted}
                                    />
                                    {index < line1Words.length - 1 && ' '}
                                </React.Fragment>
                            ))}
                        </span>
                        {/* Line 2 */}
                        <span className="block">
                            {line2Words.map((word, index) => (
                                <React.Fragment key={index}>
                                    <AnimatedWord
                                        word={word}
                                        delay={(line1Words.length * wordDelay) + pauseBetweenLines + (index * wordDelay)}
                                        isVisible={animationStarted}
                                    />
                                    {index < line2Words.length - 1 && ' '}
                                </React.Fragment>
                            ))}
                        </span>
                    </h1>

                    {/* Subheading Frame */}
                    <div className="flex flex-col items-center w-full px-3 sm:px-4 gap-4 md:gap-5">
                        {/* The Line - animated */}
                        <div
                            className="hidden md:block transition-all ease-out w-full sm:w-[500px] md:w-[700px]"
                            style={{
                                height: '1px',
                                backgroundColor: 'white',
                                opacity: animationStarted ? 0.8 : 0.5,
                                filter: 'blur(8px)',
                                transitionDuration: '200ms',
                                transitionDelay: `${lineDelay}ms`,
                            }}
                        />

                        {/* Subheading — shorter copy on small screens */}
                        <div
                            className="text-center mx-auto max-w-[min(100%,20rem)] sm:max-w-md md:max-w-[700px] transition-all ease-out"
                            style={{
                                transform: animationStarted ? 'translateY(0)' : 'translateY(20px)',
                                opacity: animationStarted ? 1 : 0,
                                transitionDuration: '400ms',
                                transitionDelay: `${subheadingStartDelay}ms`,
                            }}
                        >
                            <p
                                className="font-medium text-white md:hidden text-sm leading-snug"
                                style={{ fontFamily: 'var(--font-inter)' }}
                            >
                                Explanations, practice, and steps — all from NCERT. Completely free.
                            </p>
                            <p
                                className="hidden md:block font-medium text-white text-xl lg:text-[20px] leading-[135%]"
                                style={{ fontFamily: 'var(--font-inter)' }}
                            >
                                Instant explanations, step-by-step solutions, and smart practice — 100% based on NCERT textbooks. Completely free.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="relative flex justify-center w-full z-30">
                    {/* CTA Button with Shimmer */}
                    <Link
                        href={cta.href}
                        className="cta-shimmer flex items-center justify-center rounded-full px-5 py-2.5 text-sm sm:px-6 sm:py-3 sm:text-base md:px-9 md:py-[14px] md:text-lg"
                        onClick={() => track("marketing_cta_clicked", { cta_label: cta.trackingLabel, location: "hero" })}
                        onMouseEnter={() => setIsButtonHovered(true)}
                        onMouseLeave={() => setIsButtonHovered(false)}
                        style={{
                            position: 'relative',
                            zIndex: 50,
                            cursor: 'pointer',
                            backgroundColor: isButtonHovered ? '#013b6a' : 'var(--primary-600)',
                            fontFamily: 'var(--font-inter)',
                            fontWeight: 600,
                            color: 'white',
                            boxShadow: `
                                0px 10px 20px rgba(0, 0, 0, 0.2), 
                                inset 0px 3px 5px rgba(255, 255, 255, 0.3)
                            `,
                            transform: animationStarted
                                ? (isButtonHovered ? 'translateY(0) scale(1.06)' : 'translateY(0) scale(1)')
                                : 'translateY(25px) scale(1)',
                            opacity: animationStarted ? 1 : 0,
                            transition: animationComplete
                                ? 'transform 400ms ease, background-color 400ms ease, box-shadow 200ms ease'
                                : 'transform 600ms ease-in-out, opacity 600ms ease-in-out',
                            transitionDelay: animationComplete ? '0ms' : (animationStarted ? `${subheadingStartDelay}ms` : '0ms'),
                        }}
                    >
                        {cta.label}
                    </Link>
                </div>

            </div>

            {/* Video + Panda — perspective lives here so rotateX works on direct child */}
            <div
                className="w-full flex shrink-0 justify-center px-4 md:px-0 mt-0 mb-8 md:mb-12 lg:mt-28"
            >
                {/* Relative anchor: panda uses bottom:100% to always sit above the video */}
                <div
                    className="relative w-full md:w-[90%] max-w-[1181px]"
                    style={{ perspective: '1200px', perspectiveOrigin: 'center top' }}
                >
                    {/* Panda — hidden on mobile, always flush above the video on md+ */}
                    <div
                        className="absolute hidden md:block z-20 pointer-events-none will-change-transform"
                        style={{
                            bottom: '100%',
                            left: '25%',
                            marginBottom: pandaMargin,
                            transform: animationStarted
                                ? `translateY(${videoParallax}px)`
                                : `translateY(${videoParallax - 80}px)`,
                            opacity: animationStarted ? 1 : 0,
                            transition: animationComplete ? 'none' : 'transform 700ms ease-out, opacity 500ms ease-out',
                            transitionDelay: animationComplete ? '0ms' : `${pandaStartDelay}ms`,
                        }}
                    >
                        <div className="relative w-[90px] h-[90px] lg:w-[150px] lg:h-[144px]">
                            <Image
                                src="/panda.webp"
                                alt="Study Panda"
                                fill
                                className="object-contain"
                                sizes="(max-width: 1024px) 90px, 150px"
                                priority
                            />
                        </div>
                    </div>

                    {/* Video */}
                    <div
                        className="relative z-10 will-change-transform w-full aspect-[1968/1080]"
                        style={{
                            backgroundColor: '#0a0a0a',
                            borderRadius: 'clamp(8px, 1.5vw, 16px)',
                            boxShadow: '0px 23px 56px -6px rgba(0, 0, 0, 0.18)',
                            overflow: 'hidden',
                            transform: animationStarted
                                ? `translateY(${videoParallax}px) rotateX(0deg) scale(1)`
                                : `translateY(${videoParallax + 100}px) rotateX(-15deg) scale(1.08)`,
                            opacity: animationStarted ? 1 : 0,
                            transformOrigin: 'center top',
                            transition: animationComplete ? 'none' : 'transform 1000ms cubic-bezier(0.22, 1, 0.36, 1), opacity 500ms ease-out',
                            transitionDelay: animationComplete ? '0ms' : `${videoStartDelay}ms`,
                        }}
                    >
                        {/* First-frame fallback — shown if video can't play (low power mode etc.) */}
                        {posterSrc && (
                            <img
                                src={posterSrc}
                                aria-hidden
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    display: 'block',
                                    zIndex: 0,
                                }}
                            />
                        )}
                        <video
                            ref={videoRef}
                            src="/demos/lerno-demo.mp4"
                            muted
                            loop
                            playsInline
                            preload="auto"
                            onLoadedData={handleVideoLoaded}
                            style={{
                                position: 'relative',
                                zIndex: 1,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block',
                            }}
                        />
                        {/* Off-screen canvas for frame capture */}
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                    </div>
                </div>
            </div>

        </section>
    );
};

export default Hero;
