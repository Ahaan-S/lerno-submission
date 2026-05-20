import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import StaticShell from "@/components/marketing/StaticShell";
import { NCERT_CONFIGS, getNcertConfig } from "@/lib/seo/ncert-data";

interface Props {
  params: Promise<{ grade: string; subject: string }>;
}

export async function generateStaticParams() {
  return NCERT_CONFIGS.map((c) => ({ grade: c.gradeSlug, subject: c.subjectSlug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { grade, subject } = await params;
  const config = getNcertConfig(grade, subject);
  if (!config) return { title: "Not Found" };

  const title = `NCERT ${config.gradeLabel} ${config.subjectLabel} — AI Tutor | Lerno`;
  const description = `Study all ${config.chapters.length} chapters of NCERT ${config.gradeLabel} ${config.subjectLabel} with Lerno's free AI tutor. Instant explanations grounded in your NCERT textbook.`;
  const canonical = `https://lerno.in/ncert/${config.gradeSlug}/${config.subjectSlug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, siteName: "Lerno", locale: "en_IN", type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function NcertSubjectPage({ params }: Props) {
  const { grade, subject } = await params;
  const config = getNcertConfig(grade, subject);
  if (!config) notFound();

  const canonical = `https://lerno.in/ncert/${config.gradeSlug}/${config.subjectSlug}`;

  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://lerno.in" },
      { "@type": "ListItem", position: 2, name: `NCERT ${config.gradeLabel}`, item: `https://lerno.in/ncert/${config.gradeSlug}` },
      { "@type": "ListItem", position: 3, name: config.subjectLabel, item: canonical },
    ],
  };

  const jsonLdItemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `NCERT ${config.gradeLabel} ${config.subjectLabel} Chapters`,
    numberOfItems: config.chapters.length,
    itemListElement: config.chapters.map((name, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `Chapter ${i + 1} — ${name}`,
      url: `${canonical}/chapter-${i + 1}`,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdItemList) }} />

      <StaticShell>
        <div
          className="w-full mx-auto px-6"
          style={{ maxWidth: "960px", paddingTop: "160px", paddingBottom: "120px" }}
        >
          {/* Breadcrumb */}
          <nav
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              marginBottom: "48px",
              fontFamily: "var(--font-inter)", fontSize: "13px", color: "var(--base-400)",
            }}
            aria-label="Breadcrumb"
          >
            <Link href="/" style={{ color: "var(--base-400)" }}>Home</Link>
            <span>/</span>
            <span>NCERT {config.gradeLabel}</span>
            <span>/</span>
            <span style={{ color: "var(--base-500)" }}>{config.subjectLabel}</span>
          </nav>

          {/* Page header */}
          <header style={{ marginBottom: "72px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
              {[`NCERT ${config.gradeLabel}`, "CBSE", `${config.chapters.length} chapters`].map((label) => (
                <span
                  key={label}
                  style={{
                    fontFamily: "var(--font-inter)",
                    fontSize: "11px",
                    fontWeight: 500,
                    padding: "3px 10px",
                    borderRadius: "999px",
                    background: "var(--base-200)",
                    color: "var(--base-500)",
                  }}
                >
                  {label}
                </span>
              ))}
            </div>

            <h1
              style={{
                fontFamily: "var(--font-crimson-pro)",
                fontSize: "clamp(40px, 7vw, 64px)",
                fontWeight: 600,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: "var(--base-800)",
                marginBottom: config.bookTitle ? "12px" : "20px",
              }}
            >
              NCERT {config.gradeLabel} {config.subjectLabel}
            </h1>

            {config.bookTitle && (
              <p style={{ fontFamily: "var(--font-inter)", fontSize: "14px", color: "var(--base-400)", fontStyle: "italic", marginBottom: "20px" }}>
                {config.bookTitle}
              </p>
            )}

            <p style={{ fontFamily: "var(--font-inter)", fontSize: "16px", lineHeight: 1.65, color: "var(--base-500)", maxWidth: "540px", marginBottom: "32px" }}>
              Study all {config.chapters.length} chapters with Lerno&apos;s free AI tutor — instant explanations,
              practice questions, and guided sessions, every answer grounded in your NCERT textbook.
            </p>

            <a
              href={`https://app.lerno.in`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                borderRadius: "10px",
                background: "var(--base-800)",
                color: "#ffffff",
                fontFamily: "var(--font-inter)",
                fontSize: "14px",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Start learning on Lerno
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2.5 7h9M8 3.5L11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </header>

          {/* Chapter grid */}
          <section>
            <p
              style={{
                fontFamily: "var(--font-inter)",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--base-400)",
                marginBottom: "20px",
              }}
            >
              All chapters
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "10px",
              }}
            >
              {config.chapters.map((name, i) => (
                <Link
                  key={i}
                  href={`/ncert/${config.gradeSlug}/${config.subjectSlug}/chapter-${i + 1}`}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "14px",
                    padding: "16px 18px",
                    borderRadius: "10px",
                    background: "#ffffff",
                    border: "1px solid var(--base-200)",
                    textDecoration: "none",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-inter)",
                      fontSize: "11px",
                      fontWeight: 500,
                      color: "var(--base-300)",
                      paddingTop: "2px",
                      width: "22px",
                      flexShrink: 0,
                      textAlign: "right",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-inter)",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "var(--base-800)",
                      lineHeight: 1.45,
                      flex: 1,
                    }}
                  >
                    {name}
                  </span>
                  <svg
                    style={{ flexShrink: 0, marginTop: "2px", color: "var(--base-300)" }}
                    width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true"
                  >
                    <path d="M5 3.5L8.5 7 5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              ))}
            </div>
          </section>

          {/* Bottom CTA */}
          <div
            style={{
              marginTop: "72px",
              padding: "40px",
              borderRadius: "16px",
              background: "var(--base-800)",
              textAlign: "center",
            }}
          >
            <p style={{ fontFamily: "var(--font-crimson-pro)", fontSize: "26px", fontWeight: 600, color: "#ffffff", marginBottom: "8px", lineHeight: 1.2 }}>
              Need help with a specific chapter?
            </p>
            <p style={{ fontFamily: "var(--font-inter)", fontSize: "14px", color: "var(--base-300)", marginBottom: "28px", lineHeight: 1.6 }}>
              Ask Lerno&apos;s AI tutor anything — it knows every page of your NCERT textbook.
            </p>
            <a
              href="https://app.lerno.in"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                borderRadius: "10px",
                background: "#ffffff",
                color: "var(--base-800)",
                fontFamily: "var(--font-inter)",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Try Lerno free
            </a>
          </div>
        </div>
      </StaticShell>
    </>
  );
}
