"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useState, useEffect, useCallback } from "react";
import { track } from "@/lib/analytics";
import { useMarketingCta } from "./useMarketingCta";

type NavItem =
  | { type: "anchor"; name: string; href: string }
  | { type: "route"; name: string; href: string };

const NAV_ITEMS: NavItem[] = [
  { type: "anchor", name: "Features", href: "/#features" },
  { type: "route", name: "Blog", href: "/blog" },
  { type: "route", name: "Updates", href: "/updates" },
];

const NavBar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [isFooter, setIsFooter] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const cta = useMarketingCta();

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      setIsScrolled(scrollY > 20);
      setIsDark(scrollY > 470);
      setIsFooter(windowHeight + scrollY >= documentHeight - 600);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  useEffect(() => {
    if (!isMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isMenuOpen, closeMenu]);

  const toggleMenu = () => setIsMenuOpen((o) => !o);

  const handleScrollClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const targetId = href.replace("/#", "");
    const targetElement = document.getElementById(targetId);

    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth" });
      setIsMenuOpen(false);
      window.history.pushState(null, "", href);
    }
  };

  const showAlternateLayout = isDark && !isFooter;

  const linkTone = (isCompact: boolean) =>
    `${isCompact ? "text-sm" : "text-base"} font-semibold transition-colors cursor-pointer whitespace-nowrap min-h-[44px] inline-flex items-center rounded-lg px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/90 ${
      isDark ? "text-slate-700 hover:text-primary-600" : "text-white hover:text-primary-100"
    }`;

  const renderNavItem = (item: NavItem, isCompact: boolean) => {
    const cls = linkTone(isCompact);
    if (item.type === "route") {
      return (
        <Link key={item.href} href={item.href} className={cls} style={{ fontFamily: "var(--font-inter)", lineHeight: "135%", letterSpacing: "-0.02em" }} onClick={closeMenu}>
          {item.name}
        </Link>
      );
    }
    return (
      <a
        key={item.href}
        href={item.href}
        onClick={(e) => handleScrollClick(e, item.href)}
        className={cls}
        style={{ fontFamily: "var(--font-inter)", lineHeight: "135%", letterSpacing: "-0.02em" }}
      >
        {item.name}
      </a>
    );
  };

  return (
    <nav
      aria-label="Lerno home"
      className={`
                fixed z-50 transition-all duration-300 ease-in-out flex items-center justify-between left-1/2 -translate-x-1/2
                ${isScrolled ? "top-5 px-8 py-2.5 rounded-full bg-white/10 backdrop-blur-[30px] border border-white/10 shadow-lg w-[90%] max-w-[1200px]" : "top-0 px-6 py-4 md:px-12 lg:px-[110px] md:h-20 w-full bg-transparent"}
            `}
    >
      <div className="flex items-center">
        <Link href="/" className="flex items-center rounded-lg p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80" aria-label="Lerno home">
          <div
            className={`relative shrink-0 transition-[width,height] duration-300 ease-in-out ${
              isScrolled ? "h-9 w-[calc(147px*36/40)]" : "h-10 w-[100px] md:w-[147px]"
            }`}
          >
            <Image
              src={isDark ? "/lerno.webp" : "/lerno-dark.webp"}
              alt=""
              fill
              className="object-contain object-left"
              sizes={isScrolled ? "(max-width: 768px) 132px, 132px" : "(max-width: 768px) 100px, 147px"}
              priority
            />
          </div>
        </Link>
      </div>

      <div className="hidden md:flex items-center justify-end relative h-10 min-w-[200px]">
        <div
          className={`
                        flex items-center gap-3 md:gap-4 absolute right-0 transition-all duration-500 ease-in-out
                        ${!showAlternateLayout ? "opacity-100 translate-y-0 relative pointer-events-auto" : "opacity-0 -translate-y-4 pointer-events-none absolute"}
                    `}
        >
          {NAV_ITEMS.map((item) => renderNavItem(item, isScrolled))}
        </div>

        <div
          className={`
                        flex items-center gap-3 md:gap-4 absolute right-0 transition-all duration-500 ease-in-out
                        ${showAlternateLayout ? "opacity-100 translate-y-0 relative pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none absolute"}
                    `}
        >
          <button
            type="button"
            onClick={toggleMenu}
            className="p-2 text-slate-800 transition-all duration-200 outline-none cursor-pointer hover:bg-slate-100 active:scale-95 rounded-full focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            aria-expanded={isMenuOpen}
            aria-controls="home-nav-desktop-panel"
            aria-haspopup="true"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          >
            {isMenuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>

          {isMenuOpen && (
            <div
              id="home-nav-desktop-panel"
              role="menu"
              className="absolute top-[calc(100%+12px)] right-0 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-200 origin-top-right ring-1 ring-black/5"
            >
              {NAV_ITEMS.map((item) =>
                item.type === "route" ? (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    className="text-[15px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl px-4 py-2.5 transition-all text-left min-h-[44px] flex items-center"
                    onClick={closeMenu}
                  >
                    {item.name}
                  </Link>
                ) : (
                  <a
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={(e) => handleScrollClick(e, item.href)}
                    className="text-[15px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl px-4 py-2.5 transition-all text-left min-h-[44px] flex items-center"
                  >
                    {item.name}
                  </a>
                )
              )}
            </div>
          )}

          <Link
            href={cta.href}
            className="hidden md:inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full bg-[#013b6a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#002a4e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-400)] sm:px-5"
            style={{ fontFamily: "var(--font-inter)" }}
            onClick={() => track("marketing_cta_clicked", { cta_label: cta.trackingLabel, location: "navbar" })}
          >
            {cta.label}
          </Link>
        </div>
      </div>

      <div className="md:hidden ml-4 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleMenu}
          className={`p-2 transition-all duration-200 outline-none cursor-pointer active:scale-95 rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500 ${
            isDark ? "text-slate-800 hover:bg-slate-100" : "text-white hover:bg-white/10"
          }`}
          aria-expanded={isMenuOpen}
          aria-controls="home-nav-mobile-panel"
          aria-haspopup="true"
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMenuOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {isMenuOpen && (
        <div
          id="home-nav-mobile-panel"
          role="menu"
          className="absolute top-full left-4 right-4 z-50 mt-2 flex flex-col gap-1 rounded-xl border border-gray-100 bg-white p-2 shadow-lg md:hidden"
        >
          {NAV_ITEMS.map((item) =>
            item.type === "route" ? (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                className="block min-h-[44px] rounded-lg px-4 py-3 text-base font-medium text-gray-800 hover:bg-slate-50"
                onClick={closeMenu}
              >
                {item.name}
              </Link>
            ) : (
              <a
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={(e) => handleScrollClick(e, item.href)}
                className="block min-h-[44px] rounded-lg px-4 py-3 text-base font-medium text-gray-800 hover:bg-slate-50"
              >
                {item.name}
              </a>
            )
          )}
        </div>
      )}
    </nav>
  );
};

export default NavBar;
