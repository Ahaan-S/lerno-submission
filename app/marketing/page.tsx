import type { Metadata } from "next";
import NavBar from "@/components/home/Navbar";
import Hero from "@/components/home/Hero";
import Mission from "@/components/home/Mission";
import Showcase from "@/components/home/Showcase";
import StudyFeed from "@/components/home/StudyFeed";
import Benefits from "@/components/home/Benefits";
import Comparison from "@/components/home/Comparison";
import Footer from "@/components/home/Footer";
import React from "react";

const siteDescription =
  "Free personal AI tutor for CBSE Class 10 & 11. Built on NCERT — get instant explanations, guided chapter sessions, and smart practice questions tailored to you.";

export const metadata: Metadata = {
  title: "Lerno — Free Personal AI Tutor for CBSE Class 10 & 11",
  description: siteDescription,
  keywords: [
    "Lerno",
    "Lerno AI tutor",
    "free AI tutor CBSE",
    "personal AI tutor",
    "NCERT tutor",
    "CBSE AI tutor",
    "Class 10 AI tutor",
    "Class 11 AI tutor",
    "CBSE Class 10",
    "CBSE Class 11",
    "NCERT Class 10",
    "NCERT Class 11",
    "Class 10 science help",
    "Class 11 NCERT",
  ],
  alternates: { canonical: "https://lerno.in" },
  openGraph: {
    title: "Lerno — Free Personal AI Tutor for CBSE Class 10 & 11",
    description: siteDescription,
    url: "https://lerno.in",
    siteName: "Lerno",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Lerno — Free Personal AI Tutor for CBSE Class 10 & 11",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lerno — Free Personal AI Tutor for CBSE Class 10 & 11",
    description: siteDescription,
    images: ["/og-image.png"],
  },
};

const jsonLdApp = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Lerno",
  url: "https://lerno.in",
  description:
    "AI-powered NCERT tutor for CBSE students in Grades 6–12. Get instant answers, guided chapter sessions, and smart practice questions.",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web, iOS, Android",
  inLanguage: "en-IN",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "INR",
  },
  featureList: [
    "AI-powered NCERT tutoring",
    "Chapter-by-chapter guided learning",
    "Smart practice questions",
    "Personalized student memory",
    "CBSE exam preparation",
  ],
} as const;

const jsonLdFaq = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Lerno?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Lerno is a free AI-powered tutoring platform for CBSE students in Grades 6–12. It uses your NCERT textbook as the source of truth and gives you instant, personalised explanations, practice questions, and guided learning sessions.",
      },
    },
    {
      "@type": "Question",
      name: "Is Lerno free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — Lerno is completely free for every CBSE student. There are no hidden charges or premium tiers.",
      },
    },
    {
      "@type": "Question",
      name: "Which classes does Lerno support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Lerno currently focuses on CBSE students in Class 10 and Class 11, covering core NCERT subjects including Science, Mathematics, Social Science, and more.",
      },
    },
    {
      "@type": "Question",
      name: "Does Lerno follow the NCERT syllabus?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Lerno's AI is grounded in NCERT textbooks using Retrieval-Augmented Generation (RAG), so every answer is aligned to your official CBSE curriculum.",
      },
    },
    {
      "@type": "Question",
      name: "How is Lerno different from other tutoring apps?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Unlike generic AI chatbots, Lerno builds a personalised memory of each student — tracking weak topics, common mistakes, and learning pace — and uses that to tailor every explanation and question to you specifically.",
      },
    },
  ],
} as const;

const jsonLdSearchBox = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  url: "https://lerno.in",
  name: "Lerno",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://lerno.in/portal/ask?q={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
} as const;

const jsonLdOrg = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Lerno",
  alternateName: "Lerno AI Tutor",
  url: "https://lerno.in",
  logo: "https://lerno.in/lerno-cap-dark.webp",
  description:
    "Lerno is a free AI-powered NCERT tutoring platform for CBSE students in India. Personalised explanations, smart practice questions, and guided learning grounded in official NCERT textbooks.",
  foundingDate: "2024",
  areaServed: "IN",
  inLanguage: "en-IN",
  contactPoint: {
    "@type": "ContactPoint",
    email: "help@lerno.in",
    contactType: "customer support",
  },
} as const;

export default function Home(): React.ReactElement {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdApp) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSearchBox) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrg) }}
      />
      <a
        href="#main-content"
        className="sr-only left-4 top-4 z-[100] rounded-lg bg-[var(--primary-600)] px-4 py-2 text-sm font-semibold text-white shadow-lg focus:not-sr-only focus:absolute focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-white"
      >
        Skip to main content
      </a>
      <main id="main-content" className="min-h-screen outline-none" tabIndex={-1}>
        <NavBar />
        <Hero />
        <div id="mission">
          <Mission />
        </div>
        <div id="features">
          <Showcase />
        </div>
        <div className="hidden lg:block">
          <StudyFeed />
        </div>
        <Benefits />
        <Comparison />
        <Footer />
      </main>
    </>
  );
}
