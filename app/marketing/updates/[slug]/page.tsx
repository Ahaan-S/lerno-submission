import type { Metadata } from "next";
import type { Components } from "react-markdown";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import StaticShell from "@/components/marketing/StaticShell";
import BlogToC from "@/components/marketing/BlogToC";
import { UPDATE_POSTS, getUpdatePost } from "@/content/updates";
import { extractHeadings, slugify } from "@/lib/seo/blog-utils";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return UPDATE_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getUpdatePost(slug);
  if (!post) return { title: "Not Found" };

  const canonical = `https://lerno.in/updates/${post.slug}`;
  return {
    title: `${post.title} | Lerno Updates`,
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
      ...(post.coverImage ? { images: [{ url: `https://lerno.in${post.coverImage}` }] } : {}),
    },
    twitter: {
      card: post.coverImage ? "summary_large_image" : "summary",
      title: post.title,
      description: post.description,
    },
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const TAG_STYLES: Record<string, { bg: string; color: string }> = {
  Feature: { bg: "#eff6ff", color: "#1d4ed8" },
  Improvement: { bg: "#f0fdf4", color: "#15803d" },
  Fix: { bg: "#fffbeb", color: "#b45309" },
  Content: { bg: "#f5f3ff", color: "#6d28d9" },
  Infrastructure: { bg: "var(--base-200)", color: "var(--base-400)" },
};

const markdownComponents: Components = {
  h2: ({ children }) => {
    const text = String(children ?? "");
    return <h2 id={slugify(text)}>{children}</h2>;
  },
  h3: ({ children }) => {
    const text = String(children ?? "");
    return <h3 id={slugify(text)}>{children}</h3>;
  },
  img: ({ src, alt }) => {
    if (!src || typeof src !== "string") return null;
    return (
      <span className="update-inline-img-wrap">
        <img src={src} alt={alt ?? ""} loading="lazy" decoding="async" />
      </span>
    );
  },
};

export default async function UpdatePostPage({ params }: Props) {
  const { slug } = await params;
  const post = getUpdatePost(slug);
  if (!post) notFound();

  const headings = extractHeadings(post.content);
  const canonical = `https://lerno.in/updates/${post.slug}`;
  const tagStyle = TAG_STYLES[post.tags[0]] ?? { bg: "var(--base-200)", color: "var(--base-400)" };

  const jsonLdArticle = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
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
        <div
          style={{
            maxWidth: "700px",
            margin: "0 auto",
            padding: "160px 24px 0",
          }}
        >
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "48px",
              fontFamily: "var(--font-inter)",
              fontSize: "13px",
              color: "var(--base-400)",
            }}
            aria-label="Breadcrumb"
          >
            <Link href="/" style={{ color: "var(--base-400)" }}>
              Home
            </Link>
            <span>/</span>
            <Link href="/updates" style={{ color: "var(--base-400)" }}>
              Updates
            </Link>
            <span>/</span>
            <span
              style={{
                color: "var(--base-500)",
                maxWidth: "200px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {post.title}
            </span>
          </nav>

          <header style={{ paddingBottom: "40px", borderBottom: "1px solid var(--base-200)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
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

            <p
              style={{
                fontFamily: "var(--font-inter)",
                fontSize: "16px",
                lineHeight: 1.65,
                color: "var(--base-500)",
                marginBottom: "20px",
              }}
            >
              {post.description}
            </p>

            <time dateTime={post.publishedAt} style={{ fontFamily: "var(--font-inter)", fontSize: "12px", color: "var(--base-400)" }}>
              {formatDate(post.publishedAt)}
            </time>

            {post.coverImage ? (
              <div
                className="update-cover-img-wrap"
                style={{
                  marginTop: "28px",
                  borderRadius: "14px",
                  overflow: "hidden",
                  border: "1px solid var(--base-200)",
                  boxShadow: "0 12px 48px rgba(15, 23, 42, 0.1)",
                  background: "var(--base-100)",
                }}
              >
                <Image
                  src={post.coverImage}
                  alt={post.coverAlt ?? post.title}
                  width={1200}
                  height={630}
                  sizes="(max-width: 700px) 100vw, 652px"
                  style={{ width: "100%", height: "auto", display: "block" }}
                  priority
                />
              </div>
            ) : null}
          </header>
        </div>

        <div className="hidden lg:block">
          <BlogToC headings={headings} />
        </div>

        <div
          style={{
            maxWidth: "700px",
            margin: "0 auto",
            padding: "0 24px",
            marginTop: "48px",
          }}
        >
          <article className="prose prose-update-post">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {post.content}
            </ReactMarkdown>
          </article>
        </div>

        <div
          style={{
            maxWidth: "700px",
            margin: "0 auto",
            padding: "64px 24px 120px",
          }}
        >
          <div className="static-cta-card">
            <p className="static-cta-title">Try it in Lerno</p>
            <p className="static-cta-body">
              Free AI tutoring grounded in your NCERT textbook. Class 9, 10, and 11.
            </p>
            <a href="https://app.lerno.in" className="static-cta-btn">
              Open the app
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path
                  d="M2.5 7h9M8 3.5L11.5 7 8 10.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>

          <div style={{ marginTop: "32px", textAlign: "center" }}>
            <Link href="/updates" style={{ fontFamily: "var(--font-inter)", fontSize: "13px", color: "var(--base-400)" }}>
              ← All updates
            </Link>
          </div>
        </div>
      </StaticShell>
    </>
  );
}
