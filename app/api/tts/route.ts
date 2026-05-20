import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prepareTextForSpeech, splitIntoChunks } from "@/lib/tts/text-processor";
import { synthesizeSpeech, SarvamTTSError } from "@/lib/tts/sarvam";
import type { SarvamLanguageCode } from "@/lib/tts/sarvam";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

/** Hard cap on raw input length before cleaning. Prevents abuse. */
const MAX_RAW_TEXT_LEN = 20_000;

/**
 * POST /api/tts
 *
 * Converts AI-generated markdown text to speech via Sarvam's Bulbul v3 API.
 * Returns an array of base64-encoded WAV audio strings (one per chunk) that
 * the client plays sequentially.
 *
 * Request body:
 *   { text: string; language?: string }   — language defaults to "en-IN"
 *
 * Response (200):
 *   { audios: string[] }                  — base64-encoded WAV strings
 */
export async function POST(req: NextRequest) {
  // ── Authentication ────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const rl = await checkRateLimit(user.id, "tts");
  if (!rl.success) return rateLimitedResponse(rl.reset);

  // ── Parse & validate request body ────────────────────────────────────────
  let body: { text?: unknown; language?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text, language } = body;

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "'text' must be a non-empty string" }, { status: 400 });
  }

  if (text.length > MAX_RAW_TEXT_LEN) {
    return NextResponse.json(
      { error: `'text' exceeds the maximum allowed length of ${MAX_RAW_TEXT_LEN} characters` },
      { status: 400 },
    );
  }

  if (language !== undefined && typeof language !== "string") {
    return NextResponse.json({ error: "'language' must be a string" }, { status: 400 });
  }

  // ── Text preparation ──────────────────────────────────────────────────────
  const cleaned = prepareTextForSpeech(text);
  const chunks = splitIntoChunks(cleaned);

  if (!chunks.length) {
    return NextResponse.json(
      { error: "No speakable content found after stripping markdown" },
      { status: 400 },
    );
  }

  // ── Synthesis ─────────────────────────────────────────────────────────────
  try {
    console.log(`[tts] Synthesizing ${chunks.length} chunk(s) for user ${user.id}`);

    const audios = await synthesizeSpeech(chunks, {
      language: (language as SarvamLanguageCode | undefined) ?? "en-IN",
    });

    return NextResponse.json({ audios });
  } catch (err) {
    if (err instanceof SarvamTTSError) {
      console.error("[tts] Sarvam API error:", err.message, { code: err.code, status: err.status });

      if (err.status === 429) {
        return NextResponse.json(
          { error: "TTS quota exceeded. Please try again in a moment." },
          { status: 429 },
        );
      }

      // Treat Sarvam API failures as a 502 Bad Gateway to distinguish them
      // from our own application errors.
      return NextResponse.json({ error: err.message }, { status: 502 });
    }

    console.error("[tts] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
