"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";

const Benefits = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [cardsVisible, setCardsVisible] = useState(false);
    const sectionRef = useRef<HTMLElement>(null);
    const cardsRef = useRef<HTMLDivElement>(null);

    // Intersection Observer for heading
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

        if (sectionRef.current) {
            observer.observe(sectionRef.current);
        }

        return () => observer.disconnect();
    }, []);

    // Separate observer for cards (triggers when panda area is visible)
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setCardsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.2 }
        );

        if (cardsRef.current) {
            observer.observe(cardsRef.current);
        }

        return () => observer.disconnect();
    }, []);

    const benefits = [
        {
            image: "/panda-learn.webp",
            imageWidth: 217,
            imageHeight: 194,
            title: "Learns how you learn",
            description: "Adapts to your pace, mistakes, and learning style."
        },
        {
            image: "/panda-understand.webp",
            imageWidth: 200,
            imageHeight: 201,
            title: "Faster understanding",
            description: "Clear explanations that save you hours of struggle."
        },
        {
            image: "/panda-study.webp",
            imageWidth: 212,
            imageHeight: 194,
            title: "Stress-free studying",
            description: "Ask anything, anytime. Get crisp answers instantly."
        }
    ];

    // Animation delays
    const titleDelay = 0;
    const subtitleDelay = 150;
    const cardStagger = 200;

    return (
        <section
            ref={sectionRef}
            className="relative flex flex-col items-center w-full bg-white mt-32 md:mt-44"
        >
            {/* Main Frame - responsive */}
            <div className="flex flex-col items-center w-full max-w-7xl px-4 md:px-6 gap-12 md:gap-[50px]">
                {/* Heading Frame */}
                <div className="flex flex-col items-center text-center max-w-[90%] md:max-w-2xl">
                    <h2
                        className="text-[32px] md:text-5xl lg:text-[48px]"
                        style={{
                            fontFamily: 'var(--font-inter)',
                            fontWeight: 600,
                            lineHeight: '135%',
                            transform: isVisible ? 'translateY(0)' : 'translateY(25px)',
                            opacity: isVisible ? 1 : 0,
                            transition: 'transform 600ms ease-out, opacity 500ms ease-out',
                            transitionDelay: `${titleDelay}ms`,
                        }}
                    >
                        <span style={{ color: 'var(--base-400)' }}>Learn</span>{' '}
                        <span style={{ color: 'var(--base-600)' }}>faster</span>{' '}
                        <span style={{ color: 'var(--base-400)' }}>and</span>{' '}
                        <span style={{ color: 'var(--base-600)' }}>smarter</span>{' '}
                    </h2>
                    <p
                        className="text-[18px] md:text-xl lg:text-[22px] mt-2 md:mt-4"
                        style={{
                            fontFamily: 'var(--font-inter)',
                            fontWeight: 400,
                            lineHeight: '135%',
                            letterSpacing: '-0.02em',
                            color: 'var(--base-400)',
                            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                            opacity: isVisible ? 1 : 0,
                            transition: 'transform 600ms ease-out, opacity 500ms ease-out',
                            transitionDelay: `${subtitleDelay}ms`,
                        }}
                    >
                        Designed to help you learn better, not harder
                    </p>
                </div>

                {/* Cards Frame */}
                <div
                    ref={cardsRef}
                    className="flex flex-col lg:flex-row gap-6 items-center w-full justify-center"
                >
                    {benefits.map((benefit, index) => (
                        <div
                            key={index}
                            className={`flex flex-col items-center w-full max-w-[380px] p-6 md:p-8 gap-6 rounded-3xl border-base-200 transition-all duration-500
                                ${index % 2 === 0
                                    ? 'md:self-start md:ml-12 lg:self-auto lg:ml-0'
                                    : 'md:self-end md:mr-12 lg:self-auto lg:mr-0'
                                }
                            `}
                            style={{
                                transform: cardsVisible ? 'translateY(0)' : 'translateY(40px)',
                                opacity: cardsVisible ? 1 : 0,
                                transition: 'transform 700ms ease-out, opacity 600ms ease-out',
                                transitionDelay: `${index * cardStagger}ms`,
                            }}
                        >
                            {/* Panda Image with hover animation */}
                            <div
                                className="flex items-center justify-center relative"
                                style={{
                                    width: '100%',
                                    height: benefit.imageHeight,
                                    transition: 'transform 300ms ease-out',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'scale(1.05) translateY(-5px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'scale(1) translateY(0)';
                                }}
                            >
                                <div className="relative w-full h-full max-w-[220px]">
                                    <Image
                                        src={benefit.image}
                                        alt={benefit.title}
                                        fill
                                        className="object-contain"
                                        sizes="(max-width: 1024px) 50vw, 220px"
                                    />
                                </div>
                            </div>

                            {/* Text Frame */}
                            <div className="flex flex-col gap-2 md:gap-3 w-full">
                                {/* Title */}
                                <h3
                                    className="text-2xl md:text-[28px]"
                                    style={{
                                        fontFamily: 'var(--font-inter)',
                                        fontWeight: 600,
                                        lineHeight: '120%',
                                        color: 'var(--base-700)',
                                    }}
                                >
                                    {benefit.title}
                                </h3>

                                {/* Description */}
                                <p
                                    className="text-base md:text-[18px]"
                                    style={{
                                        fontFamily: 'var(--font-inter)',
                                        fontWeight: 400,
                                        lineHeight: '150%',
                                        color: 'var(--base-400)',
                                    }}
                                >
                                    {benefit.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Benefits;
