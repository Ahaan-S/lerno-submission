import type { Metadata } from "next";
import Link from "next/link";
import StaticShell from "@/components/marketing/StaticShell";
import { BLOG_POSTS } from "@/content/blog";

export const metadata: Metadata = {
  title: "Blog — Lerno",
  description:
    "Study tips, product guides, and CBSE exam advice from the Lerno team.",
  alternates: { canonical: "https://lerno.in/blog" },
  openGraph: {
    title: "Blog — Lerno",
    description: "Study tips, product guides, and CBSE exam advice from the Lerno team.",
    url: "https://lerno.in/blog",
    siteName: "Lerno",
    locale: "en_IN",
    type: "website",
  },
};

const TAG_STYLES: Record<string, { bg: string; color: string }> = {
  Product:      { bg: "#eff6ff", color: "#1d4ed8" },
  "Study Tips": { bg: "#f0fdf4", color: "#15803d" },
  Guide:        { bg: "#f5f3ff", color: "#6d28d9" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });
}

export default function BlogIndexPage() {
  const sorted = [...BLOG_POSTS].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return (
    <StaticShell>
      <div
        className="w-full mx-auto px-6"
        style={{ maxWidth: "740px", paddingTop: "160px", paddingBottom: "120px" }}
      >
        {/* Page header */}
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
            Blog
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
            Guides &amp; updates
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
            Study tips, product guides, and CBSE exam advice from the Lerno team.
          </p>
        </header>

        {/* Post list */}
        <div>
          {sorted.map((post, i) => {
            const tagStyle = TAG_STYLES[post.tags[0]] ?? { bg: "var(--base-200)", color: "var(--base-400)" };
            return (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                style={{
                  display: "block",
                  padding: "28px 0",
                  borderBottom: i < sorted.length - 1 ? "1px solid var(--base-200)" : "none",
                  textDecoration: "none",
                }}
              >
                {/* Meta row */}
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

                {/* Title */}
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

                {/* Excerpt */}
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

                {/* Date */}
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

        {/* Updates link */}
        <div style={{ marginTop: "48px", textAlign: "center" }}>
          <Link
            href="/updates"
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "13px",
              color: "var(--base-400)",
            }}
          >
            See product changelog →
          </Link>
        </div>
      </div>
    </StaticShell>
  );
}
