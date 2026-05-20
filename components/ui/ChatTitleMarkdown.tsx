"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { Components } from "react-markdown";
import { normalizeCitationChunkMath } from "@/lib/math/citation-math-normalize";

const KATEX_OPTIONS = {
  throwOnError: false,
  strict: "ignore" as const,
  macros: {
    "\\Dfrac": "\\dfrac",
    "\\Frac": "\\frac",
    "\\Text": "\\text",
    "\\Cdot": "\\cdot",
    "\\Times": "\\times",
    "\\Sqrt": "\\sqrt",
    "\\Sin": "\\sin",
    "\\Cos": "\\cos",
    "\\Tan": "\\tan",
    "\\Cot": "\\cot",
    "\\Sec": "\\sec",
    "\\Cosec": "\\csc",
    "\\Csc": "\\csc",
    "\\ArcSin": "\\arcsin",
    "\\ArcCos": "\\arccos",
    "\\ArcTan": "\\arctan",
    "\\Degree": "^\\circ",
    "\\degree": "^\\circ",
    "\\Circ": "\\circ",
  },
};

/** Inline-friendly: no block margins — for chat titles in headers / sidebars */
const components: Components = {
  p: ({ children }) => <span className="inline leading-snug">{children}</span>,
  strong: ({ children }) => (
    <strong className="font-semibold" style={{ color: "inherit" }}>
      {children}
    </strong>
  ),
  em: ({ children }) => <em>{children}</em>,
};

export function ChatTitleMarkdown({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const processed = normalizeCitationChunkMath(text);
  return (
    <span className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, KATEX_OPTIONS]]}
        components={components}
      >
        {processed}
      </ReactMarkdown>
    </span>
  );
}
