/**
 * One-time migration: copies all vectors from Qdrant Cloud (qdrant.tech) to the new
 * self-hosted GCP instance.
 *
 * Usage:
 *   OLD_QDRANT_URL=https://xxx.qdrant.io \
 *   OLD_QDRANT_API_KEY=your-old-key \
 *   NEW_QDRANT_URL=http://INTERNAL_VM_IP:6333 \
 *   NEW_QDRANT_API_KEY=your-new-key \
 *   npx tsx scripts/migrate-qdrant.ts
 *
 * Or open an SSH tunnel first (if running from local machine):
 *   gcloud compute ssh lerno-qdrant --zone=asia-south1-a -- -L 6334:localhost:6333
 * Then use NEW_QDRANT_URL=http://localhost:6334
 *
 * Safe to re-run — uses upsert so duplicates are overwritten, not doubled.
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const OLD_URL = process.env.OLD_QDRANT_URL;
const OLD_KEY = process.env.OLD_QDRANT_API_KEY;
const NEW_URL = process.env.NEW_QDRANT_URL;
const NEW_KEY = process.env.NEW_QDRANT_API_KEY;

if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY) {
  console.error(
    "Missing env vars. Required:\n  OLD_QDRANT_URL, OLD_QDRANT_API_KEY, NEW_QDRANT_URL, NEW_QDRANT_API_KEY"
  );
  process.exit(1);
}

const BATCH_SIZE = 100;

const oldClient = new QdrantClient({ url: OLD_URL, apiKey: OLD_KEY });
const newClient = new QdrantClient({ url: NEW_URL, apiKey: NEW_KEY });

function normalizeOffset(value: unknown): string | number | null {
  if (typeof value === "string" || typeof value === "number") return value;
  // Some deployments can return bigint IDs; serialize for next scroll call.
  if (typeof value === "bigint") return value.toString();
  return null;
}

async function migrateCollection(name: string) {
  console.log(`\n── Migrating collection: ${name} ──`);

  // Get collection info from old instance
  const info = await oldClient.getCollection(name);
  const vectorsConfig = info.config?.params?.vectors;

  if (!vectorsConfig) {
    console.warn(`  Skipping ${name} — could not read vector config`);
    return;
  }

  // Check if collection already exists on new instance
  const collections = await newClient.getCollections();
  const exists = collections.collections.some((c) => c.name === name);

  if (exists) {
    console.log(`  Collection exists on destination — will upsert into it (no data loss)`);
  } else {
    console.log(`  Creating collection on destination...`);
    await newClient.createCollection(name, { vectors: vectorsConfig });
  }

  // Scroll through all points in batches
  let offset: string | number | null = null;
  let totalCopied = 0;
  let batchNum = 0;

  while (true) {
    const scrollParams: Record<string, unknown> = {
      limit: BATCH_SIZE,
      with_vector: true,   // Qdrant REST API uses singular "with_vector"
      with_payload: true,
    };
    if (offset !== null) scrollParams.offset = offset;

    const result = await oldClient.scroll(name, scrollParams);
    const points = result.points;

    if (points.length === 0) break;

    // Filter out points with missing vectors (shouldn't happen but guards against bad data)
    const validPoints = points.filter((p) => p.vector != null);
    if (validPoints.length < points.length) {
      console.warn(`  Skipped ${points.length - validPoints.length} points with no vector`);
    }
    if (validPoints.length === 0) {
      const nextOffset2 = result.next_page_offset;
      offset = normalizeOffset(nextOffset2);
      if (offset === null) break;
      continue;
    }

    // Upsert batch into new instance
    await newClient.upsert(name, {
      wait: true,
      points: validPoints.map((p) => ({
        id: p.id,
        vector: p.vector as number[] | Record<string, number[]>,
        payload: p.payload ?? {},
      })),
    });

    totalCopied += points.length;
    batchNum++;
    process.stdout.write(`\r  Batch ${batchNum}: ${totalCopied} points copied...`);

    const nextOffset = result.next_page_offset;
    offset = normalizeOffset(nextOffset);
    if (offset === null) break;
  }

  console.log(`\n  Done: ${totalCopied} points migrated for ${name}`);

  // Verify count matches
  const oldInfo = await oldClient.getCollection(name);
  const newInfo = await newClient.getCollection(name);
  const oldCount = oldInfo.points_count ?? 0;
  const newCount = newInfo.points_count ?? 0;

  if (oldCount === newCount) {
    console.log(`  Count matches: ${newCount} ✓`);
  } else {
    console.warn(`  Count mismatch! Old: ${oldCount}, New: ${newCount} — re-run to retry`);
  }
}

async function main() {
  console.log(`Source:      ${OLD_URL}`);
  console.log(`Destination: ${NEW_URL}`);

  // List all collections on the old instance
  const { collections } = await oldClient.getCollections();
  console.log(`\nFound ${collections.length} collection(s): ${collections.map((c) => c.name).join(", ")}`);

  for (const col of collections) {
    await migrateCollection(col.name);
  }

  console.log("\n✅ Migration complete.");
  console.log("\nNext step: re-create indexes on new instance:");
  console.log("  NEW_QDRANT_URL=http://... NEW_QDRANT_API_KEY=... npm run qdrant:setup");
}

main().catch((err) => {
  console.error("\n❌ Migration failed:", err);
  process.exit(1);
});
