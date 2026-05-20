/**
 * lib/docx/lerno-docx.ts
 *
 * Client-side DOCX generation for notes and summary documents.
 * Mirrors the design intent of lerno-pdf.tsx using the `docx` package.
 * Called lazily from DocumentPreviewPanel so it doesn't bloat the initial bundle.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ShadingType,
  TableRow,
  TableCell,
  Table,
  WidthType,
  convertInchesToTwip,
} from "docx";
import type { GeneratedDocument, NotesDocument, SummaryDocument, NoteItemType } from "@/lib/ai/doc-types";

// ── Markdown stripper (same logic as PDF sanitizer) ───────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/·/g, "-")
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
    .trim();
}

// ── Colour constants ──────────────────────────────────────────────────────────

const COLOR = {
  ink:       "0F172A",
  body:      "334155",
  muted:     "64748B",
  subtle:    "94A3B8",
  blue:      "2563EB",
  blueBg:    "EFF6FF",
  blueText:  "1E40AF",
  green:     "16A34A",
  greenBg:   "F0FDF4",
  greenText: "166534",
  amber:     "D97706",
  amberBg:   "FFFBEB",
  amberText: "78350F",
  border:    "E2E8F0",
  white:     "FFFFFF",
};

// ── Paragraph helpers ─────────────────────────────────────────────────────────

function spacer(size = 80): Paragraph {
  return new Paragraph({ spacing: { before: size, after: 0 } });
}

function dividerPara(): Paragraph {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.border } },
    spacing: { before: 0, after: 80 },
  });
}

// ── Note item → paragraphs ────────────────────────────────────────────────────

function noteItemParas(item: NoteItemType): Paragraph[] {
  switch (item.type) {
    case "subheading":
      return [
        new Paragraph({
          children: [
            new TextRun({
              text: stripMarkdown(item.text).toUpperCase(),
              bold: true,
              size: 18,
              color: COLOR.muted,
              font: "Calibri",
            }),
          ],
          spacing: { before: 160, after: 40 },
        }),
      ];

    case "definition":
      return [
        new Paragraph({
          children: [
            new TextRun({ text: stripMarkdown(item.term), bold: true, size: 20, color: COLOR.blueText, font: "Calibri" }),
            new TextRun({ text: "  —  ", size: 20, color: COLOR.blue, font: "Calibri" }),
            new TextRun({ text: stripMarkdown(item.text), size: 20, color: COLOR.body, font: "Calibri" }),
          ],
          shading: { type: ShadingType.SOLID, color: COLOR.blueBg, fill: COLOR.blueBg },
          border: {
            left: { style: BorderStyle.SINGLE, size: 16, color: COLOR.blue },
          },
          indent: { left: convertInchesToTwip(0.15), right: convertInchesToTwip(0.15) },
          spacing: { before: 80, after: 80 },
        }),
      ];

    case "formula": {
      const paras: Paragraph[] = [];
      if (item.label) {
        paras.push(
          new Paragraph({
            children: [
              new TextRun({ text: stripMarkdown(item.label), bold: true, size: 18, color: COLOR.greenText, font: "Calibri" }),
            ],
            shading: { type: ShadingType.SOLID, color: COLOR.greenBg, fill: COLOR.greenBg },
            border: { left: { style: BorderStyle.SINGLE, size: 16, color: COLOR.green } },
            indent: { left: convertInchesToTwip(0.15), right: convertInchesToTwip(0.15) },
            spacing: { before: 80, after: 0 },
          })
        );
      }
      paras.push(
        new Paragraph({
          children: [
            new TextRun({ text: stripMarkdown(item.expression), font: "Courier New", size: 20, color: COLOR.green }),
          ],
          shading: { type: ShadingType.SOLID, color: COLOR.greenBg, fill: COLOR.greenBg },
          border: { left: { style: BorderStyle.SINGLE, size: 16, color: COLOR.green } },
          indent: { left: convertInchesToTwip(0.15), right: convertInchesToTwip(0.15) },
          spacing: { before: 0, after: item.note ? 0 : 80 },
        })
      );
      if (item.note) {
        paras.push(
          new Paragraph({
            children: [
              new TextRun({ text: stripMarkdown(item.note), size: 18, color: COLOR.greenText, font: "Calibri", italics: true }),
            ],
            shading: { type: ShadingType.SOLID, color: COLOR.greenBg, fill: COLOR.greenBg },
            border: { left: { style: BorderStyle.SINGLE, size: 16, color: COLOR.green } },
            indent: { left: convertInchesToTwip(0.15), right: convertInchesToTwip(0.15) },
            spacing: { before: 0, after: 80 },
          })
        );
      }
      return paras;
    }

    case "remember":
      return [
        new Paragraph({
          children: [
            new TextRun({ text: "Remember: ", bold: true, size: 20, color: COLOR.amberText, font: "Calibri" }),
            new TextRun({ text: stripMarkdown(item.text), size: 20, color: COLOR.amberText, font: "Calibri" }),
          ],
          shading: { type: ShadingType.SOLID, color: COLOR.amberBg, fill: COLOR.amberBg },
          border: { left: { style: BorderStyle.SINGLE, size: 16, color: COLOR.amber } },
          indent: { left: convertInchesToTwip(0.15), right: convertInchesToTwip(0.15) },
          spacing: { before: 80, after: 80 },
        }),
      ];

    case "points": {
      const paras: Paragraph[] = [];
      if (item.heading) {
        paras.push(
          new Paragraph({
            children: [
              new TextRun({ text: stripMarkdown(item.heading), bold: true, size: 20, color: COLOR.ink, font: "Calibri" }),
            ],
            spacing: { before: 80, after: 40 },
          })
        );
      }
      for (const point of item.items) {
        paras.push(
          new Paragraph({
            children: [
              new TextRun({ text: stripMarkdown(point), size: 20, color: COLOR.body, font: "Calibri" }),
            ],
            bullet: { level: 0 },
            spacing: { before: 20, after: 20 },
          })
        );
      }
      return paras;
    }

    default:
      return [];
  }
}

// ── Notes document → DOCX paragraphs ─────────────────────────────────────────

function buildNotesContent(doc: NotesDocument): Paragraph[] {
  const paras: Paragraph[] = [];
  for (const section of doc.sections) {
    // Topic heading
    paras.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${section.topic_index} — ${section.topic_name}`,
            bold: true,
            size: 24,
            color: COLOR.ink,
            font: "Calibri",
          }),
        ],
        spacing: { before: 200, after: 60 },
      })
    );
    paras.push(dividerPara());
    for (const item of section.items) {
      paras.push(...noteItemParas(item));
    }
    paras.push(spacer(120));
  }
  return paras;
}

// ── Summary document → DOCX paragraphs ───────────────────────────────────────

function buildSummaryContent(doc: SummaryDocument): Paragraph[] {
  const paras: Paragraph[] = [];
  for (const section of doc.sections) {
    paras.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${section.topic_index} — ${section.topic_name}`,
            bold: true,
            size: 24,
            color: COLOR.ink,
            font: "Calibri",
          }),
        ],
        spacing: { before: 200, after: 60 },
      })
    );
    paras.push(dividerPara());
    for (const bullet of section.bullets) {
      paras.push(
        new Paragraph({
          children: [
            new TextRun({ text: stripMarkdown(bullet), size: 20, color: COLOR.body, font: "Calibri" }),
          ],
          bullet: { level: 0 },
          spacing: { before: 20, after: 20 },
        })
      );
    }
    paras.push(spacer(80));
  }
  return paras;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function downloadAsDocx(
  doc: GeneratedDocument,
  filename?: string
): Promise<void> {
  const subjectLabel = doc.subject.charAt(0).toUpperCase() + doc.subject.slice(1);
  const typeLabel = doc.type === "notes" ? "Study Notes" : "Chapter Summary";

  const headerParas: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: doc.title,
          bold: true,
          size: 36,
          color: COLOR.ink,
          font: "Calibri",
        }),
      ],
      spacing: { before: 0, after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `${subjectLabel}  ·  NCERT  ·  ${typeLabel}  ·  lerno.in`, size: 18, color: COLOR.subtle, font: "Calibri" }),
      ],
      spacing: { before: 0, after: 0 },
    }),
    spacer(40),
    dividerPara(),
  ];

  const bodyParas: Paragraph[] =
    doc.type === "notes"
      ? buildNotesContent(doc as NotesDocument)
      : buildSummaryContent(doc as SummaryDocument);

  const wordDoc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.1),
              right: convertInchesToTwip(1.1),
            },
          },
        },
        children: [...headerParas, ...bodyParas],
      },
    ],
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 20 },
        },
      },
    },
  });

  const blob = await Packer.toBlob(wordDoc);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename ?? `${doc.title.replace(/[^\w\s-]/g, "").trim()}.docx`;
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(anchor);
  }, 1000);
}
