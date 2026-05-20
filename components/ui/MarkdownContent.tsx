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

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  const processed = normalizeCitationChunkMath(content);
  const components: Components = {
    p: ({ children }) => <p className="mb-2.5 last:mb-0 leading-6">{children}</p>,

    h3: ({ children }) => (
      <h3 className="text-[14px] font-semibold mt-4 mb-1.5" style={{ color: "var(--base-800)" }}>
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-[13px] font-semibold mt-3 mb-1" style={{ color: "var(--base-700)" }}>
        {children}
      </h4>
    ),

    ul: ({ children }) => (
      <ul className="mb-2.5 space-y-1 pl-4" style={{ listStyleType: "disc" }}>
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-2.5 space-y-1 pl-4" style={{ listStyleType: "decimal" }}>
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="leading-6 pl-0.5">{children}</li>,

    table: ({ children }) => (
      <div className="my-2.5 overflow-x-auto rounded-md border" style={{ borderColor: "var(--base-200)" }}>
        <table className="w-full text-[13px] border-collapse">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead style={{ background: "var(--base-50)" }}>{children}</thead>
    ),
    th: ({ children }) => (
      <th
        className="px-3 py-2 text-left font-semibold text-[12px] border-b"
        style={{ color: "var(--base-700)", borderColor: "var(--base-200)" }}
      >
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td
        className="px-3 py-2 border-b last:border-b-0 align-top"
        style={{ color: "var(--base-600)", borderColor: "var(--base-100)" }}
      >
        {children}
      </td>
    ),
    tr: ({ children }) => <tr>{children}</tr>,

    code: ({ children }) => (
      <code
        className="px-1 py-0.5 rounded text-[12px] font-mono"
        style={{ background: "var(--base-100)", color: "var(--base-700)" }}
      >
        {children}
      </code>
    ),

    strong: ({ children }) => (
      <strong className="font-semibold" style={{ color: "var(--base-900)" }}>
        {children}
      </strong>
    ),
  };

  return (
    <div className="text-[14px] leading-6 citation-markdown" style={{ color: "var(--base-700)" }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, KATEX_OPTIONS]]}
        components={components}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
