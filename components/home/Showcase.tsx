"use client";

import React, { useState, useEffect, useRef } from "react";

const features = [
    {
        category: "Learn",
        heading: "Your tutor walks you through every chapter",
        body: "Pick a subject and chapter. Lerno teaches it to you topic by topic — step by step, at your pace, sourced from NCERT.",
        mediaLeft: false,
        videoSrc: "/demos/learn-demo.mp4",
    },
    {
        category: "Study Feed",
        heading: "Practice that knows what you need",
        body: "Adaptive questions from your syllabus — ranked by weak areas, difficulty, and what you last studied. Answer, get graded, build your streak.",
        mediaLeft: true,
        videoSrc: "/demos/study-feed-demo.mp4",
    },
    {
        category: "Ask",
        heading: "Any question. Instant answer.",
        body: "Type whatever's on your mind. Lerno pulls the exact answer from your textbook — no off-syllabus noise.",
        mediaLeft: false,
        videoSrc: "/demos/ask-demo.mp4",
    },
];

function VideoPlaceholder() {
    return (
        <div
            style={{
                width: "100%",
                aspectRatio: "16 / 9",
                borderRadius: "16px",
                background:
                    "linear-gradient(148deg, #3B6EF5 0%, #6A9FFF 38%, #97C3FF 64%, #BDD8FF 84%, #D8EEFF 100%)",
                position: "relative",
                overflow: "hidden",
            }}
        >
            <div style={{
                position: "absolute", top: "-20%", left: "-10%",
                width: "65%", height: "65%",
                background: "radial-gradient(ellipse, rgba(255,255,255,0.24) 0%, transparent 70%)",
                pointerEvents: "none",
            }} />
            <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: "40%",
                background: "linear-gradient(to top, rgba(40,88,220,0.22) 0%, transparent 100%)",
                pointerEvents: "none",
            }} />
            <div style={{
                position: "absolute", inset: 0,
                backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
                pointerEvents: "none",
            }} />
        </div>
    );
}

function FeatureVideo({ src }: { src: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [posterSrc, setPosterSrc] = useState<string | null>(null);
    const [isInView, setIsInView] = useState(false);

    useEffect(() => {
        const node = containerRef.current;
        if (!node) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsInView(entry.isIntersecting && entry.intersectionRatio >= 0.35);
            },
            { threshold: [0, 0.35, 0.6, 1] }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        if (isInView) {
            video.play().catch(() => {});
            return;
        }
        video.pause();
    }, [isInView]);

    const handleLoadedData = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setPosterSrc(canvas.toDataURL("image/jpeg", 0.82));
    };

    return (
        <div
            ref={containerRef}
            style={{
                width: "100%",
                aspectRatio: "16 / 9",
                borderRadius: "16px",
                position: "relative",
                overflow: "hidden",
                backgroundColor: "#DCEBFF",
                boxShadow: "0px 23px 56px -6px rgba(0, 0, 0, 0.18)",
            }}
        >
            {posterSrc && (
                <img
                    src={posterSrc}
                    aria-hidden
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                        zIndex: 0,
                    }}
                />
            )}
            <video
                ref={videoRef}
                src={src}
                muted
                loop
                playsInline
                preload="auto"
                onLoadedData={handleLoadedData}
                style={{
                    position: "relative",
                    zIndex: 1,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                }}
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
    );
}

type Feature = (typeof features)[number];

function FeatureRow({ feature }: { feature: Feature }) {
    const [visible, setVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const obs = new IntersectionObserver(
            ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
            { threshold: 0.08 }
        );
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, []);

    // On desktop: text slides from its side, video from the opposite side
    const textSlide = feature.mediaLeft ? "32px" : "-32px";
    const mediaSlide = feature.mediaLeft ? "-32px" : "32px";

    const anim = (dx: string, delay = 0): React.CSSProperties => ({
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : `translateX(${dx})`,
        transition: `opacity 700ms ease-out ${delay}ms, transform 700ms ease-out ${delay}ms`,
    });

    // Grid placement for desktop
    // When mediaLeft=false: text col = col 1, video col = col 2
    // When mediaLeft=true:  media col = col 1, text col = col 2
    const textCol = feature.mediaLeft ? "lg:col-start-2" : "lg:col-start-1";
    const mediaCol = feature.mediaLeft ? "lg:col-start-1" : "lg:col-start-2";
    const cols = feature.mediaLeft
        ? "lg:grid-cols-[62fr_34fr]"
        : "lg:grid-cols-[34fr_62fr]";

    return (
        <div
            ref={ref}
            // Mobile: flex-col (DOM order = heading → video → body)
            // Desktop: 2-col grid, video spans 2 rows on its side
            className={`flex flex-col gap-5 lg:grid lg:gap-x-14 lg:gap-y-5 lg:items-start ${cols}`}
        >
            {/* 1 — Category + Heading (mobile: top, desktop: text col row 1) */}
            <div
                style={anim(textSlide, 0)}
                className={`flex flex-col gap-3 ${textCol} lg:row-start-1 lg:self-end`}
            >
                <span style={{
                    fontFamily: "var(--font-inter)",
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--primary-600)",
                }}>
                    {feature.category}
                </span>
                <h3
                    className="text-[22px] sm:text-[24px] lg:text-[27px]"
                    style={{
                        fontFamily: "var(--font-inter)",
                        fontWeight: 600,
                        lineHeight: "122%",
                        letterSpacing: "-0.025em",
                        color: "var(--base-700)",
                        margin: 0,
                    }}
                >
                    {feature.heading}
                </h3>
            </div>

            {/* 2 — Video (mobile: middle, desktop: media col spans both rows) */}
            <div
                style={anim(mediaSlide, 60)}
                className={`${mediaCol} lg:row-start-1 lg:row-span-2`}
            >
                {feature.videoSrc ? <FeatureVideo src={feature.videoSrc} /> : <VideoPlaceholder />}
            </div>

            {/* 3 — Body (mobile: bottom, desktop: text col row 2) */}
            <p
                style={{
                    ...anim(textSlide, 120),
                    fontFamily: "var(--font-inter)",
                    fontSize: "13px",
                    fontWeight: 400,
                    lineHeight: "168%",
                    color: "var(--base-400)",
                    margin: 0,
                }}
                className={`${textCol} lg:row-start-2 lg:self-start`}
            >
                {feature.body}
            </p>
        </div>
    );
}

export default function Showcase() {
    return (
        <section
            className="w-full flex flex-col items-center px-5 sm:px-10 lg:px-16"
            style={{ paddingTop: "40px", paddingBottom: "80px" }}
        >
            <div
                className="w-full flex flex-col"
                style={{ maxWidth: "1200px", gap: "100px" }}
            >
                {features.map((feature, i) => (
                    <React.Fragment key={i}>
                        {i > 0 && (
                            <div style={{
                                width: '100%',
                                height: '1px',
                                backgroundColor: '#E8EDF2',
                                marginTop: '-30px',
                            }} />
                        )}
                        <FeatureRow feature={feature} />
                    </React.Fragment>
                ))}
            </div>
        </section>
    );
}
