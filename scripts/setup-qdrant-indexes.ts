import { QdrantClient } from "@qdrant/js-client-rest";
import * as dotenv from "dotenv";
// Load .env first, then .env.local (overrides)
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const client = new QdrantClient({
  url: process.env.QDRANT_URL ?? "http://localhost:6333",
  apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION = "ncert_content";

async function setupIndexes() {
  console.log("Creating payload indexes for:", COLLECTION);

  // grade — stored as string e.g. "10"
  await client.createPayloadIndex(COLLECTION, {
    field_name: "grade",
    field_schema: "keyword",
  });
  console.log("✅ grade (keyword)");

  // subject — normalised string e.g. "Science"
  await client.createPayloadIndex(COLLECTION, {
    field_name: "subject",
    field_schema: "keyword",
  });
  console.log("✅ subject (keyword)");

  // chapter_index — stored as string e.g. "6"
  await client.createPayloadIndex(COLLECTION, {
    field_name: "chapter_index",
    field_schema: "keyword",
  });
  console.log("✅ chapter_index (keyword)");

  // topic_index — optional but enables server-side topic filters (otherwise we post-filter in app code)
  try {
    await client.createPayloadIndex(COLLECTION, {
      field_name: "topic_index",
      field_schema: "keyword",
    });
    console.log("✅ topic_index (keyword)");
  } catch (e) {
    console.warn("⚠️ topic_index index skipped or already exists:", (e as Error)?.message ?? e);
  }

  // content — full-text index for keyword/BM25-style search
  // This is the main text field in each NCERT chunk
  await client.createPayloadIndex(COLLECTION, {
    field_name: "content",
    field_schema: {
      type: "text",
      tokenizer: "word",
      min_token_len: 2,
      max_token_len: 40,
      lowercase: true,
    },
  });
  console.log("✅ content (full-text)");

  // topic_name — full-text indexed so match: { text: query } works
  // Catches queries like "Addition Reaction", "Ohm's Law", "Refraction of Light"
  // that appear only in topic_name, not in chunk content
  await client.createPayloadIndex(COLLECTION, {
    field_name: "topic_name",
    field_schema: {
      type: "text",
      tokenizer: "word",
      min_token_len: 2,
      max_token_len: 40,
      lowercase: true,
    },
  });
  console.log("✅ topic_name (full-text)");

  // subtopic_name — same reasoning; "Addition Reaction" is often a subtopic_name
  await client.createPayloadIndex(COLLECTION, {
    field_name: "subtopic_name",
    field_schema: {
      type: "text",
      tokenizer: "word",
      min_token_len: 2,
      max_token_len: 40,
      lowercase: true,
    },
  });
  console.log("✅ subtopic_name (full-text)");

  // Nested `metadata.{...}` shape (LangChain-style upserts) — same logical fields, dot paths
  const nestedKeyword = ["metadata.grade", "metadata.subject", "metadata.chapter_index"] as const;
  for (const field_name of nestedKeyword) {
    try {
      await client.createPayloadIndex(COLLECTION, {
        field_name,
        field_schema: "keyword",
      });
      console.log(`✅ ${field_name} (keyword)`);
    } catch (e) {
      console.warn(`⚠️ ${field_name} skipped or exists:`, (e as Error)?.message ?? e);
    }
  }
  try {
    await client.createPayloadIndex(COLLECTION, {
      field_name: "metadata.topic_index",
      field_schema: "keyword",
    });
    console.log("✅ metadata.topic_index (keyword)");
  } catch (e) {
    console.warn("⚠️ metadata.topic_index skipped or exists:", (e as Error)?.message ?? e);
  }
  for (const field_name of ["metadata.topic_name", "metadata.subtopic_name"] as const) {
    try {
      await client.createPayloadIndex(COLLECTION, {
        field_name,
        field_schema: {
          type: "text",
          tokenizer: "word",
          min_token_len: 2,
          max_token_len: 40,
          lowercase: true,
        },
      });
      console.log(`✅ ${field_name} (full-text)`);
    } catch (e) {
      console.warn(`⚠️ ${field_name} skipped or exists:`, (e as Error)?.message ?? e);
    }
  }

  console.log("\n🎉 All indexes created.");
  console.log("Learn mode filters match both flat payloads and metadata.* — indexes above cover both.");
}

setupIndexes().catch(console.error);
