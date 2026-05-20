/**
 * NCERT chunk text often mixes prose with LaTeX that is not wrapped in $...$.
 * remark-math only parses $...$ / $$...$$, so we normalize before Markdown + KaTeX.
 */

/** Standard LaTeX inline/display delimiters sometimes found in source text */
export function normalizeLatexDelimiters(text: string): string {
  return text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, inner: string) => `\n$$\n${inner.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, inner: string) => `$${inner.trim()}$`);
}

/**
 * Wraps parenthetical segments that contain LaTeX commands (e.g. \sqrt, \frac)
 * in inline math delimiters. Handles braces inside {...} for \sqrt{...}, \text{...}.
 */
export function wrapParentheticalLatex(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] !== "(") {
      out += text[i];
      i++;
      continue;
    }
    const innerStart = i + 1;
    let depthParen = 1;
    let brace = 0;
    let j = innerStart;
    for (; j < text.length; j++) {
      const c = text[j];
      if (c === "{") brace++;
      else if (c === "}") brace--;
      else if (brace === 0) {
        if (c === "(") depthParen++;
        else if (c === ")") {
          depthParen--;
          if (depthParen === 0) break;
        }
      }
    }
    if (j >= text.length) {
      out += text.slice(i);
      break;
    }
    const inner = text.slice(innerStart, j);
    const hasLatex = /\\[a-zA-Z]+/.test(inner);
    const hasDollar = inner.includes("$");
    if (hasLatex && !hasDollar && inner.length > 0 && inner.length < 2000) {
      out += `($${inner.trim()}$)`;
    } else {
      out += `(${inner})`;
    }
    i = j + 1;
  }
  return out;
}

/** Full pipeline for citation / chunk snippets shown in modals and tooltips */
export function normalizeCitationChunkMath(text: string): string {
  if (!text || !text.includes("\\")) return text;
  let s = normalizeLatexDelimiters(text);
  s = wrapParentheticalLatex(s);
  return s;
}
