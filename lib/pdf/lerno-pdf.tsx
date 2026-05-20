// lib/pdf/lerno-pdf.tsx
// Client-side PDF generation using @react-pdf/renderer.
// Imported lazily from DocumentPreviewPanel — not bundled with initial page load.
"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  pdf,
} from "@react-pdf/renderer";
import type {
  GeneratedDocument,
  NotesDocument,
  SummaryDocument,
  NoteItemType,
} from "@/lib/ai/doc-types";

// ── Font registration ─────────────────────────────────────────────────────────
// Use absolute URLs so the middleware subdomain rewrite (app.* → /portal)
// doesn't intercept the font fetches and return a 404.
const _origin = typeof window !== "undefined" ? window.location.origin : "";

Font.register({
  family: "Inter",
  fonts: [
    { src: `${_origin}/fonts/Inter-Regular.ttf`,  fontWeight: 400 },
    { src: `${_origin}/fonts/Inter-SemiBold.ttf`, fontWeight: 600 },
    { src: `${_origin}/fonts/Inter-Bold.ttf`,     fontWeight: 700 },
  ],
});

// ── Text sanitizer ────────────────────────────────────────────────────────────
// Strips markdown syntax and replaces characters not in the PDF font's encoding.

function sanitize(text: string): string {
  return (
    text
      // Remove bold/italic markdown: **bold**, *italic*, __bold__, _italic_
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/_(.+?)_/g, "$1")
      // Remove inline code backticks
      .replace(/`(.+?)`/g, "$1")
      // Replace middle dot bullet (U+00B7) with ASCII hyphen-dash
      .replace(/·/g, "-")
      // Replace other common special chars
      .replace(/→/g, "->")
      .replace(/←/g, "<-")
      .replace(/≈/g, "~")
      .replace(/≠/g, "!=")
      .replace(/≤/g, "<=")
      .replace(/≥/g, ">=")
      .replace(/×/g, "x")
      .replace(/÷/g, "/")
      .replace(/°/g, " deg")
      .replace(/²/g, "^2")
      .replace(/³/g, "^3")
      .replace(/\u2019/g, "'")
      .replace(/\u2018/g, "'")
      .replace(/\u201c/g, '"')
      .replace(/\u201d/g, '"')
      .replace(/\u2013/g, "-")
      .replace(/\u2014/g, "--")
      .replace(/\u2026/g, "...")
      // Strip any remaining non-ASCII characters that might cause encoding errors
      // eslint-disable-next-line no-control-regex
      .replace(/[^\x00-\x7E\u00A0-\u024F]/g, "")
      .trim()
  );
}

// ── Colour tokens ─────────────────────────────────────────────────────────────
const C = {
  blue:        "#2563eb",
  blueBg:      "#eff6ff",
  blueText:    "#1e40af",
  blueMuted:   "#3b82f6",

  green:       "#16a34a",
  greenBg:     "#f0fdf4",
  greenText:   "#14532d",
  greenLabel:  "#166534",

  amber:       "#d97706",
  amberBg:     "#fffbeb",
  amberText:   "#78350f",
  amberLabel:  "#92400e",

  ink:         "#0f172a",
  body:        "#334155",
  muted:       "#64748b",
  subtle:      "#94a3b8",
  border:      "#e2e8f0",
  pageBg:      "#ffffff",
};

const styles = StyleSheet.create({
  page: {
    padding: 52,
    paddingBottom: 64,
    fontFamily: "Inter",
    fontSize: 10,
    color: C.body,
    lineHeight: 1.6,
    backgroundColor: C.pageBg,
  },

  // ── Document header (first page only) ──
  docHeader: {
    marginBottom: 30,
    paddingBottom: 16,
    borderBottom: `2pt solid ${C.blue}`,
  },
  docTitle: {
    fontSize: 18,
    fontFamily: "Inter",
    fontWeight: 700,
    color: C.ink,
    marginBottom: 5,
    lineHeight: 1.25,
  },
  docMeta: {
    fontSize: 8.5,
    color: C.subtle,
    letterSpacing: 0.3,
  },

  // ── Topic section ──
  section: { marginBottom: 24 },
  topicHeading: {
    fontSize: 12,
    fontFamily: "Inter",
    fontWeight: 700,
    color: C.ink,
    borderBottom: `0.75pt solid ${C.border}`,
    paddingBottom: 5,
    marginBottom: 10,
  },

  // ── Subheading ──
  subheading: {
    fontSize: 7.5,
    fontFamily: "Inter",
    fontWeight: 600,
    color: C.subtle,
    marginTop: 10,
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // ── Definition block (blue) ──
  definitionBox: {
    backgroundColor: C.blueBg,
    borderLeft: `3pt solid ${C.blue}`,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 7,
    paddingBottom: 7,
    marginBottom: 7,
    borderRadius: 4,
  },
  definitionTerm: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 9.5,
    color: C.blueText,
    marginBottom: 3,
  },
  definitionText: {
    fontSize: 9,
    color: C.blueText,
    lineHeight: 1.55,
  },

  // ── Bullet points ──
  bulletRow: {
    flexDirection: "row",
    marginBottom: 4,
    alignItems: "flex-start",
  },
  bulletDot: {
    width: 12,
    fontSize: 10,
    color: C.blueMuted,
    marginTop: 1,
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
    color: C.body,
    lineHeight: 1.55,
  },

  // ── Formula block (green) ──
  formulaBox: {
    backgroundColor: C.greenBg,
    borderLeft: `3pt solid ${C.green}`,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 7,
    paddingBottom: 7,
    marginBottom: 7,
    borderRadius: 4,
  },
  formulaLabel: {
    fontSize: 7,
    color: C.greenLabel,
    fontFamily: "Inter",
    fontWeight: 600,
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  formulaExpression: {
    fontSize: 10.5,
    fontFamily: "Inter",
    fontWeight: 700,
    color: C.greenText,
    lineHeight: 1.45,
  },
  formulaNote: {
    fontSize: 8.5,
    color: C.green,
    marginTop: 3,
    lineHeight: 1.55,
  },

  // ── Remember block (amber) ──
  rememberBox: {
    backgroundColor: C.amberBg,
    borderLeft: `3pt solid ${C.amber}`,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 7,
    paddingBottom: 7,
    marginBottom: 7,
    borderRadius: 4,
  },
  rememberLabel: {
    fontSize: 7,
    color: C.amberLabel,
    fontFamily: "Inter",
    fontWeight: 600,
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  rememberText: {
    fontSize: 9,
    color: C.amberText,
    lineHeight: 1.55,
  },

  // ── Summary bullets ──
  summaryBulletRow: {
    flexDirection: "row",
    marginBottom: 6,
    alignItems: "flex-start",
  },
  summaryBulletDot: {
    width: 12,
    fontSize: 10,
    color: C.blueMuted,
    marginTop: 1,
  },
  summaryBulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.6,
    color: C.body,
  },

  // ── Footer ──
  footer: {
    position: "absolute",
    bottom: 22,
    left: 52,
    right: 52,
    borderTop: `0.75pt solid ${C.border}`,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 7.5,
    color: C.subtle,
    textAlign: "center",
  },
});

// ── Note item renderer (PDF) ──────────────────────────────────────────────────

function NoteItemView({ item }: { item: NoteItemType }) {
  switch (item.type) {
    case "definition":
      return (
        <View style={styles.definitionBox}>
          <Text style={styles.definitionTerm}>{sanitize(item.term)}</Text>
          <Text style={styles.definitionText}>{sanitize(item.text)}</Text>
        </View>
      );

    case "subheading":
      return <Text style={styles.subheading}>{sanitize(item.text)}</Text>;

    case "points":
      return (
        <View>
          {item.heading && <Text style={styles.subheading}>{sanitize(item.heading)}</Text>}
          {item.items.map((pt, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>-</Text>
              <Text style={styles.bulletText}>{sanitize(pt)}</Text>
            </View>
          ))}
        </View>
      );

    case "formula":
      return (
        <View style={styles.formulaBox}>
          {item.label && <Text style={styles.formulaLabel}>{sanitize(item.label)}</Text>}
          <Text style={styles.formulaExpression}>{sanitize(item.expression)}</Text>
          {item.note && <Text style={styles.formulaNote}>{sanitize(item.note)}</Text>}
        </View>
      );

    case "remember":
      return (
        <View style={styles.rememberBox}>
          <Text style={styles.rememberLabel}>Remember</Text>
          <Text style={styles.rememberText}>{sanitize(item.text)}</Text>
        </View>
      );

    default:
      return null;
  }
}

// ── PDF Documents ─────────────────────────────────────────────────────────────

function NotesPDFDoc({ doc }: { doc: NotesDocument }) {
  const subjectLabel = doc.subject.charAt(0).toUpperCase() + doc.subject.slice(1);
  return (
    <Document>
      {doc.sections.map((section, si) => (
        <Page key={si} size="A4" style={styles.page} break={si > 0}>
          {si === 0 && (
            <View style={styles.docHeader}>
              <Text style={styles.docTitle}>{sanitize(doc.title)}</Text>
              <Text style={styles.docMeta}>
                {subjectLabel} | NCERT | lerno.in
              </Text>
            </View>
          )}
          <View style={styles.section}>
            <Text style={styles.topicHeading}>
              {section.topic_index}. {sanitize(section.topic_name)}
            </Text>
            {section.items.map((item, ii) => (
              <NoteItemView key={ii} item={item} />
            ))}
          </View>
          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>
              lerno.in | {subjectLabel} | {sanitize(doc.chapter_name)}
            </Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}

function SummaryPDFDoc({ doc }: { doc: SummaryDocument }) {
  const subjectLabel = doc.subject.charAt(0).toUpperCase() + doc.subject.slice(1);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.docHeader}>
          <Text style={styles.docTitle}>{sanitize(doc.title)}</Text>
          <Text style={styles.docMeta}>
            {subjectLabel} | NCERT | lerno.in
          </Text>
        </View>
        {doc.sections.map((section, si) => (
          <View key={si} style={styles.section}>
            <Text style={styles.topicHeading}>
              {section.topic_index}. {sanitize(section.topic_name)}
            </Text>
            {section.bullets.map((bullet, bi) => (
              <View key={bi} style={styles.summaryBulletRow}>
                <Text style={styles.summaryBulletDot}>-</Text>
                <Text style={styles.summaryBulletText}>{sanitize(bullet)}</Text>
              </View>
            ))}
          </View>
        ))}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            lerno.in | {subjectLabel} | {sanitize(doc.chapter_name)}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generates and downloads a PDF for the given document.
 * Runs entirely in the browser — no server call.
 * Import lazily: const { downloadAsPDF } = await import("@/lib/pdf/lerno-pdf")
 */
export async function downloadAsPDF(
  doc: GeneratedDocument,
  filename?: string
): Promise<void> {
  const component =
    doc.type === "notes" ? (
      <NotesPDFDoc doc={doc as NotesDocument} />
    ) : (
      <SummaryPDFDoc doc={doc as SummaryDocument} />
    );

  const blob = await pdf(component).toBlob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download =
    filename ??
    `${doc.title.replace(/[^a-z0-9\s]/gi, "").replace(/\s+/g, "_").toLowerCase()}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
