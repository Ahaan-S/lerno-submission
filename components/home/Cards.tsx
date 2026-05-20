"use client";

import React, { useState, useEffect, useRef } from "react";
import StudyPlannerMockup from "./cards/StudyPlannerMockup";
import TodaysFocusMockup from "./cards/TodaysFocusMockup";
import StudyFeedMockup from "./cards/StudyFeedMockup";
import AITutorMockup from "./cards/AITutorMockup";
import AnalyticsMockup from "./cards/AnalyticsMockup";
import StudyMaterialMockup from "./cards/StudyMaterialMockup";

// Blue card styles with inner shadows
const blueCardStyle = {
    background: `
        radial-gradient(ellipse at bottom left, #3C83F6 0%, #749CFF 70%),
        radial-gradient(ellipse at top right, rgba(255, 255, 255, 0.06) 0%, transparent 50%)
    `,
    boxShadow: `
        inset 1.9px 1.77px 8.17px rgba(255, 255, 255, 0.13),
        inset 1.01px 0.94px 4.09px rgba(255, 255, 255, 0.13)
    `,
};

// Grey card styles
const greyCardStyle = {
    background: `radial-gradient(ellipse at center, rgba(221, 226, 238, 0.4) 58%, rgba(187, 197, 221, 0.4) 100%)`,
    border: '1px solid var(--base-200)',
};

// Typography styles
const labelTextStyle = {
    fontFamily: 'var(--font-inter)',
    fontSize: '16px',
    fontWeight: 600,
    lineHeight: '135%',
    letterSpacing: '-0.02em',
    color: 'var(--base-100)',
};

const titleTextBlueStyle = {
    fontFamily: 'var(--font-inter)',
    fontSize: '28px',
    fontWeight: 500,
    lineHeight: '135%',
    letterSpacing: '-0.02em',
    color: 'var(--base-100)',
};

const labelTextGreyStyle = {
    fontFamily: 'var(--font-inter)',
    fontSize: '16px',
    fontWeight: 600,
    lineHeight: '135%',
    letterSpacing: '-0.02em',
    color: 'var(--base-400)',
};

const titleTextGreyStyle = {
    fontFamily: 'var(--font-inter)',
    fontSize: '28px',
    fontWeight: 500,
    lineHeight: '135%',
    letterSpacing: '-0.02em',
    color: 'var(--base-600)',
};

const Cards = () => {
    const [row1Visible, setRow1Visible] = useState(false);
    const [row2Visible, setRow2Visible] = useState(false);
    const [row3Visible, setRow3Visible] = useState(false);

    // Animation stages for Row 1 - combined into single stage number
    const [animationStage, setAnimationStage] = useState(0);
    // Stages: 0=hidden, 1=todaysFocus, 2-5=tasks, 6=checked, 7=studyPlanner, 8=studyFeed, 9=studyFeedAnswer

    const row1Ref = useRef<HTMLDivElement>(null);
    const row2Ref = useRef<HTMLDivElement>(null);
    const row3Ref = useRef<HTMLDivElement>(null);

    // Single combined observer for all rows
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const target = entry.target;
                        if (target === row1Ref.current) setRow1Visible(true);
                        else if (target === row2Ref.current) setRow2Visible(true);
                        else if (target === row3Ref.current) setRow3Visible(true);
                    }
                });
            },
            { threshold: 0.2 }
        );

        if (row1Ref.current) observer.observe(row1Ref.current);
        if (row2Ref.current) observer.observe(row2Ref.current);
        if (row3Ref.current) observer.observe(row3Ref.current);

        return () => observer.disconnect();
    }, []);

    // Sequenced animation for Row 1 - fewer state updates
    useEffect(() => {
        if (!row1Visible) return;

        const stages = [
            { delay: 0, stage: 1 },      // TodaysFocus appears
            { delay: 250, stage: 2 },    // Task 1
            { delay: 400, stage: 3 },    // Task 2
            { delay: 550, stage: 4 },    // Task 3
            { delay: 1000, stage: 5 },   // Task 1 checked
            { delay: 1400, stage: 6 },   // StudyPlanner slides in
            { delay: 1800, stage: 7 },   // StudyFeed appears
            { delay: 2400, stage: 8 },   // Answer selected
        ];

        const timers = stages.map(({ delay, stage }) =>
            setTimeout(() => setAnimationStage(stage), delay)
        );

        return () => timers.forEach(clearTimeout);
    }, [row1Visible]);

    // Derive individual visibility states from animationStage
    const todaysFocusStage = Math.min(animationStage, 5);
    const studyPlannerVisible = animationStage >= 6;
    const studyFeedStage = animationStage >= 8 ? 2 : animationStage >= 7 ? 1 : 0;

    // Animation styles for mockups
    const getMockupStyle = (isVisible: boolean, delay: number, direction: 'left' | 'right' | 'bottom' = 'bottom') => {
        const transforms = {
            left: 'translateX(-40px)',
            right: 'translateX(40px)',
            bottom: 'translateY(40px)',
        };
        return {
            transform: isVisible ? 'translate(0, 0)' : transforms[direction],
            opacity: isVisible ? 1 : 0,
            transition: `transform 700ms ease-out, opacity 600ms ease-out`,
            transitionDelay: `${delay}ms`,
        };
    };

    return (
        <section id="cards-section" className="relative flex flex-col items-center w-full bg-white mt-32 md:mt-44 pb-20 scroll-mt-32">
            {/* Main Frame - responsive container */}
            <div className="flex flex-col items-center w-full max-w-7xl px-6 md:px-8 gap-8 md:gap-12">

                {/* Section Header */}
                <div className="flex flex-col items-center text-center gap-4 mb-2">
                    <h2
                        className="text-[32px] md:text-5xl lg:text-[48px]"
                        style={{
                            fontFamily: 'var(--font-inter)',
                            fontWeight: 600,
                            lineHeight: '120%',
                        }}
                    >
                        <span style={{ color: 'var(--base-600)' }}>What we</span>
                        <span style={{ color: 'var(--base-400)' }}> offer</span>
                    </h2>
                    <p
                        className="text-[18px] md:text-xl lg:text-[22px] mt-2 md:mt-4"
                        style={{
                            fontFamily: 'var(--font-inter)',
                            fontWeight: 400,
                            lineHeight: '135%',
                            letterSpacing: '-0.02em',
                            color: 'var(--base-400)',
                            transition: 'transform 600ms ease-out, opacity 500ms ease-out',
                        }}
                    >
                        Powerful features to supercharge your learning.
                    </p>
                </div>

                {/* Row 1: Study Planner + Study Feed */}
                <div
                    ref={row1Ref}
                    className="flex flex-col md:flex-row md:overflow-x-auto md:snap-x lg:overflow-visible lg:flex-row justify-start lg:justify-center items-center md:items-stretch gap-6 md:gap-14 lg:gap-11 w-full pb-0 md:pb-1 lg:pb-0 px-0 md:px-4 lg:px-0 no-scrollbar"
                >
                    {/* Study Planner Card - Blue */}
                    <div
                        className="flex-shrink-0 flex flex-col justify-end w-full md:w-[560px] lg:w-full max-w-[560px] h-[500px] md:h-[560px] rounded-[32px] md:rounded-[45px] overflow-hidden relative snap-center"
                        style={{ ...blueCardStyle, padding: 0 }}
                    >
                        {/* Study Planner Mockups - overlapping with fade */}
                        <div
                            style={{
                                flex: 1,
                                position: 'relative',
                                overflow: 'hidden',
                                maskImage: 'linear-gradient(190deg, black 0%, black 55%, transparent 100%)',
                                WebkitMaskImage: 'linear-gradient(190deg, black 0%, black 55%, transparent 100%)',
                            }}
                        >
                            {/* Left mockup - centered vertically */}
                            <div className="absolute top-1/2 left-16 md:left-[95px] z-[2] scale-[0.85] sm:scale-90 origin-left"
                                style={{
                                    opacity: studyPlannerVisible ? 1 : 0,
                                    transition: 'transform 700ms ease-out, opacity 600ms ease-out',
                                    transform: studyPlannerVisible ? 'translateY(-50%)' : 'translateY(-50%) translateX(-40px)',
                                }}>
                                <StudyPlannerMockup />
                            </div>
                            {/* Right mockup - bigger */}
                            <div className="absolute top-[-50px] sm:top-[-60px] md:top-[-55px] right-[-20px] sm:right-[-40px] md:right-[-40px] z-[1] scale-[0.85] sm:scale-90 origin-top-right">
                                <TodaysFocusMockup animationStage={todaysFocusStage} />
                            </div>
                        </div>

                        {/* Text Frame - bottom aligned */}
                        <div className="flex flex-col p-6 md:p-10 gap-3">
                            <div className="glass-label w-fit">
                                <span style={labelTextStyle}>Study Planner</span>
                            </div>
                            <h3 style={titleTextBlueStyle} className="text-2xl md:text-[28px]">
                                Plan your studies, automatically.
                            </h3>
                        </div>
                    </div>

                    {/* Study Feed Card - Grey */}
                    <div
                        className="flex-shrink-0 flex flex-col w-full md:w-[560px] lg:w-full max-w-[560px] h-[500px] md:h-[560px] rounded-[32px] md:rounded-[45px] overflow-hidden relative snap-center"
                        style={{ ...greyCardStyle, padding: 0 }}
                    >
                        {/* Text Frame - top aligned */}
                        <div className="flex flex-col p-6 md:p-10 gap-3">
                            <div className="glass-label w-fit">
                                <span style={labelTextGreyStyle}>Study Feed</span>
                            </div>
                            <h3 style={titleTextGreyStyle} className="text-2xl md:text-[28px]">
                                Adaptive questions, nonstop.
                            </h3>
                        </div>

                        {/* Study Feed Mockup */}
                        <div className="absolute bottom-[-10%] sm:bottom-[-5px] right-[-15%] sm:right-[-5px] scale-[0.75] sm:scale-100 md:scale-100 md:origin-bottom-right lg:scale-90">
                            <StudyFeedMockup animationStage={studyFeedStage} />
                        </div>
                    </div>
                </div>

                {/* Row 2: AI Tutor + AI Analytics */}
                <div
                    ref={row2Ref}
                    className="flex flex-col md:flex-row md:overflow-x-auto md:snap-x lg:overflow-visible lg:flex-row justify-start lg:justify-center items-center md:items-stretch gap-6 md:gap-14 lg:gap-11 w-full pb-0 md:pb-1 lg:pb-0 px-0 md:px-4 lg:px-0 no-scrollbar"
                >
                    {/* AI Tutor Card - Grey */}
                    <div
                        className="flex-shrink-0 flex flex-col w-full md:w-[560px] lg:w-full max-w-[560px] h-[500px] md:h-[560px] rounded-[32px] md:rounded-[45px] overflow-hidden relative snap-center"
                        style={{ ...greyCardStyle, padding: 0 }}
                    >
                        {/* Text Frame - top aligned */}
                        <div className="flex flex-col p-6 md:p-10 gap-3">
                            <div className="glass-label w-fit">
                                <span style={labelTextGreyStyle}>AI Tutor</span>
                            </div>
                            <h3 style={titleTextGreyStyle} className="text-2xl md:text-[28px]">
                                Stuck? Not anymore.
                            </h3>
                        </div>

                        {/* AI Tutor Mockup */}
                        <div className="absolute bottom-[-30px] left-[-30px] scale-[0.85] sm:scale-100 origin-bottom-left">
                            <AITutorMockup isVisible={row2Visible} />
                        </div>
                    </div>

                    {/* AI Analytics Card - Blue */}
                    <div
                        className="flex-shrink-0 flex flex-col justify-end w-full md:w-[560px] lg:w-full max-w-[560px] h-[500px] md:h-[560px] rounded-[32px] md:rounded-[45px] overflow-hidden relative snap-center"
                        style={{ ...blueCardStyle, padding: 0 }}
                    >
                        {/* Analytics Mockup */}
                        <div
                            style={{
                                flex: 1,
                                position: 'relative',
                                overflow: 'hidden',
                                maskImage: 'linear-gradient(190deg, black 0%, black 55%, transparent 100%)',
                                WebkitMaskImage: 'linear-gradient(190deg, black 0%, black 55%, transparent 100%)',
                            }}
                        >
                            <div className="absolute top-[-10px] left-[-10px] z-[2] scale-[0.85] sm:scale-90 origin-top-left">
                                <AnalyticsMockup isVisible={row2Visible} />
                            </div>
                        </div>

                        {/* Text Frame - bottom aligned */}
                        <div className="flex flex-col p-6 md:p-10 gap-3">
                            <div className="glass-label w-fit">
                                <span style={labelTextStyle}>AI Analytics</span>
                            </div>
                            <h3 style={titleTextBlueStyle} className="text-2xl md:text-[28px]">
                                Insights that matter.
                            </h3>
                        </div>
                    </div>
                </div>

                {/* Row 3: Study Material - Grey */}
                <div
                    ref={row3Ref}
                    className="flex flex-col items-center w-full max-w-[1170px] h-[500px] md:h-[560px] rounded-[32px] md:rounded-[45px] overflow-hidden relative p-8 md:p-11"
                    style={{ ...greyCardStyle }}
                >
                    {/* Label */}
                    <div className="glass-label mb-3 shrink-0">
                        <span style={labelTextGreyStyle}>Study Material</span>
                    </div>

                    {/* Title */}
                    <h3 style={titleTextGreyStyle} className="mb-9 shrink-0 text-2xl md:text-[28px]">
                        Everything you need.
                    </h3>

                    {/* Study Material Mockup */}
                    <div>
                        <StudyMaterialMockup isVisible={row3Visible} />
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Cards;
