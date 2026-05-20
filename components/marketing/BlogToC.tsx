"use client";

import { useEffect, useState } from "react";
import type { BlogHeading } from "@/lib/seo/blog-utils";

export default function BlogToC({ headings }: { headings: BlogHeading[] }) {
  const [activeId, setActiveId] = useState<string>(headings[0]?.id ?? "");

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost entry that is intersecting
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      // Trigger slightly below the top so the active item updates as you scroll
      { rootMargin: "-100px 0px -55% 0px" }
    );

    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav className="toc-nav" aria-label="On this page">
      {/* Header */}
      <div className="toc-header">
        {/* Three-line icon matching the screenshot */}
        <svg width="14" height="12" viewBox="0 0 14 12" fill="none" aria-hidden="true">
          <rect x="0" y="0" width="14" height="1.5" rx="0.75" fill="currentColor" />
          <rect x="0" y="5" width="10" height="1.5" rx="0.75" fill="currentColor" />
          <rect x="0" y="10" width="12" height="1.5" rx="0.75" fill="currentColor" />
        </svg>
        On this page
      </div>

      {/* Heading list */}
      <ul className="toc-list" role="list">
        {headings.map((h) => (
          <li key={h.id} className="toc-item">
            <a
              href={`#${h.id}`}
              className={`toc-link${h.level === 3 ? " level-3" : ""}${activeId === h.id ? " active" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                setActiveId(h.id);
              }}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
