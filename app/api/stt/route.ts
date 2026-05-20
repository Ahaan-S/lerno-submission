import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { transcribeSpeech, SarvamSTTError } from "@/lib/stt/sarvam";
import type { SarvamSTTLanguageCode } from "@/lib/stt/sarvam";

/** Maximum audio upload size: 10 MB. Sarvam's REST endpoint works best with short clips. */
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/** Minimum audio size — anything smaller is almost certainly empty/corrupt. */
const MIN_AUDIO_BYTES = 100;

/**
 * POST /api/stt
 *
 * Transcribes recorded speech via Sarvam's saaras:v3 STT API.
 * Accepts multipart/form-data with an audio blob from the browser's
 * MediaRecorder (webm/opus on Chromium, mp4/aac on Safari).
 *
 * Request body (multipart/form-data):
 *   audio    — the recorded audio blob (required)
 *   language — BCP-47 language code; omit or "unknown" for auto-detect
 *
 * Response (200):
 *   { transcript: string; language_code: string | null }
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

  // ── Parse multipart/form-data ─────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart/form-data body" }, { status: 400 });
  }

  // ── Validate audio field ──────────────────────────────────────────────────
  const audioField = formData.get("audio");

  if (!audioField || !(audioField instanceof Blob)) {
    return NextResponse.json(
      { error: "'audio' field is required and must be a binary blob" },
      { status: 400 },
    );
  }

  if (audioField.size < MIN_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Audio clip is too short or empty" },
      { status: 400 },
    );
  }

  if (audioField.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: `Audio exceeds the maximum allowed size of ${MAX_AUDIO_BYTES / 1024 / 1024} MB` },
      { status: 400 },
    );
  }

  // Reject non-audio MIME types to catch obvious client mistakes.
  // Allow empty/generic MIME types since some browsers report "application/octet-stream".
  const mime = audioField.type.toLowerCase();
  if (mime && !mime.startsWith("audio/") && !mime.startsWith("video/") && mime !== "application/octet-stream") {
    return NextResponse.json(
      { error: `Unsupported MIME type: ${audioField.type}` },
      { status: 400 },
    );
  }

  // ── Validate optional language field ─────────────────────────────────────
  const languageField = formData.get("language");
  const language = typeof languageField === "string" ? languageField.trim() : undefined;

  // ── Transcription ─────────────────────────────────────────────────────────
  try {
    console.log(
      `[stt] Transcribing ${(audioField.size / 1024).toFixed(1)} KB audio` +
      ` (${audioField.type || "unknown mime"}) for user ${user.id}`,
    );

    const result = await transcribeSpeech(audioField, {
      language: (language as SarvamSTTLanguageCode | undefined) ?? "unknown",
    });

    if (!result.transcript.trim()) {
      // Sarvam returned an empty transcript — audio was silent or too noisy.
      return NextResponse.json(
        { error: "No speech detected in the recording. Please try again." },
        { status: 422 },
      );
    }

    console.log(
      `[stt] Transcribed successfully for user ${user.id}` +
      (result.language_code ? ` (detected: ${result.language_code})` : ""),
    );

    return NextResponse.json({
      transcript: result.transcript,
      language_code: result.language_code,
    });
  } catch (err) {
    if (err instanceof SarvamSTTError) {
      console.error("[stt] Sarvam API error:", err.message, { code: err.code, status: err.status });

      if (err.status === 429) {
        return NextResponse.json(
          { error: "STT quota exceeded. Please try again in a moment." },
          { status: 429 },
        );
      }

      // Treat Sarvam API failures as 502 Bad Gateway to distinguish them
      // from our own application errors.
      return NextResponse.json({ error: err.message }, { status: 502 });
    }

    console.error("[stt] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
