/**
 * One-off diagnostic: verify NCERT Science chunks are retrievable with the same filters as the app.
 * Run: npx tsx scripts/qdrant-verify-science.ts
 */
import * as dotenv from "dotenv";
import { QdrantClient } from "@qdrant/js-client-rest";
import { buildNcertPayloadFilter } from "../lib/ai/qdrant";

// Load before any Qdrant calls (client in lib/ai/qdrant.ts is lazy-initialized on first use).
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const COLLECTION = "ncert_content";

async function main() {
  const url = process.env.QDRANT_URL ?? "http://localhost:6333";
  const apiKey = process.env.QDRANT_API_KEY;
  const client = new QdrantClient({ url, apiKey });

  const raw = await client.scroll(COLLECTION, { limit: 2, with_payload: true, with_vector: false });
  console.log("\n=== Raw sample (no filter) ===");
  for (const p of raw.points) {
    console.log("id:", p.id);
    console.log(JSON.stringify(p.payload, null, 2).slice(0, 2500));
  }

  console.log("QDRANT_URL:", url);
  console.log("Collection:", COLLECTION);

  try {
    const info = await client.getCollection(COLLECTION);
    console.log("Collection points count:", info.points_count);
  } catch (e) {
    console.error("getCollection failed:", e);
    process.exit(1);
  }

  const baseFilter = buildNcertPayloadFilter(10, "science", null);

  const byChapter = new Map<string, { name: string; sampleId: string; chapterRaw: unknown }>();
  let offset: string | number | undefined;
  let pages = 0;
  const maxPages = 200;

  while (pages < maxPages) {
    const res = await client.scroll(COLLECTION, {
      filter: baseFilter,
      limit: 256,
      with_payload: true,
      with_vector: false,
      ...(offset != null ? { offset } : {}),
    });
    pages++;
    for (const p of res.points) {
      const pl = (p.payload ?? {}) as Record<string, unknown>;
      const raw = pl.chapter_index;
      const ci = raw == null ? "" : String(raw);
      const cnRaw = pl.chapter_name;
      const cn = cnRaw == null ? "" : String(cnRaw);
      if (!ci) continue;
      if (!byChapter.has(ci)) {
        byChapter.set(ci, { name: cn, sampleId: String(p.id), chapterRaw: raw });
      }
    }
    const next = res.next_page_offset;
    if (!res.points.length || next == null) break;
    if (typeof next !== "string" && typeof next !== "number") break;
    offset = next;
  }

  const sorted = [...byChapter.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  console.log("\nDistinct chapter_index values in Qdrant (grade 10 Science), count:", sorted.length);
  for (const [idx, { name, sampleId, chapterRaw }] of sorted.slice(0, 30)) {
    console.log(
      `  chapter_index=${JSON.stringify(idx)} (payload type: ${typeof chapterRaw}) | name=${name.slice(0, 50)} | id=${sampleId}`
    );
  }
  if (sorted.length > 30) console.log(`  ... and ${sorted.length - 30} more`);

  for (const ch of ["1", "3", "13"]) {
    const f = buildNcertPayloadFilter(10, "science", ch);
    const r = await client.scroll(COLLECTION, {
      filter: f,
      limit: 5,
      with_payload: true,
      with_vector: false,
    });
    console.log(`\nScroll with chapter_index="${ch}": ${r.points.length} points (limit 5)`);
    if (r.points[0]) {
      const pl = r.points[0].payload as Record<string, unknown>;
      console.log("  first id:", r.points[0].id);
      console.log("  chapter_index:", pl.chapter_index, "type:", typeof pl.chapter_index);
      const content = String(pl.content ?? "").slice(0, 120);
      console.log("  content preview:", content.replace(/\n/g, " "));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
