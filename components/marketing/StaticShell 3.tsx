import type { ReactNode } from "react";
import LegalNavBar from "./LegalNavBar";
import StaticFooter from "./StaticFooter";

/** Shared shell for all static/content pages: blog, updates, NCERT, legal. */
export default function StaticShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--base-100)" }}
    >
      <a
        href="#main-content"
        className="sr-only left-4 top-4 z-[100] rounded-lg bg-[var(--primary-600)] px-4 py-2 text-sm font-semibold text-white shadow-lg focus:not-sr-only focus:absolute focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-white"
      >
        Skip to main content
      </a>
      <LegalNavBar />
      <main id="main-content" className="flex-1 outline-none" tabIndex={-1}>
        {children}
      </main>
      <StaticFooter />
    </div>
  );
}
