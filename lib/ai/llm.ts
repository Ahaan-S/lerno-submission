/**
 * lib/ai/llm.ts
 * AI chat client — Google Gemini via OpenAI-compatible API.
 *
 * Auth (pick one):
 *   • Vertex AI — set GCP_PROJECT_ID + GCP_REGION, then either:
 *       – VERTEX_AI_API_KEY (or GOOGLE_API_KEY): key from Google Cloud → API Keys (Vertex AI), NOT AI Studio; or
 *       – GCP_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS: OAuth (recommended for production).
 *   • AI Studio (legacy): GEMINI_API_KEY only → generativelanguage.googleapis.com
 *
 * Models (defaults; override with GEMINI_* env):
 *   GEMINI_CHAT_MODEL / GEMINI_VISION_MODEL — tutor streaming, vision, grading, diagnostics (default: google/gemini-2.5-flash)
 *   GEMINI_LITE_MODEL — query rewriting only (default: google/gemini-2.5-flash; optional flash-lite in env where Vertex lists it)
 *
 * ⚠️  GROUNDING: tools:[] is sent on every request to disable Google Search grounding.
 *     Without this, the model may answer from the web instead of NCERT RAG chunks.
 */

import {
  getVertexAccessToken,
  getVertexChatCompletionsUrl,
  isVertexConfigured,
  isVertexServiceAccountConfigured,
} from "@/lib/ai/vertex-auth";

const GEMINI_STUDIO_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Defaults: Vertex OpenAI-compat IDs (`google/...`). AI Studio: set env to e.g. gemini-2.5-flash (no preview models in defaults).
const CHAT_MODEL   = process.env.GEMINI_CHAT_MODEL   ?? "google/gemini-2.5-flash";
// flash-lite is not available in all regions (e.g. asia-south1 OpenAI-compat); flash rewrites reliably.
const LITE_MODEL   = process.env.GEMINI_LITE_MODEL   ?? "google/gemini-2.5-flash";
const VISION_MODEL = process.env.GEMINI_VISION_MODEL ?? "google/gemini-2.5-flash";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentBlock[];
}

export interface ChatOptions {
  /** Override which model to use for this call */
  model?: string;
  /** Sampling temperature. Default: 0.7 for chat(), 0.5 for streamChat() */
  temperature?: number;
  /** Max completion tokens (learn-mode lessons need headroom; default 8192) */
  maxTokens?: number;
  /**
   * Vertex only: set Gemini thinking budget to 0 so the model emits normal text in
   * `message.content`. Without this, gemini-2.5-* can return empty content for short
   * utility calls (quiz scope, query rewrite) while spending tokens on internal reasoning.
   */
  thinkingBudget?: number;
  /**
   * Force JSON output via response_format: { type: "json_object" }.
   * Use for structured tasks like query rewriting.
   * The system prompt must also instruct the model to output JSON.
   */
  jsonMode?: boolean;
  /** When aborted (e.g. client disconnected), upstream fetch and token iteration stop */
  signal?: AbortSignal;
}

/** OpenAI-compat assistants may return `content` as a string or as an array of parts. */
function concatOpenAiMessageContent(content: unknown): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const item of content) {
    if (typeof item === "string") {
      parts.push(item);
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    if (typeof p.text === "string") parts.push(p.text);
    else if (typeof p.content === "string") parts.push(p.content);
  }
  return parts.join("");
}

/** Extract visible assistant text from a chat.completion choice (non-streaming). */
function openAiAssistantTextFromChoice(choice: unknown): string {
  if (!choice || typeof choice !== "object") return "";
  const ch = choice as Record<string, unknown>;
  const msg = ch.message;
  if (!msg || typeof msg !== "object") return "";
  const m = msg as Record<string, unknown>;
  let text = concatOpenAiMessageContent(m.content);
  if (!text && typeof m.reasoning_content === "string") text = m.reasoning_content;
  return text;
}

/** Returns true if any message contains an image_url content block */
export function hasImageContent(messages: ChatMessage[]): boolean {
  return messages.some((m) => {
    if (typeof m.content === "string") return false;
    return m.content.some((b) => b.type === "image_url");
  });
}

/**
 * Resolves which model to use.
 * @param hasImages - true if the messages include image content (use vision-capable model)
 * @param lite      - true for utility/lightweight tasks (query rewriting, etc.)
 */
export function resolveModel(hasImages: boolean, lite = false): string {
  if (hasImages) return VISION_MODEL;
  if (lite) return LITE_MODEL;
  return CHAT_MODEL;
}

function assertLlmConfigured(): void {
  if (isVertexConfigured()) return;
  if (GEMINI_API_KEY) return;
  throw new Error(
    "LLM not configured: set Vertex (GCP_PROJECT_ID, GCP_REGION, and VERTEX_AI_API_KEY or service account JSON / GOOGLE_APPLICATION_CREDENTIALS) or GEMINI_API_KEY (AI Studio)"
  );
}

/** JSON headers for POST. Vertex API key auth uses ?key= on URL (no Authorization). */
async function getLlmRequestHeaders(): Promise<Record<string, string>> {
  assertLlmConfigured();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (isVertexConfigured()) {
    if (isVertexServiceAccountConfigured()) {
      const token = await getVertexAccessToken();
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }
  headers.Authorization = `Bearer ${GEMINI_API_KEY!}`;
  return headers;
}

function chatCompletionsUrl(): string {
  if (isVertexConfigured()) {
    return getVertexChatCompletionsUrl();
  }
  return `${GEMINI_STUDIO_BASE}/chat/completions`;
}

function isTransientNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return ["EAI_AGAIN", "ENOTFOUND", "ECONNRESET", "ETIMEDOUT"].some((code) =>
    error.message.includes(code)
  );
}

/** Rate limits / capacity — safe to retry with backoff (Gemini often returns 503 when demand spikes). */
function isRetryableGeminiHttpError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const m = error.message.match(/Gemini (?:API |stream )?error (\d+)/);
  if (!m) return false;
  const code = parseInt(m[1], 10);
  return code === 429 || code === 503 || code === 529;
}

/** Non-streaming chat completion — for utility tasks (query rewriting, etc.) */
export async function chat(
  messages: ChatMessage[],
  options?: ChatOptions
): Promise<string> {
  const model = options?.model ?? LITE_MODEL;
  const temperature = options?.temperature ?? 0.7;
  console.log("[llm] chat() | model:", model, "| temp:", temperature, "| messages:", messages.length);

  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) console.log("[llm] chat() retry attempt", attempt + 1);

      const headers = await getLlmRequestHeaders();
      const maxTokens = options?.maxTokens;
      const thinkingBudget = options?.thinkingBudget;
      const response = await fetch(chatCompletionsUrl(), {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages,
          temperature,
          top_p: 1.0,
          ...(maxTokens != null && { max_tokens: maxTokens }),
          tools: [], // ⚠️ disables Google Search grounding — Lerno uses its own NCERT RAG pipeline
          ...(options?.jsonMode && { response_format: { type: "json_object" } }),
          ...(isVertexConfigured() &&
            thinkingBudget != null && {
              google: { thinking_config: { thinking_budget: thinkingBudget } },
            }),
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "unknown");
        throw new Error(`Gemini API error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const content = openAiAssistantTextFromChoice(data?.choices?.[0]);
      if (!content) {
        const fr = (data?.choices?.[0] as Record<string, unknown> | undefined)?.finish_reason;
        console.warn(
          "[llm] chat() empty assistant text | finish_reason:",
          fr,
          "| keys:",
          data?.choices?.[0] != null ? Object.keys(data.choices[0] as object).join(",") : "none"
        );
      } else {
        console.log("[llm] chat() response length:", content.length);
      }
      return content;
    } catch (error) {
      lastError = error;
      const retry =
        attempt < 2 &&
        (isTransientNetworkError(error) || isRetryableGeminiHttpError(error));
      if (!retry) throw error;
      const delayMs = 800 * (attempt + 1) ** 2;
      console.warn("[llm] chat() backing off", delayMs, "ms after:", (error as Error).message.slice(0, 120));
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini chat failed");
}

/** Single streaming attempt (no retries) — used by streamChat retry loop. */
async function* streamChatOnce(
  messages: ChatMessage[],
  options?: ChatOptions
): AsyncGenerator<string> {
  const model = options?.model ?? CHAT_MODEL;
  const temperature = options?.temperature ?? 0.5;
  const maxTokens = options?.maxTokens ?? 8192;

  const headers = await getLlmRequestHeaders();
  const signal = options?.signal;
  const response = await fetch(chatCompletionsUrl(), {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model,
      messages,
      temperature,
      top_p: 1.0,
      max_tokens: maxTokens,
      stream: true,
      tools: [],
    }),
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => "unknown");
    throw new Error(`Gemini stream error ${response.status}: ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    if (signal?.aborted) return;
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data);
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) yield token;
      } catch {
        // ignore malformed SSE lines
      }
    }
  }
}

/** Streaming chat completion — for main tutor responses */
export async function* streamChat(
  messages: ChatMessage[],
  options?: ChatOptions
): AsyncGenerator<string> {
  assertLlmConfigured();

  const model = options?.model ?? CHAT_MODEL;
  const temperature = options?.temperature ?? 0.5;
  const maxTokens = options?.maxTokens ?? 8192;
  console.log("[llm] streamChat() | model:", model, "| temp:", temperature, "| messages:", messages.length, "| max_tokens:", maxTokens);

  const maxAttempts = 4;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (attempt > 0) {
        const delayMs = 1000 * 2 ** (attempt - 1);
        console.warn("[llm] streamChat() retry attempt", attempt + 1, "after", delayMs, "ms");
        await new Promise((r) => setTimeout(r, delayMs));
      }
      yield* streamChatOnce(messages, { ...options, model, temperature, maxTokens });
      return;
    } catch (error) {
      lastError = error;
      const retry = attempt < maxAttempts - 1 && isRetryableGeminiHttpError(error);
      if (!retry) throw error;
      console.warn("[llm] streamChat() transient error:", (error as Error).message.slice(0, 160));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini stream failed");
}

/**
 * Non-streaming chat using Gemini Flash Lite (LITE_MODEL).
 * Use for fast, cheap classification calls where reasoning depth doesn't matter:
 * scope detection, edit detection, question selection.
 * Low temperature (0.1) and short output (1024 tokens) keep it fast and deterministic.
 */
export async function chatLite(
  messages: { role: "user" | "assistant" | "system"; content: string }[]
): Promise<string> {
  return chat(messages as ChatMessage[], {
    model: LITE_MODEL,
    temperature: 0.1,
    maxTokens: 1024,
    // Vertex: gemini-2.5-* may otherwise return empty `content` for short JSON tasks.
    thinkingBudget: isVertexConfigured() ? 0 : undefined,
  });
}

/**
 * Generate a brief educational description of an image for conversation history context.
 * Called at upload time so follow-up messages can reference the image as text
 * instead of re-sending image bytes on every turn.
 *
 * @param dataUrlOrSignedUrl - base64 data URL or https signed URL pointing to the image
 * @returns 2-3 sentence description, or empty string on failure
 */
export async function describeImage(dataUrlOrSignedUrl: string): Promise<string> {
  try {
    const result = await chat(
      [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this image in 2-3 sentences. Focus on educational content: any visible text, equations, diagrams, labels, charts, or key visual elements. Be specific and factual.",
            },
            { type: "image_url", image_url: { url: dataUrlOrSignedUrl, detail: "low" } },
          ],
        },
      ],
      {
        model: VISION_MODEL,
        temperature: 0.2,
        maxTokens: 200,
        thinkingBudget: isVertexConfigured() ? 0 : undefined,
      }
    );
    return result.trim();
  } catch (err) {
    console.warn("[llm] describeImage failed (non-fatal):", (err as Error).message?.slice(0, 120));
    return "";
  }
}
