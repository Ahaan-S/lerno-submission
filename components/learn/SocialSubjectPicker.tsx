"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { startTopLoader } from "@/components/ui/TopLoader";

const SST_BOOKS = [
  {
    slug: "social_history",
    label: "History",
    subtitle: "India and the Contemporary World – II",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    slug: "social_geography",
    label: "Geography",
    subtitle: "Contemporary India – II",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
    ),
  },
  {
    slug: "social_civics",
    label: "Political Science",
    subtitle: "Democratic Politics – II",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
      </svg>
    ),
  },
  {
    slug: "social_economics",
    label: "Economics",
    subtitle: "Understanding Economic Development",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" x2="12" y1="2" y2="22" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
] as const;

export default function SocialSubjectPicker() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-full py-16 px-6">
      <div className="w-full max-w-[520px] flex flex-col gap-8">
        <div className="flex flex-col gap-2 text-center">
          <h1
            className="text-[32px] font-semibold"
            style={{ fontFamily: "var(--font-crimson-pro)", color: "var(--base-800)" }}
          >
            Choose a subject
          </h1>
          <p className="text-[15px]" style={{ fontFamily: "var(--font-inter)", color: "var(--base-400)" }}>
            Social Science is divided into four books. Pick one to start.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {SST_BOOKS.map((book, i) => (
            <motion.button
              key={book.slug}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1], delay: i * 0.05 }}
              onClick={() => { startTopLoader(); router.push(`/learn/${book.slug}`); }}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border text-left transition-colors duration-150 bg-white hover:bg-[#F4F6F8] cursor-pointer"
              style={{
                borderColor: "#E2E8F0",
                fontFamily: "var(--font-inter)",
              }}
            >
              <div
                className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "var(--primary-50, #EEF4FF)", color: "var(--primary-400)" }}
              >
                {book.icon}
              </div>
              <div className="flex flex-col min-w-0">
                <span
                  className="text-[15px] font-semibold leading-snug"
                  style={{ color: "var(--base-800)" }}
                >
                  {book.label}
                </span>
                <span
                  className="text-[12.5px] leading-snug mt-0.5 truncate"
                  style={{ color: "var(--base-400)" }}
                >
                  {book.subtitle}
                </span>
              </div>
              <svg
                className="ml-auto shrink-0"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--base-300)" }}
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
