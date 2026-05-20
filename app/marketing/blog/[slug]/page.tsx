import type { Metadata } from "next";
import type { Components } from "react-markdown";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import StaticShell from "@/components/marketing/StaticShell";
import BlogToC from "@/components/marketing/BlogToC";
import { BLOG_POSTS, getBlogPost } from "@/content/blog";
import { extractHeadings, slugify } from "@/lib/seo/blog-utils";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return { title: "Not Found" };

  const canonical = `https://lerno.in/blog/${post.slug}`;
  return {
    title: `${post.title} | Lerno Blog`,
    description: post.description,
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description: post.description,
      url: canonical,
      siteName: "Lerno",
      locale: "en_IN",
      type: "article",
      publishedTime: post.publishedAt,
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.description },
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });
}

const TAG_STYLES: Record<string, { bg: string; color: string }> = {
  Product:      { bg: "#eff6ff", color: "#1d4ed8" },
  "Study Tips": { bg: "#f0fdf4", color: "#15803d" },
  Guide:        { bg: "#f5f3ff", color: "#6d28d9" },
};

/** ReactMarkdown custom components that stamp heading IDs for the ToC. */
const markdownComponents: Components = {
  h2: ({ children }) => {
    const text = String(children ?? "");
    return <h2 id={slugify(text)}>{children}</h2>;
  },
  h3: ({ children }) => {
    const text = String(children ?? "");
    return <h3 id={slugify(text)}>{children}</h3>;
  },
};

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const headings = extractHeadings(post.content);
  const canonical = `https://lerno.in/blog/${post.slug}`;
  const tagStyle = TAG_STYLES[post.tags[0]] ?? { bg: "var(--base-200)", color: "var(--base-400)" };

  const jsonLdArticle = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    author: { "@type": "Organization", name: "Lerno", url: "https://lerno.in" },
    publisher: { "@type": "Organization", name: "Lerno", url: "https://lerno.in" },
    url: canonical,
    inLanguage: "en-IN",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdArticle) }}
      />
      <StaticShell>

        {/* ── Narrow header ───────────────────────────────────────────────── */}
        <div
          style={{
            maxWidth: "700px",
            margin: "0 auto",
            padding: "160px 24px 0",
          }}
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
            <Link href="/blog" style={{ color: "var(--base-400)" }}>Blog</Link>
            <span>/</span>
            <span style={{ color: "var(--base-500)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {post.title}
            </span>
          </nav>

          {/* Article header */}
          <header style={{ paddingBottom: "40px", borderBottom: "1px solid var(--base-200)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <span
                style={{
                  fontFamily: "var(--font-inter)", fontSize: "11px", fontWeight: 500,
                  padding: "2px 8px", borderRadius: "999px",
                  background: tagStyle.bg, color: tagStyle.color,
                }}
              >
                {post.tags[0]}
              </span>
              <span style={{ fontFamily: "var(--font-inter)", fontSize: "12px", color: "var(--base-400)" }}>
                {post.readingTimeMin} min read
              </span>
            </div>

            <h1
              style={{
                fontFamily: "var(--font-crimson-pro)",
                fontSize: "clamp(32px, 5vw, 48px)",
                fontWeight: 600,
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
                color: "var(--base-800)",
                marginBottom: "16px",
              }}
            >
              {post.title}
            </h1>

            <p style={{ fontFamily: "var(--font-inter)", fontSize: "16px", lineHeight: 1.65, color: "var(--base-500)", marginBottom: "20px" }}>
              {post.description}
            </p>

            <time dateTime={post.publishedAt} style={{ fontFamily: "var(--font-inter)", fontSize: "12px", color: "var(--base-400)" }}>
              {formatDate(post.publishedAt)}
            </time>
          </header>
        </div>

        {/* ── ToC — fixed top-right, hidden on mobile ─────────────────────── */}
        <div className="hidden lg:block">
          <BlogToC headings={headings} />
        </div>

        {/* ── Article body ────────────────────────────────────────────────── */}
        <div
          style={{
            maxWidth: "700px",
            margin: "0 auto",
            padding: "0 24px",
            marginTop: "48px",
          }}
        >
          <article className="prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {post.content}
            </ReactMarkdown>
          </article>
        </div>

        {/* ── CTA + back link ─────────────────────────────────────────────── */}
        <div
          style={{
            maxWidth: "700px",
            margin: "0 auto",
            padding: "64px 24px 120px",
          }}
        >
          <div className="static-cta-card">
            <p className="static-cta-title">Study smarter with Lerno</p>
            <p className="static-cta-body">
              Free AI tutoring grounded in your NCERT textbook. Class 9, 10, and 11.
            </p>
            <a href="https://app.lerno.in" className="static-cta-btn">
              Try Lerno free
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2.5 7h9M8 3.5L11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>

          <div style={{ marginTop: "32px", textAlign: "center" }}>
            <Link href="/blog" style={{ fontFamily: "var(--font-inter)", fontSize: "13px", color: "var(--base-400)" }}>
              ← All posts
            </Link>
          </div>
        </div>

      </StaticShell>
    </>
  );
}
