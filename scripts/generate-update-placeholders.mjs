/**
 * Generates branded WebP placeholders for marketing update posts (3 images per slug).
 * Run: npm run generate:update-placeholders
 * One slug: node scripts/generate-update-placeholders.mjs study-feed
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(__dirname, "..", "public", "marketing", "updates");

function svgCard({ w, h, title, subtitle, bodyLines = [] }) {
  const lines = bodyLines
    .map((t, i) => {
      const y = 160 + i * 28;
      return `<text x="48" y="${y}" font-family="system-ui, sans-serif" font-size="15" fill="#64748b">${escapeXml(t)}</text>`;
    })
    .join("\n");
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#0f172a" flood-opacity="0.08"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="40" y="40" width="${w - 80}" height="${h - 80}" rx="20" fill="#ffffff" filter="url(#sh)" stroke="#e2e8f0"/>
  <rect x="40" y="40" width="${w - 80}" height="56" rx="20" fill="#003159"/>
  <text x="56" y="78" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#ffffff">${escapeXml(title)}</text>
  <text x="56" y="130" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#0f172a">${escapeXml(subtitle)}</text>
  ${lines}
</svg>`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function writeWebp(outDir, name, w, h, svg) {
  const buf = await sharp(Buffer.from(svg)).webp({ quality: 88 }).toBuffer();
  const dest = path.join(outDir, name);
  await fs.promises.writeFile(dest, buf);
  console.log("wrote", path.relative(path.join(__dirname, ".."), dest));
}

/** @param {string} slug @param {{ cards: Array<{ file: string, w: number, h: number, title: string, subtitle: string, bodyLines?: string[] }>, readme: string }} spec */
async function generateSet(slug, spec) {
  const outDir = path.join(publicRoot, slug);
  await fs.promises.mkdir(outDir, { recursive: true });

  for (const card of spec.cards) {
    await writeWebp(
      outDir,
      card.file,
      card.w,
      card.h,
      svgCard({
        w: card.w,
        h: card.h,
        title: card.title,
        subtitle: card.subtitle,
        bodyLines: card.bodyLines ?? [],
      })
    );
  }

  await fs.promises.writeFile(path.join(outDir, "README.md"), spec.readme.trim() + "\n");
  console.log("wrote", path.join("public", "marketing", "updates", slug, "README.md"));
}

const SETS = {
  "ask-mode": {
    cards: [
      {
        file: "cover.webp",
        w: 1200,
        h: 630,
        title: "Lerno · Product update",
        subtitle: "Ask Mode — NCERT-grounded chat",
        bodyLines: ["Replace with a real 1200×630 hero from the app (Ask home or chat)."],
      },
      {
        file: "01-chat-shell.webp",
        w: 1200,
        h: 675,
        title: "Placeholder · replace with screenshot",
        subtitle: "Ask Mode — chat shell & composer",
        bodyLines: [
          "Capture: full Ask layout (thread, message list, input, send).",
          "Export WebP ~1200px wide, same filename to swap in place.",
        ],
      },
      {
        file: "02-chapter-scope.webp",
        w: 1200,
        h: 600,
        title: "Placeholder · replace with screenshot",
        subtitle: "Subject & chapter scope",
        bodyLines: ["Capture: grade / subject / chapter as students see it for the session."],
      },
    ],
    readme: `
# Ask Mode — images (3 total)

Folder: \`public/marketing/updates/ask-mode/\` → URLs \`/marketing/updates/ask-mode/...\`

| File | Replace with |
|------|----------------|
| \`cover.webp\` | Hero under the update title (~1200×630 WebP). |
| \`01-chat-shell.webp\` | In-post: full Ask UI (thread + composer). |
| \`02-chapter-scope.webp\` | In-post: grade / subject / chapter scope. |

**Export:** WebP ~0.8 quality, max width 1200px.

\`\`\`bash
npm run generate:update-placeholders
\`\`\`
`,
  },
  "study-feed": {
    cards: [
      {
        file: "cover.webp",
        w: 1200,
        h: 630,
        title: "Lerno · Product update",
        subtitle: "Study Feed — snap-to-card practice",
        bodyLines: ["Replace with a real hero: feed open full-bleed or first question card."],
      },
      {
        file: "01-feed-card.webp",
        w: 1200,
        h: 675,
        title: "Placeholder · replace with screenshot",
        subtitle: "Study Feed — question card",
        bodyLines: [
          "Capture: one full card (stem, options or short-answer, primary CTA).",
          "Optional: slight peek of the next card for snap-scroll context.",
        ],
      },
      {
        file: "02-filters-session.webp",
        w: 1200,
        h: 600,
        title: "Placeholder · replace with screenshot",
        subtitle: "Filters & session",
        bodyLines: ["Capture: filter sheet or chips + session bar / streak if visible."],
      },
    ],
    readme: `
# Study Feed — images (3 total)

Folder: \`public/marketing/updates/study-feed/\` → URLs \`/marketing/updates/study-feed/...\`

| File | Replace with |
|------|----------------|
| \`cover.webp\` | Hero (~1200×630): feed landing or dominant first card. |
| \`01-feed-card.webp\` | In-post: single practice card (MCQ or short answer). |
| \`02-filters-session.webp\` | In-post: filters (subject, chapter, type) and/or session UI. |

**Export:** WebP ~0.8 quality, max width 1200px.

\`\`\`bash
npm run generate:update-placeholders
\`\`\`
`,
  },
};

async function main() {
  const arg = process.argv[2];
  const slugs = arg && SETS[arg] ? [arg] : Object.keys(SETS);
  for (const slug of slugs) {
    const spec = SETS[slug];
    if (!spec) {
      console.error("Unknown slug:", arg);
      process.exit(1);
    }
    await generateSet(slug, spec);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
