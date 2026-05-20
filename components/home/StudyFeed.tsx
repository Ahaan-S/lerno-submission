"use client";

import React, { useState, useEffect, useRef } from "react";
import { Brain, Target, RefreshCcw, Rocket, Check } from "lucide-react";

const StudyFeed = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [mobileScale, setMobileScale] = useState(1);
    const sectionRef = useRef<HTMLDivElement>(null);
    const stickyRef = useRef<HTMLDivElement>(null);

    // Intersection Observer to detect when section is in viewport
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.1 }
        );

        if (sectionRef.current) {
            observer.observe(sectionRef.current);
        }

        return () => observer.disconnect();
    }, []);

    // Responsive scale factor for the phone mockup
    useEffect(() => {
        const updateScale = () => {
            const w = window.innerWidth;
            if (w < 480) setMobileScale(0.68);
            else if (w < 640) setMobileScale(0.78);
            else if (w < 768) setMobileScale(0.88);
            else setMobileScale(1);
        };
        updateScale();
        window.addEventListener('resize', updateScale);
        return () => window.removeEventListener('resize', updateScale);
    }, []);

    // Scroll-linked animation - tracks progress through the tall container
    useEffect(() => {
        const handleScroll = () => {
            if (!sectionRef.current) return;

            const rect = sectionRef.current.getBoundingClientRect();
            const sectionHeight = sectionRef.current.offsetHeight;
            const windowHeight = window.innerHeight;

            // Calculate how far we've scrolled through the section
            // Progress starts when section enters viewport and ends when we've scrolled past
            const scrollableDistance = sectionHeight - windowHeight;
            const scrolled = -rect.top;

            const progress = Math.min(1, Math.max(0, scrolled / scrollableDistance));
            setScrollProgress(progress);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();

        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const features = [
        {
            icon: <Brain size={28} strokeWidth={1.25} color="var(--base-400)" />,
            title: "Adaptive questions",
            description: <>Adjusts to your <br /> learning pace</>
        },
        {
            icon: <Target size={28} strokeWidth={1.25} color="var(--base-400)" />,
            title: "Weak area focus",
            description: <>Strengthens what <br /> you struggle with</>
        },
        {
            icon: <RefreshCcw size={28} strokeWidth={1.25} color="var(--base-400)" />,
            title: "Smart revision",
            description: <>Revises topics at <br /> the right time</>
        },
        {
            icon: <Rocket size={28} strokeWidth={1.25} color="var(--base-400)" />,
            title: "Daily goals",
            description: <>Keeps you consistent <br /> without pressure</>
        }
    ];

    // Animation delays (in ms) for initial appearance
    const titleDelay = 0;
    const subtitleDelay = 150;
    const featuresBaseDelay = 300;
    const featureStagger = 100;
    const demoDelay = 600;

    // Phone entry animation (0-35% of scroll) - phone flips into view
    const phoneEntryProgress = Math.min(1, scrollProgress / 0.35);

    // Content animation starts AFTER phone is fully visible (35-100%)
    // Re-map 0.35-1.0 to 0-1 for content stages
    const contentProgress = scrollProgress > 0.25
        ? (scrollProgress - 0.25) / 0.75
        : 0;

    // Content stages based on contentProgress (0-1)
    // Stage 1: 0-0.02 (shimmer/loading) - almost instant
    // Stage 2: 0.02-0.15 (question appears)
    // Stage 3: 0.15-0.28 (options slide in - faster)
    // Stage 4: 0.28-0.38 (selection - faster)
    // Stage 5: 0.38-0.48 (correct reveal - faster)
    // Stage 6: 0.48-0.85 (explanation - more time)
    // Stage 7: 0.85-1.0 (swipe to next question)

    const stage = contentProgress < 0.02 ? 1
        : contentProgress < 0.15 ? 2
            : contentProgress < 0.28 ? 3
                : contentProgress < 0.38 ? 4
                    : contentProgress < 0.48 ? 5
                        : contentProgress < 0.85 ? 6
                            : 7;

    // Progress within each stage (0-1)
    const stageProgress = (progress: number, start: number, end: number) =>
        Math.min(1, Math.max(0, (progress - start) / (end - start)));

    const questionProgress = stageProgress(contentProgress, 0.02, 0.12);
    const option1Progress = stageProgress(contentProgress, 0.15, 0.18);
    const option2Progress = stageProgress(contentProgress, 0.18, 0.21);
    const option3Progress = stageProgress(contentProgress, 0.21, 0.24);
    const option4Progress = stageProgress(contentProgress, 0.24, 0.28);
    const selectionProgress = stageProgress(contentProgress, 0.28, 0.35);
    const correctProgress = stageProgress(contentProgress, 0.38, 0.45);
    const explanationProgress = stageProgress(contentProgress, 0.48, 0.65);
    const swipeProgress = stageProgress(contentProgress, 0.85, 1.0);

    const options = [
        { text: "Only single bonds", correct: true },
        { text: "Only double bonds", correct: false },
        { text: "Only triple bonds", correct: false },
        { text: "2 double, 1 single", correct: false },
    ];

    // Second question for the swipe animation
    const nextQuestion = {
        subject: "Math · Quadratic Equations",
        difficulty: "Medium",
        difficultyColor: "#F59E0B",
        difficultyBg: "#FFFBEB",
        text: "If x² + 5x + 6 = 0, then x = ?",
        options: ["-2 and -3", "2 and 3", "-1 and -6", "1 and 6"],
    };

    return (
        // Tall container to allow scroll distance for the animation
        <div
            ref={sectionRef}
            className="relative mt-20 h-[550vh] md:h-[350vh]"
        >
            {/* Sticky container - stays in place while scrolling */}
            <div
                ref={stickyRef}
                className="flex flex-col items-center w-full bg-white sticky top-[-450px] sm:top-[-280px] md:top-[-380px] lg:top-[-220px] min-h-[90vh] pt-24 md:pt-[80px] pb-10 md:pb-[60px] overflow-hidden"
            >
                {/* Main Frame - scaled for 1440px */}
                <div
                    className="flex flex-col items-center w-full"
                    style={{
                        maxWidth: '1215px',
                        gap: '45px',
                    }}
                >
                    {/* Heading Frame */}
                    <div className="flex flex-col items-center text-center">
                        {/* Title with animation */}
                        <h2
                            className="text-[32px] md:text-5xl lg:text-[48px]"
                            style={{
                                fontFamily: 'var(--font-inter)',
                                fontWeight: 600,
                                lineHeight: '135%',
                                transform: isVisible ? 'translateY(0)' : 'translateY(25px)',
                                opacity: isVisible ? 1 : 0,
                                transition: 'transform 500ms ease-out, opacity 400ms ease-out',
                                transitionDelay: `${titleDelay}ms`,
                            }}
                        >
                            <span style={{ color: 'var(--base-600)' }}>Personalized</span>{' '}
                            <span style={{ color: 'var(--base-400)' }}>Study Feed</span>
                        </h2>
                        {/* Subtitle with animation */}
                        <p
                            className="text-[18px] md:text-xl"
                            style={{
                                fontFamily: 'var(--font-inter)',
                                fontWeight: 400,
                                lineHeight: '135%',
                                color: 'var(--base-400)',
                                marginTop: '0px',
                                transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                                opacity: isVisible ? 1 : 0,
                                transition: 'transform 500ms ease-out, opacity 400ms ease-out',
                                transitionDelay: `${subtitleDelay}ms`,
                            }}
                        >
                            Questions, revisions, and topics tailored to your class, syllabus, and recent activity.
                        </p>
                    </div>

                    {/* Demo + Features Frame */}
                    <div
                        className="flex flex-col items-center w-full"
                        style={{
                            borderRadius: '40px',
                            padding: '40px 40px 0px 40px',
                            boxShadow: `
                                0px 20px 40px rgba(0, 0, 0, 0.08),
                                0px 2px 4px rgba(0, 0, 0, 0.04)
                            `,
                            backdropFilter: 'blur(30px)',
                            backgroundColor: 'rgba(255, 255, 255, 0.8)',
                            gap: '40px',
                        }}
                    >
                        {/* Features Frame */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-[920px] justify-items-center">
                            {features.map((feature, index) => (
                                <div
                                    key={index}
                                    className="flex items-center flex-1"
                                    style={{
                                        padding: '12px',
                                        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                                        opacity: isVisible ? 1 : 0,
                                        transition: 'transform 450ms ease-out, opacity 350ms ease-out',
                                        transitionDelay: `${featuresBaseDelay + (index * featureStagger)}ms`,
                                    }}
                                >
                                    {/* Inner frame - horizontal flex */}
                                    <div
                                        className="flex items-center"
                                        style={{ gap: '12px' }}
                                    >
                                        {/* Icon */}
                                        <div className="flex items-center justify-center">
                                            {feature.icon}
                                        </div>
                                        {/* Text */}
                                        <div className="flex flex-col">
                                            <span
                                                style={{
                                                    fontFamily: 'var(--font-inter)',
                                                    fontSize: '17px',
                                                    fontWeight: 600,
                                                    lineHeight: '135%',
                                                    letterSpacing: '-0.02em',
                                                    color: 'var(--base-700)',
                                                }}
                                            >
                                                {feature.title}
                                            </span>
                                            <span
                                                className="hidden md:block" // Hide description on mobile
                                                style={{
                                                    fontFamily: 'var(--font-inter)',
                                                    fontSize: '15px',
                                                    fontWeight: 400,
                                                    lineHeight: '140%',
                                                    letterSpacing: '-0.01em',
                                                    color: 'var(--base-400)',
                                                }}
                                            >
                                                {feature.description}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Demo Frame with animation */}
                        <div
                            className="relative overflow-hidden"
                            style={{
                                width: '100%',
                                maxWidth: '920px',
                                height: '560px',
                                borderRadius: '40px 40px 0px 0px',
                                transform: isVisible ? 'translateY(0)' : 'translateY(40px)',
                                opacity: isVisible ? 1 : 0,
                                transition: 'transform 600ms ease-out, opacity 500ms ease-out',
                                transitionDelay: `${demoDelay}ms`,
                                perspective: '1000px',
                            }}
                        >
                            {/* Gradient Background */}
                            <div
                                className="absolute left-1/2 -translate-x-1/2"
                                style={{
                                    width: '1100px',
                                    height: '657px',
                                    top: '0px',
                                    background: 'linear-gradient(180deg, #6E9CFD 0%, #C1E6FF 100%)',
                                    borderRadius: '40px 40px 0px 0px',
                                }}
                            />

                            {/* Phone Frame with scroll-linked 3D animation */}
                            <div
                                className="absolute left-1/2 -translate-x-1/2 will-change-transform w-[280px] md:w-[343px]"
                                style={{
                                    top: `${131 + (1 - phoneEntryProgress) * 150}px`,
                                    height: '681px',
                                    backgroundColor: '#F8FAFC',
                                    borderRadius: '40px',
                                    border: '4px solid var(--primary-600)',
                                    boxShadow: '0px 25px 60px rgba(0, 0, 0, 0.2)',
                                    transform: `
                                        rotateX(${(1 - phoneEntryProgress) * 35}deg)
                                        scale(${(0.7 + phoneEntryProgress * 0.3) * mobileScale})
                                    `,
                                    transformOrigin: 'center bottom',
                                    opacity: 0.5 + phoneEntryProgress * 0.5,
                                    overflow: 'hidden',
                                }}
                            >
                                {/* Dynamic Island */}
                                <div
                                    className="absolute left-1/2 -translate-x-1/2"
                                    style={{
                                        top: '16px',
                                        width: '100px',
                                        height: '28px',
                                        backgroundColor: 'var(--base-700)',
                                        borderRadius: '20px',
                                        zIndex: 10,
                                    }}
                                />

                                {/* Phone Content Area - with swipe wrapper */}
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '60px',
                                        left: '16px',
                                        right: '16px',
                                        bottom: '16px',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {/* Current Question Card - swipes left in stage 7 */}
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '16px',
                                            fontFamily: 'var(--font-inter)',
                                            transform: stage === 7 ? `translateY(${-swipeProgress * 120}%)` : 'translateY(0)',
                                            opacity: stage === 7 ? 1 - swipeProgress * 0.5 : 1,
                                            transition: 'none',
                                        }}
                                    >
                                        {/* Stage 1: Loading Shimmer */}
                                        {stage === 1 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px 0' }}>
                                                {/* Shimmer lines */}
                                                {[1, 2, 3].map((i) => (
                                                    <div
                                                        key={i}
                                                        style={{
                                                            height: i === 1 ? '20px' : '60px',
                                                            borderRadius: '8px',
                                                            background: 'linear-gradient(90deg, #E2E8F0 25%, #F1F5F9 50%, #E2E8F0 75%)',
                                                            backgroundSize: '200% 100%',
                                                            animation: 'shimmer 1.5s infinite',
                                                            width: i === 1 ? '60%' : '100%',
                                                            margin: i === 1 ? '0 auto' : '0',
                                                        }}
                                                    />
                                                ))}
                                                <style>{`
                                                    @keyframes shimmer {
                                                        0% { background-position: 200% 0; }
                                                        100% { background-position: -200% 0; }
                                                    }
                                                `}</style>
                                            </div>
                                        )}

                                        {/* Stage 2+: Question Header */}
                                        {stage >= 2 && (
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    paddingTop: '8px',
                                                    opacity: questionProgress,
                                                    transform: `translateY(${(1 - questionProgress) * 20}px)`,
                                                }}
                                            >
                                                {/* Meta info */}
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[12px] md:text-[11px] font-medium text-slate-500 whitespace-nowrap">
                                                        Science · Carbon & Compounds
                                                    </span>
                                                    <span style={{
                                                        fontSize: '10px',
                                                        color: '#22C55E',
                                                        backgroundColor: '#F0FDF4',
                                                        padding: '2px 6px',
                                                        borderRadius: '8px',
                                                        fontWeight: 600
                                                    }}>
                                                        Easy
                                                    </span>
                                                </div>
                                                {/* Question */}
                                                <h3 style={{
                                                    fontSize: '17px',
                                                    fontWeight: 600,
                                                    color: '#1E293B',
                                                    lineHeight: '1.4',
                                                    textAlign: 'center',
                                                    margin: 0,
                                                }}>
                                                    A molecule of ammonia (NH₃) has
                                                </h3>
                                            </div>
                                        )}

                                        {/* Stage 3+: Options Grid */}
                                        {stage >= 3 && (
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 1fr',
                                                gap: '8px',
                                                padding: '0 4px',
                                            }}>
                                                {options.map((option, index) => {
                                                    const optionProgressMap = [option1Progress, option2Progress, option3Progress, option4Progress];
                                                    const thisProgress = optionProgressMap[index];

                                                    // Determine option state
                                                    const isSelected = index === 0 && stage >= 4;
                                                    const isCorrect = option.correct && stage >= 5;

                                                    let bgColor = 'white';
                                                    let borderColor = '#E2E8F0';
                                                    let textColor = '#475569';

                                                    if (isSelected && stage === 4) {
                                                        bgColor = '#3B82F6';
                                                        borderColor = '#3B82F6';
                                                        textColor = 'white';
                                                    } else if (isCorrect) {
                                                        bgColor = '#22C55E';
                                                        borderColor = '#22C55E';
                                                        textColor = 'white';
                                                    }

                                                    return (
                                                        <div
                                                            key={index}
                                                            style={{
                                                                backgroundColor: bgColor,
                                                                borderRadius: '10px',
                                                                padding: '24px 12px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                border: `1px solid ${borderColor}`,
                                                                textAlign: 'center',
                                                                opacity: thisProgress,
                                                                transform: `translateY(${(1 - thisProgress) * 15}px)`,
                                                                transition: 'background-color 0.3s, border-color 0.3s',
                                                                position: 'relative',
                                                            }}
                                                        >
                                                            <span style={{
                                                                fontSize: '13px',
                                                                fontWeight: 500,
                                                                color: textColor,
                                                                transition: 'color 0.3s',
                                                            }}>
                                                                {option.text}
                                                            </span>
                                                            {/* Checkmark for correct answer */}
                                                            {isCorrect && (
                                                                <div
                                                                    style={{
                                                                        position: 'absolute',
                                                                        top: '6px',
                                                                        right: '6px',
                                                                        width: '16px',
                                                                        height: '16px',
                                                                        borderRadius: '50%',
                                                                        backgroundColor: 'white',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        opacity: correctProgress,
                                                                        transform: `scale(${correctProgress})`,
                                                                    }}
                                                                >
                                                                    <Check size={10} color="#22C55E" strokeWidth={3} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Stage 4: Selection indicator (tap ripple effect) */}
                                        {stage === 4 && selectionProgress > 0 && selectionProgress < 1 && (
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    top: '140px',
                                                    left: '80px',
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '50%',
                                                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                                                    transform: `scale(${selectionProgress * 2})`,
                                                    opacity: 1 - selectionProgress,
                                                    pointerEvents: 'none',
                                                }}
                                            />
                                        )}

                                        {/* Stage 6: Explanation Card */}
                                        {stage >= 6 && stage < 7 && (
                                            <div
                                                style={{
                                                    backgroundColor: 'white',
                                                    borderRadius: '12px',
                                                    padding: '14px',
                                                    border: '1px solid #E2E8F0',
                                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                                                    opacity: explanationProgress,
                                                    transform: `translateY(${(1 - explanationProgress) * 20}px)`,
                                                }}
                                            >
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    marginBottom: '8px',
                                                }}>
                                                    <div style={{
                                                        width: '18px',
                                                        height: '18px',
                                                        borderRadius: '50%',
                                                        backgroundColor: '#F0FDF4',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                    }}>
                                                        <Check size={10} color="#22C55E" strokeWidth={3} />
                                                    </div>
                                                    <span style={{
                                                        fontSize: '11px',
                                                        fontWeight: 600,
                                                        color: '#22C55E',
                                                    }}>
                                                        Correct!
                                                    </span>
                                                </div>
                                                <p style={{
                                                    fontSize: '11px',
                                                    color: '#64748B',
                                                    lineHeight: '1.5',
                                                    margin: 0,
                                                }}>
                                                    The nitrogen atom shares one pair of electrons with each hydrogen atom, forming three single covalent bonds.
                                                </p>
                                            </div>
                                        )}

                                        {/* Stage 5: Success particles/confetti */}
                                        {stage >= 5 && correctProgress > 0 && correctProgress < 1 && (
                                            <>
                                                {[...Array(6)].map((_, i) => (
                                                    <div
                                                        key={i}
                                                        style={{
                                                            position: 'absolute',
                                                            top: '130px',
                                                            left: '80px',
                                                            width: '6px',
                                                            height: '6px',
                                                            borderRadius: '50%',
                                                            backgroundColor: ['#22C55E', '#3B82F6', '#F59E0B', '#EC4899'][i % 4],
                                                            opacity: Math.max(0, 1 - correctProgress * 1.5),
                                                            transform: `translate(${Math.cos(i * 60 * Math.PI / 180) * correctProgress * 50}px, ${Math.sin(i * 60 * Math.PI / 180) * correctProgress * 50 - correctProgress * 30}px)`,
                                                            pointerEvents: 'none',
                                                        }}
                                                    />
                                                ))}
                                            </>
                                        )}
                                    </div>

                                    {/* Next Question Card - slides in from right in stage 7 */}
                                    {stage === 7 && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '16px',
                                                fontFamily: 'var(--font-inter)',
                                                transform: `translateY(${(1 - swipeProgress) * 120}%)`,
                                                opacity: 0.5 + swipeProgress * 0.5,
                                            }}
                                        >
                                            {/* Question Header */}
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    paddingTop: '8px',
                                                }}
                                            >
                                                {/* Meta info */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>
                                                        {nextQuestion.subject}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '9px',
                                                        color: nextQuestion.difficultyColor,
                                                        backgroundColor: nextQuestion.difficultyBg,
                                                        padding: '2px 6px',
                                                        borderRadius: '8px',
                                                        fontWeight: 600
                                                    }}>
                                                        {nextQuestion.difficulty}
                                                    </span>
                                                </div>
                                                {/* Question */}
                                                <h3 style={{
                                                    fontSize: '16px',
                                                    fontWeight: 600,
                                                    color: '#1E293B',
                                                    lineHeight: '1.4',
                                                    textAlign: 'center',
                                                    margin: 0,
                                                }}>
                                                    {nextQuestion.text}
                                                </h3>
                                            </div>

                                            {/* Options Grid */}
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 1fr',
                                                gap: '8px',
                                                padding: '0 4px',
                                            }}>
                                                {nextQuestion.options.map((optionText, index) => (
                                                    <div
                                                        key={index}
                                                        style={{
                                                            backgroundColor: 'white',
                                                            borderRadius: '10px',
                                                            padding: '24px 12px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            border: '1px solid #E2E8F0',
                                                            textAlign: 'center',
                                                        }}
                                                    >
                                                        <span style={{
                                                            fontSize: '12px',
                                                            fontWeight: 500,
                                                            color: '#475569',
                                                        }}>
                                                            {optionText}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default StudyFeed;
