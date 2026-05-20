"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Module-level singleton — lets any component fire the bar imperatively.
let _imperativeStart: (() => void) | null = null;

/** Call this on any navigation button click to fire the top loader instantly. */
export function startTopLoader() {
  _imperativeStart?.();
}

// Minimal type shim for the Navigation API (not yet in lib.dom.d.ts everywhere)
interface NavigateEvent extends Event {
  canIntercept: boolean;
  hashChange: boolean;
  downloadRequest: string | null;
  destination: { url: string };
}

interface NavigationEventTarget {
  addEventListener(type: "navigate", listener: (e: NavigateEvent) => void): void;
  removeEventListener(type: "navigate", listener: (e: NavigateEvent) => void): void;
}

declare global {
  interface Window {
    navigation?: NavigationEventTarget;
  }
}

function sameDocumentUrlChange(url: string): boolean {
  try {
    const next = new URL(url, location.href);
    if (next.origin !== location.origin) return false;
    // Only trigger on actual pathname changes — search/hash-only mutations
    // (like stripping ?question= after a deep-link loads) are NOT page
    // navigations and must not start the progress bar (it would never finish).
    return next.pathname !== location.pathname;
  } catch {
    return false;
  }
}

function shouldKickHistoryUrl(url?: string | URL | null): boolean {
  if (url == null || url === "") return false;
  return sameDocumentUrlChange(String(url));
}

export default function TopLoader() {
  const pathname = usePathname();
  const prevPath = useRef(pathname);
  const barRef   = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kickCoalesceRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const start = useCallback(() => {
    const el = barRef.current;
    if (!el) return;
    clearTimers();
    // Reset to 0 with no transition
    el.style.transition = "none";
    el.style.opacity    = "1";
    el.style.width      = "0%";
    // Force a synchronous layout flush so the browser commits width=0 before
    // we start the transition — no RAF needed, no extra frame of delay.
    void el.offsetWidth;
    // Phase 1: fast burst to 40%
    el.style.transition = "width 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
    el.style.width      = "40%";
    // Phase 2: slow crawl to 85%
    timerRef.current = setTimeout(() => {
      if (!barRef.current) return;
      barRef.current.style.transition = "width 6s cubic-bezier(0.1, 0.05, 0, 1)";
      barRef.current.style.width      = "85%";
      timerRef.current = null;
    }, 220);
  }, [clearTimers]);

  const finish = useCallback(() => {
    const el = barRef.current;
    if (!el) return;
    clearTimers();
    el.style.transition = "width 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
    el.style.width      = "100%";
    timerRef.current = setTimeout(() => {
      if (!barRef.current) return;
      barRef.current.style.transition = "opacity 0.4s ease";
      barRef.current.style.opacity    = "0";
      timerRef.current = setTimeout(() => {
        if (!barRef.current) return;
        barRef.current.style.transition = "none";
        barRef.current.style.width      = "0%";
      }, 420);
    }, 310);
  }, [clearTimers]);

  /** Same-document nav often fires navigate + pushState in one turn — one kick. */
  const scheduleNavigationKick = useCallback(() => {
    if (kickCoalesceRef.current) return;
    kickCoalesceRef.current = true;
    start();
    queueMicrotask(() => {
      kickCoalesceRef.current = false;
    });
  }, [start]);

  // Register the imperative handle so startTopLoader() works globally.
  useEffect(() => {
    _imperativeStart = start;
    return () => { _imperativeStart = null; };
  }, [start]);

  // Detect navigation completion via pathname change
  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname;
      finish();
    }
  }, [pathname, finish]);

  useEffect(() => {
    // ── Navigation API (Chromium): fires early for many navigations.
    // Do NOT require `canIntercept` — we only show UI; many same-document
    // App Router navigations set canIntercept to false and would otherwise
    // show no bar. Still ignore pure hash changes and downloads.
    const handleNavigate = (e: NavigateEvent) => {
      if (e.hashChange || e.downloadRequest !== null) return;
      try {
        if (!sameDocumentUrlChange(e.destination.url)) return;
        scheduleNavigationKick();
      } catch { /* malformed URL — ignore */ }
    };

    // ── History + clicks: required on all browsers. On Chromium this must run
    // *alongside* navigate — previously we returned early and never patched
    // pushState, so router.push / Link missed the bar when navigate didn't fire
    // or was gated on canIntercept.
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = function (
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ) {
      if (shouldKickHistoryUrl(url)) scheduleNavigationKick();
      return origPush(data, unused, url);
    };
    history.replaceState = function (
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ) {
      if (shouldKickHistoryUrl(url)) scheduleNavigationKick();
      return origReplace(data, unused, url);
    };

    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest("a") as HTMLAnchorElement | null;
      if (!anchor?.href) return;
      try {
        const url = new URL(anchor.href, location.href);
        if (url.origin !== location.origin) return;
        if (anchor.target === "_blank") return;
        if (url.pathname === location.pathname && url.search === location.search) return;
        scheduleNavigationKick();
      } catch { /* malformed href — ignore */ }
    };

    const nav = typeof window !== "undefined" ? window.navigation : undefined;
    nav?.addEventListener("navigate", handleNavigate);
    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", scheduleNavigationKick);

    return () => {
      nav?.removeEventListener("navigate", handleNavigate);
      history.pushState = origPush;
      history.replaceState = origReplace;
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", scheduleNavigationKick);
    };
  }, [scheduleNavigationKick]);

  return (
    <div
      aria-hidden="true"
      style={{
        position:      "fixed",
        top:           0,
        left:          0,
        right:         0,
        height:        "3px",
        zIndex:        99999,
        pointerEvents: "none",
      }}
    >
      <div
        ref={barRef}
        style={{
          height:       "100%",
          width:        "0%",
          opacity:      0,
          background:   "#008eed",
          borderRadius: "0 2px 2px 0",
        }}
      />
    </div>
  );
}
