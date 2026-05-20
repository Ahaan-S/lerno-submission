import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import StaticShell from "@/components/marketing/StaticShell";
import { NCERT_CONFIGS, getNcertConfig } from "@/lib/seo/ncert-data";
import { getChapterFromCurriculum } from "@/lib/curriculum";

interface Props {
  params: Promise<{ grade: string; subject: string; chapter: string }>;
}

export async function generateStaticParams() {
  return NCERT_CONFIGS.flatMap((c) =>
    c.chapters.map((_, i) => ({
      grade: c.gradeSlug,
      subject: c.subjectSlug,
      chapter: `chapter-${i + 1}`,
    }))
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { grade, subject, chapter } = await params;
  const config = getNcertConfig(grade, subject);
  if (!config) return { title: "Not Found" };

  const chapterNum = parseInt(chapter.replace("chapter-", ""), 10);
  const chapterName = config.chapters[chapterNum - 1];
  if (!chapterName) return { title: "Not Found" };

  const title = `${chapterName} — NCERT ${config.gradeLabel} ${config.subjectLabel} Ch. ${chapterNum} | Lerno`;
  const description = `Study "${chapterName}" (NCERT ${config.gradeLabel} ${config.subjectLabel}, Chapter ${chapterNum}) with Lerno's free AI tutor. Topic breakdowns, instant explanations, and practice questions.`;
  const canonical = `https://lerno.in/ncert/${config.gradeSlug}/${config.subjectSlug}/chapter-${chapterNum}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, siteName: "Lerno", locale: "en_IN", type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function NcertChapterPage({ params }: Props) {
  const { grade, subject, chapter } = await params;
  const config = getNcertConfig(grade, subject);
  if (!config) notFound();

  const chapterNum = parseInt(chapter.replace("chapter-", ""), 10);
  if (isNaN(chapterNum) || chapterNum < 1 || chapterNum > config.chapters.length) notFound();

  const chapterName = config.chapters[chapterNum - 1];
  const curriculumData = config.hasCurriculum
    ? getChapterFromCurriculum(config.grade, config.internalSubject, chapterNum, chapterName)
    : null;

  const subjectPageUrl = `/ncert/${config.gradeSlug}/${config.subjectSlug}`;
  const canonical = `https://lerno.in/ncert/${config.gradeSlug}/${config.subjectSlug}/chapter-${chapterNum}`;
  const prevChapter = chapterNum > 1 ? chapterNum - 1 : null;
  const nextChapter = chapterNum < config.chapters.length ? chapterNum + 1 : null;

  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://lerno.in" },
      { "@type": "ListItem", position: 2, name: `NCERT ${config.gradeLabel}`, item: `https://lerno.in/ncert/${config.gradeSlug}` },
      { "@type": "ListItem", position: 3, name: config.subjectLabel, item: `https://lerno.in${subjectPageUrl}` },
      { "@type": "ListItem", position: 4, name: `Chapter ${chapterNum}`, item: canonical },
    ],
  };

  const jsonLdCourse = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: chapterName,
    description: `NCERT ${config.gradeLabel} ${config.subjectLabel} — Chapter ${chapterNum}`,
    provider: { "@type": "Organization", name: "Lerno", url: "https://lerno.in" },
    educationalLevel: `CBSE ${config.gradeLabel}`,
    inLanguage: "en-IN",
    url: canonical,
    isAccessibleForFree: true,
    ...(curriculumData?.topics?.length ? {
      hasPart: curriculumData.topics.map((t) => ({
        "@type": "CourseUnit",
        name: t.topic_name,
        position: t.topic_index,
      })),
    } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdCourse) }} />

      <StaticShell>
        <div
          className="w-full mx-auto px-6"
          style={{ maxWidth: "740px", paddingTop: "160px", paddingBottom: "120px" }}
        >
          {/* Breadcrumb */}
          <nav
            style={{
              display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px",
              marginBottom: "48px",
              fontFamily: "var(--font-inter)", fontSize: "13px", color: "var(--base-400)",
            }}
            aria-label="Breadcrumb"
          >
            <Link href="/" style={{ color: "var(--base-400)" }}>Home</Link>
            <span>/</span>
            <Link href={subjectPageUrl} style={{ color: "var(--base-400)" }}>
              NCERT {config.gradeLabel} {config.subjectLabel}
            </Link>
            <span>/</span>
            <span style={{ color: "var(--base-500)" }}>Chapter {chapterNum}</span>
          </nav>

          {/* Chapter header */}
          <header style={{ marginBottom: "56px", paddingBottom: "40px", borderBottom: "1px solid var(--base-200)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
              {[`Chapter ${chapterNum}`, config.subjectLabel, `NCERT ${config.gradeLabel}`].map((label) => (
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
                fontSize: "clamp(32px, 5vw, 48px)",
                fontWeight: 600,
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
                color: "var(--base-800)",
                marginBottom: config.bookTitle ? "12px" : "0",
              }}
            >
              {chapterName}
            </h1>

            {config.bookTitle && (
              <p style={{ fontFamily: "var(--font-inter)", fontSize: "13px", color: "var(--base-400)", fontStyle: "italic", marginTop: "0" }}>
                {config.bookTitle}
              </p>
            )}
          </header>

          {/* Topics */}
          <section style={{ marginBottom: "64px" }}>
            {curriculumData?.topics?.length ? (
              <>
                <p
                  style={{
                    fontFamily: "var(--font-inter)",
                    fontSize: "11px",
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--base-400)",
                    marginBottom: "24px",
                  }}
                >
                  Topics in this chapter
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0" }}>
                  {curriculumData.topics.map((topic, i) => (
                    <li
                      key={topic.topic_index}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "14px",
                        padding: "14px 0",
                        borderBottom: i < curriculumData.topics.length - 1 ? "1px solid var(--base-200)" : "none",
                      }}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: "var(--base-300)",
                          marginTop: "7px",
                        }}
                        aria-hidden="true"
                      />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontFamily: "var(--font-inter)", fontSize: "14px", fontWeight: 500, color: "var(--base-800)", lineHeight: 1.4, margin: 0 }}>
                          {topic.topic_name}
                        </p>
                        {topic.subtopics?.length > 0 && (
                          <ul style={{ listStyle: "none", padding: "8px 0 0 16px", margin: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
                            {topic.subtopics.map((sub) => (
                              <li key={sub.subtopic_index} style={{ fontFamily: "var(--font-inter)", fontSize: "12px", color: "var(--base-400)", lineHeight: 1.5 }}>
                                {sub.subtopic_name}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p style={{ fontFamily: "var(--font-inter)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--base-400)", marginBottom: "16px" }}>
                  About this chapter
                </p>
                <p style={{ fontFamily: "var(--font-inter)", fontSize: "15px", lineHeight: 1.75, color: "var(--base-500)" }}>
                  <strong style={{ color: "var(--base-800)" }}>{chapterName}</strong> is Chapter {chapterNum} of NCERT{" "}
                  {config.gradeLabel} {config.subjectLabel}{config.bookTitle ? ` (${config.bookTitle})` : ""}. Use Lerno&apos;s AI tutor to get instant explanations,
                  practice questions, and step-by-step guidance for every topic — all grounded in your NCERT textbook.
                </p>
              </>
            )}
          </section>

          {/* CTA */}
          <div
            style={{
              padding: "40px",
              borderRadius: "16px",
              background: "var(--base-800)",
              textAlign: "center",
              marginBottom: "48px",
            }}
          >
            <p style={{ fontFamily: "var(--font-crimson-pro)", fontSize: "24px", fontWeight: 600, color: "#ffffff", marginBottom: "8px", lineHeight: 1.2 }}>
              Study &ldquo;{chapterName}&rdquo; with AI
            </p>
            <p style={{ fontFamily: "var(--font-inter)", fontSize: "14px", color: "var(--base-400)", marginBottom: "28px", lineHeight: 1.6 }}>
              Explanations, solved examples, and practice questions — instantly, for free.
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
              Open Lerno free
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2.5 7h9M8 3.5L11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>

          {/* Chapter nav */}
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontFamily: "var(--font-inter)",
              fontSize: "13px",
              color: "var(--base-400)",
            }}
            aria-label="Chapter navigation"
          >
            {prevChapter ? (
              <Link href={`/ncert/${config.gradeSlug}/${config.subjectSlug}/chapter-${prevChapter}`} style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--base-400)" }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M9 3.5L5.5 7 9 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Chapter {prevChapter}
              </Link>
            ) : <span />}

            <Link href={subjectPageUrl} style={{ color: "var(--base-400)" }}>All chapters</Link>

            {nextChapter ? (
              <Link href={`/ncert/${config.gradeSlug}/${config.subjectSlug}/chapter-${nextChapter}`} style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--base-400)" }}>
                Chapter {nextChapter}
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M5 3.5L8.5 7 5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ) : <span />}
          </nav>
        </div>
      </StaticShell>
    </>
  );
}
