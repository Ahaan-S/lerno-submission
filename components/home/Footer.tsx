"use client";

import React, { useState } from "react";
import Link from "next/link";
import MarketingSiteFooter from "@/components/marketing/MarketingSiteFooter";
import { track } from "@/lib/analytics";

const Footer = () => {
  const [isButtonHovered, setIsButtonHovered] = useState(false);

  return (
    <section className="mt-10 w-full md:mt-12" aria-label="Get started with Lerno">
      <div className="flex w-full flex-col bg-gradient-to-b from-white from-0% via-[#F6F9FF] via-[42%] to-[#E7F0FF] to-100% px-6 pt-40 md:pt-44">
        <div className="flex w-full flex-col items-center pb-20 md:pb-24">
          <div className="flex w-full max-w-4xl flex-col items-center gap-10 text-center md:gap-14">
          <div className="flex flex-col items-center gap-4 md:gap-6">
            <div className="flex flex-col items-center">
              <h2
                className="text-5xl md:text-6xl lg:text-[72px]"
                style={{
                  fontFamily: "var(--font-crimson-pro)",
                  fontWeight: 700,
                  lineHeight: "105%",
                  letterSpacing: "-0.02em",
                  color: "var(--base-400)",
                  margin: 0,
                }}
              >
                Start learning smarter
              </h2>
              <h2
                className="text-5xl md:text-6xl lg:text-[72px]"
                style={{
                  fontFamily: "var(--font-crimson-pro)",
                  fontWeight: 700,
                  lineHeight: "105%",
                  letterSpacing: "-0.02em",
                  color: "var(--primary-600)",
                  margin: 0,
                }}
              >
                Completely free
              </h2>
            </div>

            <p
              className="text-base-400 px-4 text-lg md:text-xl"
              style={{
                fontFamily: "var(--font-inter)",
                fontWeight: 400,
                lineHeight: "150%",
                letterSpacing: "-0.02em",
              }}
            >
              No credit card. No limits.
              <br className="block md:hidden" /> Lerno is free for every CBSE student.
            </p>
          </div>

          <Link
            href={process.env.NODE_ENV === "development" ? "http://app.localhost:3000/auth" : "https://app.lerno.in/auth"}
            className="cta-shimmer flex min-h-[48px] items-center justify-center rounded-full px-9 py-3.5 text-lg font-semibold text-white transition-all duration-400 ease-out hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary-400)]"
            onClick={() => track("marketing_cta_clicked", { cta_label: "Start learning smarter", location: "footer" })}
            onMouseEnter={() => setIsButtonHovered(true)}
            onMouseLeave={() => setIsButtonHovered(false)}
            style={{
              position: "relative",
              cursor: "pointer",
              backgroundColor: isButtonHovered ? "#013b6a" : "var(--primary-600)",
              fontFamily: "var(--font-inter)",
              border: "none",
              boxShadow: `
                            0px 10px 20px rgba(0, 0, 0, 0.2), 
                            inset 0px 3px 5px rgba(255, 255, 255, 0.3)
                        `,
              transition: "transform 400ms ease, background-color 400ms ease, box-shadow 200ms ease",
            }}
          >
            Start Learning
          </Link>
          </div>
        </div>

        <div className="w-full border-t border-[var(--base-200)]/70">
          <MarketingSiteFooter variant="onGradient" />
        </div>
      </div>
    </section>
  );
};

export default Footer;
