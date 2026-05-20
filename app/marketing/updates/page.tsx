import type { Metadata } from "next";
import Link from "next/link";
import StaticShell from "@/components/marketing/StaticShell";
import { UPDATE_POSTS } from "@/content/updates";

export const metadata: Metadata = {
  title: "What's New — Lerno Updates",
  description:
    "Product updates and release notes from the Lerno team — full write-ups for each ship.",
  alternates: { canonical: "https://lerno.in/updates" },
  openGraph: {
    title: "What's New — Lerno Updates",
    description: "Product updates and release notes from the Lerno team.",
    url: "https://lerno.in/updates",
    siteName: "Lerno",
    locale: "en_IN",
    type: "website",
  },
};

const TAG_STYLES: Record<string, { bg: string; color: string }> = {
  Feature: { bg: "#eff6ff", color: "#1d4ed8" },
  Improvement: { bg: "#f0fdf4", color: "#15803d" },
  Fix: { bg: "#fffbeb", color: "#b45309" },
  Content: { bg: "#f5f3ff", color: "#6d28d9" },
  Infrastructure: { bg: "var(--base-200)", color: "var(--base-400)" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function UpdatesPage() {
  const sorted = [...UPDATE_POSTS].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return (
    <StaticShell>
      <div
        className="w-full mx-auto px-6"
        style={{ maxWidth: "740px", paddingTop: "160px", paddingBottom: "120px" }}
      >
        <header style={{ marginBottom: "72px" }}>
          <p
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--base-400)",
              marginBottom: "20px",
            }}
          >
            Updates
          </p>
          <h1
            style={{
              fontFamily: "var(--font-crimson-pro)",
              fontSize: "clamp(40px, 7vw, 60px)",
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: "var(--base-800)",
              marginBottom: "20px",
            }}
          >
            What&apos;s new
          </h1>
          <p
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "16px",
              lineHeight: 1.6,
              color: "var(--base-500)",
              maxWidth: "480px",
            }}
          >
            Release notes as full posts — what shipped, how it works, and what is next.
          </p>
        </header>

        <div>
          {sorted.map((post, i) => {
            const tagStyle = TAG_STYLES[post.tags[0]] ?? { bg: "var(--base-200)", color: "var(--base-400)" };
            return (
              <Link
                key={post.slug}
                href={`/updates/${post.slug}`}
                style={{
                  display: "block",
                  padding: "28px 0",
                  borderBottom: i < sorted.length - 1 ? "1px solid var(--base-200)" : "none",
                  textDecoration: "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-inter)",
                      fontSize: "11px",
                      fontWeight: 500,
                      padding: "2px 8px",
                      borderRadius: "999px",
                      background: tagStyle.bg,
                      color: tagStyle.color,
                    }}
                  >
                    {post.tags[0]}
                  </span>
                  <span style={{ fontFamily: "var(--font-inter)", fontSize: "12px", color: "var(--base-400)" }}>
                    {post.readingTimeMin} min read
                  </span>
                </div>

                <h2
                  style={{
                    fontFamily: "var(--font-crimson-pro)",
                    fontSize: "clamp(22px, 3vw, 26px)",
                    fontWeight: 600,
                    lineHeight: 1.25,
                    color: "var(--base-800)",
                    marginBottom: "8px",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {post.title}
                </h2>

                <p
                  style={{
                    fontFamily: "var(--font-inter)",
                    fontSize: "14px",
                    lineHeight: 1.65,
                    color: "var(--base-500)",
                    marginBottom: "12px",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {post.description}
                </p>

                <time
                  dateTime={post.publishedAt}
                  style={{ fontFamily: "var(--font-inter)", fontSize: "12px", color: "var(--base-400)" }}
                >
                  {formatDate(post.publishedAt)}
                </time>
              </Link>
            );
          })}
        </div>

        <div
          style={{
            marginTop: "72px",
            paddingTop: "32px",
            borderTop: "1px solid var(--base-200)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <p style={{ fontFamily: "var(--font-inter)", fontSize: "13px", color: "var(--base-400)" }}>
            Have feedback or a feature request?
          </p>
          <a
            href="mailto:help@lerno.in"
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--base-800)",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            Write to us
          </a>
        </div>

        <div style={{ marginTop: "24px", textAlign: "center" }}>
          <Link
            href="/blog"
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "13px",
              color: "var(--base-400)",
            }}
          >
            Read the blog →
          </Link>
        </div>
      </div>
    </StaticShell>
  );
}
