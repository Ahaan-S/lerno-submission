import type { MetadataRoute } from "next";
import { NCERT_CONFIGS } from "@/lib/seo/ncert-data";
import { BLOG_POSTS } from "@/content/blog";
import { UPDATE_POSTS } from "@/content/updates";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://lerno.in";
  const now = new Date();

  // ── Core marketing pages ─────────────────────────────────────────────────
  const corePages: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/disclaimer`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  // ── NCERT subject pages (/ncert/class-X/subject) ─────────────────────────
  const subjectPages: MetadataRoute.Sitemap = NCERT_CONFIGS.map((c) => ({
    url: `${base}/ncert/${c.gradeSlug}/${c.subjectSlug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  // ── NCERT chapter pages (/ncert/class-X/subject/chapter-N) ───────────────
  const chapterPages: MetadataRoute.Sitemap = NCERT_CONFIGS.flatMap((c) =>
    c.chapters.map((_, i) => ({
      url: `${base}/ncert/${c.gradeSlug}/${c.subjectSlug}/chapter-${i + 1}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }))
  );

  // ── Blog posts (/blog/[slug]) ─────────────────────────────────────────────
  const blogPages: MetadataRoute.Sitemap = BLOG_POSTS.map((p) => ({
    url: `${base}/blog/${p.slug}`,
    lastModified: new Date(p.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // ── Update posts (/updates/[slug]) ─────────────────────────────────────────
  const updateDetailPages: MetadataRoute.Sitemap = UPDATE_POSTS.map((p) => ({
    url: `${base}/updates/${p.slug}`,
    lastModified: new Date(p.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.55,
  }));

  // ── Static content pages ───────────────────────────────────────────────────
  const contentPages: MetadataRoute.Sitemap = [
    { url: `${base}/blog`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.6 },
    { url: `${base}/updates`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.5 },
    ...updateDetailPages,
  ];

  return [...corePages, ...contentPages, ...subjectPages, ...chapterPages, ...blogPages];
}
