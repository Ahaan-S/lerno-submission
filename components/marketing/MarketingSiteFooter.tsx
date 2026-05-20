import Link from "next/link";

const EXPLORE = [
  { href: "/blog", label: "Blog" },
  { href: "/updates", label: "Updates" },
  { href: "/ncert/class-10/science", label: "NCERT chapters" },
] as const;

const LEGAL = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/disclaimer", label: "AI disclaimer" },
] as const;

const STRIP = [
  { href: "/", label: "Home" },
  { href: "/blog", label: "Blog" },
  { href: "/updates", label: "Updates" },
  { href: "/ncert/class-10/science", label: "NCERT" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/disclaimer", label: "Disclaimer" },
] as const;

/** Section label — muted, smaller than links (Cursor-style hierarchy on phones). */
const sectionLabelClass =
  "mb-2 pl-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--base-400)] sm:mb-1.5 sm:pl-3 sm:text-[11px] sm:tracking-[0.16em]";

/** Column links: compact on phone; `sm+` matches desktop footer scale. */
const columnLinkClass =
  "inline-flex min-h-[32px] w-full max-w-none items-center rounded-sm py-0.5 pl-0 pr-1 text-[12px] font-medium leading-snug text-[var(--base-700)] transition-colors duration-200 hover:text-[var(--primary-600)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-400)] sm:min-h-[40px] sm:max-w-[280px] sm:pl-3 sm:pr-2 sm:py-1 sm:text-[15px] sm:text-[var(--base-600)] lg:max-w-none";

/** Bottom strip: no pill fill on hover. */
const stripLinkClass =
  "inline-flex min-h-[34px] items-center rounded-sm px-1.5 py-1 text-xs font-medium leading-snug text-[var(--base-600)] transition-colors duration-200 hover:text-[var(--primary-600)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-400)] sm:min-h-[40px] sm:px-2 sm:py-2 sm:text-[13px] sm:leading-none";

type MarketingSiteFooterProps = {
  /** Home CTA band: let parent gradient show through (marketing pages stay solid). */
  variant?: "default" | "onGradient";
};

/**
 * Shared footer body for marketing home + StaticShell pages (blog, updates, legal, NCERT).
 * Spacing and colours follow `app/globals.css` Lerno tokens (`--base-*`, `--primary-*`, `--radius`).
 */
export default function MarketingSiteFooter({ variant = "default" }: MarketingSiteFooterProps) {
  const year = new Date().getFullYear();
  const surface = variant === "onGradient" ? "bg-transparent" : "bg-[var(--base-100)]";

  return (
    <div className={`marketing-site-footer w-full ${surface}`}>
      <div
        className="mx-auto w-full max-w-[72rem] px-4 pb-5 pt-10 sm:px-6 sm:pb-6 sm:pt-14 md:px-8 md:pb-8 md:pt-16 lg:px-12 lg:pt-20 xl:px-14"
        style={{ fontFamily: "var(--font-inter)" }}
      >
        <div className="grid grid-cols-1 gap-8 sm:gap-12 lg:grid-cols-12 lg:gap-x-0 lg:gap-y-0">
          {/* Brand */}
          <div className="flex flex-col lg:col-span-5 lg:pr-8 xl:pr-12">
            <p
              className="mb-1.5 text-xl font-semibold tracking-tight text-[var(--base-800)] sm:mb-3 sm:text-[1.65rem] lg:mb-3"
              style={{ fontFamily: "var(--font-crimson-pro)" }}
            >
              Lerno
            </p>
            <p className="m-0 max-w-[36ch] text-sm leading-relaxed text-[var(--base-500)] sm:text-[15px] sm:leading-[1.65]">
              NCERT-first AI tutoring and practice for CBSE students — grounded in your textbook, built for real exam prep.
            </p>
          </div>

          {/* Explore + Legal: two columns on phone (Cursor-style), 7-col split on `lg` with brand */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-0 border-t border-[var(--base-200)] pt-8 sm:gap-x-10 sm:border-t-0 sm:pt-0 lg:col-span-7 lg:grid-cols-7 lg:gap-0 lg:border-t-0 lg:pt-0">
            <nav
              aria-label="Explore Lerno"
              className="flex min-w-0 flex-col border-r border-[var(--base-200)] pr-3 sm:pr-8 lg:col-span-3 lg:border-l lg:border-[var(--base-200)] lg:px-10 xl:px-12"
            >
              <h2 className={sectionLabelClass} style={{ fontFamily: "var(--font-inter)" }}>
                Explore
              </h2>
              <ul className="m-0 flex list-none flex-col gap-y-0 p-0 sm:gap-y-0">
                {EXPLORE.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={columnLinkClass}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav
              aria-label="Legal and policies"
              className="flex min-w-0 flex-col pl-1 sm:pl-0 lg:col-span-4 lg:border-l lg:border-[var(--base-200)] lg:pl-10 lg:pr-0 xl:pl-12"
            >
              <h2 className={sectionLabelClass} style={{ fontFamily: "var(--font-inter)" }}>
                Legal
              </h2>
              <ul className="m-0 flex list-none flex-col gap-y-0 p-0 sm:gap-y-0">
                {LEGAL.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={columnLinkClass}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>

      {/* Bottom bar — same surface as page, hairline only */}
      <div className={`border-t border-[var(--base-200)] ${surface}`}>
        <div className="mx-auto flex w-full max-w-[72rem] flex-col gap-4 px-4 py-5 sm:gap-5 sm:px-6 sm:py-7 md:flex-row md:items-center md:justify-between md:gap-6 md:px-8 lg:px-12 xl:px-14">
          <p
            className="m-0 shrink-0 text-center text-xs leading-relaxed text-[var(--base-500)] sm:text-[13px] md:text-left"
            style={{ fontFamily: "var(--font-inter)" }}
          >
            © {year} Lerno. All rights reserved.
          </p>
          <nav aria-label="Site policies and pages" className="min-w-0">
            <ul
              className="m-0 flex list-none flex-wrap items-center justify-center gap-x-0 gap-y-1 p-0 sm:justify-end sm:gap-y-2"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              {STRIP.map((item, i) => (
                <li key={item.href} className="flex items-center">
                  {i > 0 ? (
                    <span
                      className="mx-1.5 hidden h-3 w-px shrink-0 bg-[var(--base-300)] sm:mx-2 sm:block"
                      aria-hidden="true"
                    />
                  ) : null}
                  <Link href={item.href} className={stripLinkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}
