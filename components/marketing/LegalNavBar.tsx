"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState, useEffect } from "react";

/** Cross-link (Blog ↔ Updates): text-only, matches simple marketing nav affordance. */
const crossLinkClass =
  "inline-flex min-h-[44px] items-center rounded-sm px-2 text-sm font-semibold text-[var(--base-700)] transition-colors hover:text-[var(--primary-600)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-500)]";

const appAuthHref =
  process.env.NODE_ENV === "development" ? "http://app.localhost:3000/auth" : "https://app.lerno.in/auth";

const LegalNavBar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname() ?? "";

  const isBlogSection = pathname === "/blog" || pathname.startsWith("/blog/");
  const isUpdatesSection = pathname === "/updates" || pathname.startsWith("/updates/");
  const crossNav =
    isBlogSection && !isUpdatesSection
      ? { href: "/updates" as const, label: "Updates" as const }
      : isUpdatesSection && !isBlogSection
        ? { href: "/blog" as const, label: "Blog" as const }
        : null;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      aria-label="Lerno marketing"
      className={`
                fixed z-50 flex items-center justify-between gap-3 transition-all duration-300 ease-in-out left-1/2 -translate-x-1/2
                ${isScrolled
                  ? "top-5 w-[92%] max-w-[1200px] rounded-full border border-white/10 bg-white/10 px-5 py-2.5 shadow-lg backdrop-blur-[30px]"
                  : "top-0 w-full min-h-[4.5rem] bg-transparent px-5 py-3 md:min-h-[5rem] md:px-10 lg:px-[110px]"}
            `}
    >
      <div className="flex min-w-0 shrink-0 items-center">
        <Link
          href="/"
          className="flex shrink-0 items-center rounded-lg p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-500)]"
        >
          <div
            className={`relative shrink-0 transition-[width,height] duration-300 ease-in-out ${
              isScrolled ? "h-9 w-[calc(147px*36/40)]" : "h-10 w-[100px] md:w-[147px]"
            }`}
          >
            <Image
              src="/lerno.webp"
              alt="Lerno — home"
              fill
              className="object-contain object-left"
              sizes={isScrolled ? "(max-width: 768px) 132px, 132px" : "(max-width: 768px) 100px, 147px"}
              priority
            />
          </div>
        </Link>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
        {crossNav ? (
          <Link href={crossNav.href} className={crossLinkClass} style={{ fontFamily: "var(--font-inter)" }}>
            {crossNav.label}
          </Link>
        ) : null}
        <Link
          href={appAuthHref}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full bg-[#013b6a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#002a4e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-400)] sm:px-5"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          Start Learning
        </Link>
      </div>
    </nav>
  );
};

export default LegalNavBar;
