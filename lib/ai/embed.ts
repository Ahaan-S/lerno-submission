import OpenAI from "openai";

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required");
  return new OpenAI({ apiKey: key });
}

/** Embed text with text-embedding-3-small (1536 dimensions) */
export async function embed(text: string): Promise<number[]> {
  console.log("[embed] Input text:", text.slice(0, 200) + (text.length > 200 ? "..." : ""));
  const res = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  const vec = res.data[0]?.embedding;
  if (!vec) throw new Error("Empty embedding response");
  console.log("[embed] Embedding created, dimensions:", vec.length, "| first 5 values:", vec.slice(0, 5));
  return vec;
}
