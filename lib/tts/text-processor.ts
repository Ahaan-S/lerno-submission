/**
 * Strips markdown, LaTeX, and citation markers from tutor output so that
 * it reads naturally when synthesised by a TTS engine.
 *
 * Order matters — remove fenced blocks before inline code, display math before
 * inline math, etc.
 */
export function cleanForSpeech(text: string): string {
  return (
    text
      // ── Fenced code blocks (``` ... ```) — replace with nothing ──────────
      .replace(/```[\s\S]*?```/g, "")
      // ── Interactive graph placeholders: [[graph:quadratic]] ─────────────
      .replace(/\[\[graph:[a-z0-9][a-z0-9_-]{0,63}\]\]/gi, "")
      // ── LaTeX display math: $$...$$ ──────────────────────────────────────
      .replace(/\$\$[\s\S]*?\$\$/g, "")
      // ── LaTeX block math: \[...\] ────────────────────────────────────────
      .replace(/\\\[[\s\S]*?\\\]/g, "")
      // ── LaTeX inline math: \(...\) ───────────────────────────────────────
      .replace(/\\\([\s\S]*?\\\)/g, "")
      // ── LaTeX inline math: $...$ (single-dollar, non-greedy) ────────────
      .replace(/\$[^$\n]+\$/g, "")
      // ── Inline code: `...` ───────────────────────────────────────────────
      .replace(/`[^`]*`/g, "")
      // ── Citation markers: [1], [2], etc. ────────────────────────────────
      .replace(/\[\d+\]/g, "")
      // ── Markdown headings — keep the text, drop the # prefix ────────────
      .replace(/^#{1,6}\s+/gm, "")
      // ── Bold / italic: ***text***, **text**, *text*, ___text___, etc. ────
      .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, "$1")
      .replace(/_{1,3}([^_\n]+)_{1,3}/g, "$1")
      // ── Strikethrough: ~~text~~ ──────────────────────────────────────────
      .replace(/~~([^~]+)~~/g, "$1")
      // ── Markdown images: ![alt](url) ────────────────────────────────────
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      // ── Markdown links: [text](url) — keep text ─────────────────────────
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // ── Blockquote markers ───────────────────────────────────────────────
      .replace(/^>\s*/gm, "")
      // ── Horizontal rules ─────────────────────────────────────────────────
      .replace(/^[-*_]{3,}\s*$/gm, "")
      // ── Unordered list markers (-, *, +) ────────────────────────────────
      .replace(/^[ \t]*[-*+]\s+/gm, "")
      // ── Ordered list markers (1. 2. etc.) ───────────────────────────────
      .replace(/^[ \t]*\d+\.\s+/gm, "")
      // ── Collapse 3+ consecutive newlines to a paragraph break ────────────
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Heuristic: parenthesised expression before "!" is probably math (factorial),
 * not an English aside like "(see below)!".
 */
function isLikelyMathParenContent(inner: string): boolean {
  const t = inner.replace(/\s+/g, " ").trim();
  if (!t || t.length > 120) return false;

  if (
    /\b(the|and|or|see|note|hint|example|below|above|refer|figure|fig|chapter|section|equation|eq|solution|answer)\b/i.test(
      t,
    )
  ) {
    return false;
  }
  if (/\b(is|are|was|were|has|have|this|that|these|those|from|for|with)\b/i.test(t)) {
    return false;
  }

  if (/[0-9]/.test(t) && /[+\-*/^]/.test(t)) return true;
  if (/^\d+$/.test(t)) return true;
  if (/^[a-z]\s*[+\-*/^]/i.test(t)) return true;
  if (/^[a-z](?:\s*[+\-*/]\s*[a-z0-9]+)+$/i.test(t)) return true;
  if (/^[0-9nrxkqylz+\-*/^()\s,]+$/i.test(t)) return true;

  return false;
}

/**
 * Turns remaining punctuation and symbols into words or pauses so TTS does not
 * mis-read them (e.g. ":" as "times", stray "*" as "asterisk", "!" as factorial
 * only when appropriate).
 *
 * Intended to run **after** {@link cleanForSpeech}.
 */
export function humanizeForSpeech(text: string): string {
  let s = text;

  // ── List bullets (• ‣ ◦ ▪ ● ○ ⁃) — never read as "times"; use a short pause ─
  //    Line-leading bullets become a paragraph break so TTS breathes between items.
  s = s.replace(
    /(^|\n)[ \t]*[\u2022\u2023\u25E6\u25AA\u25CF\u25CB\u2043]\s*/gm,
    "$1\n",
  );

  // ── Colon ends a line (e.g. "here is what we cover:") — extra pause before next block
  s = s.replace(/:\s*\n+(?=\S)/g, ".\n\n");

  // ── Unicode punctuation → ASCII where it helps TTS ─────────────────────
  s = s.replace(/[\u2013\u2014\u2212]/g, "-"); // en dash, em dash, minus → hyphen
  // × · ∙ — multiplication only (NOT • U+2022 bullet — handled above)
  s = s.replace(/[\u00D7\u22C5\u2219]/g, " times ");
  // Middle dot: multiplication between digits, otherwise a light pause (not "times")
  s = s.replace(/\b(\d+)\s*\u00B7\s*(\d+)\b/g, "$1 times $2");
  s = s.replace(/\u00B7/g, ", ");
  s = s.replace(/\u00F7/g, " divided by "); // ÷
  s = s.replace(/\u2260/g, " does not equal ");
  s = s.replace(/\u2264/g, " less than or equal to ");
  s = s.replace(/\u2265/g, " greater than or equal to ");
  s = s.replace(/\u221A/g, " square root of ");
  s = s.replace(/\u00B1/g, " plus or minus ");
  s = s.replace(/[\u2018\u2019\u201C\u201D]/g, "'");

  // ── URLs — remove (TTS reads slashes and colons oddly) ───────────────────
  s = s.replace(/https?:\/\/[^\s)\]]+/gi, "");

  // ── Factorial: digit then ! ───────────────────────────────────────────────
  s = s.replace(/\b(\d+)\s*!/g, "$1 factorial");

  // ── Factorial: (math-like) then ! ─────────────────────────────────────────
  s = s.replace(/\(\s*([^)]{1,120})\s*\)\s*!/g, (full, inner: string) => {
    if (!isLikelyMathParenContent(inner)) return full;
    return ` the factorial of ${inner.replace(/\s+/g, " ").trim()} `;
  });

  // ── Remaining exclamation — prose emphasis, not math ─────────────────────
  s = s.replace(/!/g, " ");

  // ── Clock-style times (before generic digit ratios) — drop colons so TTS
  //    does not read them as "times" or ratios
  s = s.replace(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/g, (_, h: string, m: string, sec?: string) =>
    sec ? `${h} ${m} ${sec}` : `${h} ${m}`,
  );

  // ── Ratios / maps like 3 : 4 — speak as "to", avoids "times" misreads ─────
  s = s.replace(/\b(\d+)\s*:\s*(\d+)\b/g, "$1 to $2");

  // ── Remaining colons — label pauses etc.; comma reads more naturally ─────
  s = s.replace(/:/g, ", ");

  // ── Semicolons → shorter pause ───────────────────────────────────────────
  s = s.replace(/;/g, ", ");

  // ── Inequalities (before stripping raw angle brackets) ───────────────────
  s = s.replace(/\b(\d+(?:\.\d+)?)\s*<\s*(\d+(?:\.\d+)?)\b/g, "$1 less than $2");
  s = s.replace(/\b(\d+(?:\.\d+)?)\s*>\s*(\d+(?:\.\d+)?)\b/g, "$1 greater than $2");

  // ── Common math / punctuation in plain text ───────────────────────────────
  s = s.replace(/\s*=\s*/g, " equals ");
  s = s.replace(/\s*\+\s*(?=\d)/g, " plus ");
  s = s.replace(/\b(\d+)\s*\+\s*(\d+)\b/g, "$1 plus $2");
  // Only small integers — avoids "2020 minus 2021" for year ranges
  s = s.replace(/\b(\d{1,3})\s*-\s*(\d{1,3})\b/g, "$1 minus $2");
  s = s.replace(/\b(\d+)\s*\/\s*(\d+)\b/g, "$1 divided by $2");
  s = s.replace(/\b(\d+)\s*\*\s*(\d+)\b/g, "$1 times $2");
  s = s.replace(/\(\s*-\s*(\d+)\s*\)/g, " negative $1 ");

  // ── Caret powers: x^2, 10^{n} (rare after markdown strip) ────────────────
  s = s.replace(/\^\s*\{([^}]{1,40})\}/g, " to the power $1 ");
  s = s.replace(/\^\s*(\d+)/g, " to the power $1 ");

  // ── Percent, ampersand ────────────────────────────────────────────────────
  s = s.replace(/(\d+(?:\.\d+)?)\s*%/g, "$1 percent");
  s = s.replace(/\s*&\s*/g, " and ");

  // ── Stray angle brackets (leftover HTML) ───────────────────────────────────
  s = s.replace(/</g, " ");
  s = s.replace(/>/g, " ");

  // ── Stray list / emphasis characters mid-line ─────────────────────────────
  s = s.replace(/^\s*[*#]+\s*/gm, "");
  s = s.replace(/([.!?,\s])[*#@~]{1,3}(?=[\s,.!?]|$)/g, "$1 ");

  // ── Pipes, backslashes ────────────────────────────────────────────────────
  s = s.replace(/\|/g, " ");
  s = s.replace(/\\/g, "");

  // ── Paragraph pauses: end of sentence / question, next line looks like prose ─
  //    Skips "1.\n" style numbering (digit before the period).
  s = s.replace(/(?<![0-9])\.(\s*)\n(?=[A-Z][a-z])/g, ".$1\n\n");
  s = s.replace(/\?(\s*)\n(?=[A-Z][a-z])/g, "?$1\n\n");

  // ── Collapse whitespace & tidy punctuation ───────────────────────────────
  s = s.replace(/,\s*,+/g, ", ");
  s = s.replace(/[ \t]{2,}/g, " ");
  s = s.replace(/\n[ \t]+/g, "\n");
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
}

/**
 * Full pipeline: markdown / LaTeX strip, then symbol humanisation for TTS.
 */
export function prepareTextForSpeech(text: string): string {
  return humanizeForSpeech(cleanForSpeech(text));
}

/**
 * Splits a string into chunks that each fit within `maxLen` characters.
 *
 * Prefers splitting at paragraph breaks (\n\n), then at sentence-ending
 * punctuation (. ! ?), then at any whitespace as a last resort. Never splits
 * mid-word.
 *
 * The default limit of 2400 gives a comfortable buffer below Sarvam's 2500-char
 * per-request ceiling for bulbul:v3.
 */
export function splitIntoChunks(text: string, maxLen = 2400): string[] {
  if (text.length <= maxLen) {
    const trimmed = text.trim();
    return trimmed ? [trimmed] : [];
  }

  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > maxLen) {
    const candidate = remaining.slice(0, maxLen);

    // 1. Prefer paragraph boundary
    let splitAt = candidate.lastIndexOf("\n\n");

    // 2. Fall back to sentence boundary — look for . ! ? followed by space/newline
    if (splitAt < maxLen * 0.4) {
      const sentenceBreaks = [
        candidate.lastIndexOf(". "),
        candidate.lastIndexOf(".\n"),
        candidate.lastIndexOf("! "),
        candidate.lastIndexOf("!\n"),
        candidate.lastIndexOf("? "),
        candidate.lastIndexOf("?\n"),
      ].filter((i) => i >= maxLen * 0.4);

      const best = sentenceBreaks.length ? Math.max(...sentenceBreaks) : -1;
      if (best !== -1) splitAt = best + 1; // include the punctuation
    }

    // 3. Fall back to any whitespace
    if (splitAt < maxLen * 0.4) {
      const wsAt = candidate.lastIndexOf(" ");
      if (wsAt > 0) splitAt = wsAt;
      else splitAt = maxLen; // hard cut — shouldn't happen in normal text
    }

    const chunk = remaining.slice(0, splitAt).trim();
    if (chunk) chunks.push(chunk);
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks.filter(Boolean);
}
