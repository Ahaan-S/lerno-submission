/**
 * Sarvam AI Speech-to-Text client.
 *
 * Server-side only — never import this module from a client component.
 * All provider-specific logic lives here; to swap STT providers, only this
 * file needs to change.
 *
 * Docs: https://docs.sarvam.ai/api-reference-docs/speech-to-text/transcribe
 * Model: saaras:v3 (state-of-the-art, 23 languages, multi-mode)
 */

const SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text";

// ── Public types ─────────────────────────────────────────────────────────────

/**
 * BCP-47 language codes supported by saaras:v3.
 * Use "unknown" to let the API auto-detect the language.
 */
export type SarvamSTTLanguageCode =
  | "unknown"
  | "en-IN"
  | "hi-IN"
  | "bn-IN"
  | "gu-IN"
  | "kn-IN"
  | "ml-IN"
  | "mr-IN"
  | "od-IN"
  | "pa-IN"
  | "ta-IN"
  | "te-IN"
  // saaras:v3 additional languages
  | "as-IN"
  | "ur-IN"
  | "ne-IN"
  | "kok-IN"
  | "ks-IN"
  | "sd-IN"
  | "sa-IN"
  | "sat-IN"
  | "mni-IN"
  | "brx-IN"
  | "mai-IN"
  | "doi-IN";

export type SarvamSTTModel = "saarika:v2.5" | "saaras:v3";

/**
 * Output mode — only applicable when model is saaras:v3.
 * - transcribe: Standard transcription in the original language (default).
 * - translate:  Translates Indic speech to English.
 * - verbatim:   Word-for-word, no normalization.
 * - translit:   Romanization to Latin script.
 * - codemix:    English words in English, Indic words in native script.
 */
export type SarvamSTTMode = "transcribe" | "translate" | "verbatim" | "translit" | "codemix";

/**
 * Configuration for Sarvam STT transcription.
 * All fields are optional — sensible defaults are applied.
 */
export interface SarvamSTTConfig {
  /**
   * BCP-47 language code of the spoken audio.
   * Default: "unknown" (API auto-detects from the audio).
   * Set explicitly when you know the language to skip detection and improve
   * accuracy — useful when the session language is already known.
   */
  language?: SarvamSTTLanguageCode;
  /**
   * Model to use. Default: "saaras:v3" — highest accuracy, 23 languages.
   * Fall back to "saarika:v2.5" only if v3 is unavailable.
   */
  model?: SarvamSTTModel;
  /**
   * Transcription mode. Only relevant for saaras:v3.
   * Default: "transcribe" — proper formatting and number normalization.
   */
  mode?: SarvamSTTMode;
}

/** Successful transcription response from Sarvam. */
export interface SarvamSTTResponse {
  /** The transcribed text. Empty string if no speech was detected. */
  transcript: string;
  /**
   * BCP-47 code of the detected/spoken language.
   * null when a specific language_code was provided (detection is skipped).
   */
  language_code: string | null;
  /**
   * Confidence probability (0.0–1.0) of the detected language.
   * Only present when language_code was "unknown" or omitted.
   */
  language_probability: number | null;
}

// ── Internal types (Sarvam wire format) ─────────────────────────────────────

interface SarvamSTTErrorResponse {
  error: {
    request_id: string | null;
    message: string;
    code: string;
  };
}

interface SarvamSTTSuccessResponse {
  request_id: string | null;
  transcript: string;
  language_code: string | null;
  language_probability: number | null;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS = {
  language: "unknown" as SarvamSTTLanguageCode,
  model: "saaras:v3" as SarvamSTTModel,
  mode: "transcribe" as SarvamSTTMode,
} satisfies Required<SarvamSTTConfig>;

// ── Custom error ─────────────────────────────────────────────────────────────

export class SarvamSTTError extends Error {
  constructor(
    message: string,
    /** The HTTP status code returned by the Sarvam API (or 500 for internal issues). */
    public readonly status: number,
    /** Sarvam-specific error code, if available. */
    public readonly code?: string,
  ) {
    super(message);
    this.name = "SarvamSTTError";
  }
}

// ── Core implementation ──────────────────────────────────────────────────────

/**
 * Transcribes speech audio using the Sarvam STT API.
 *
 * Sends the audio blob as multipart/form-data. The API accepts WAV, MP3,
 * AAC, OGG, OPUS, FLAC, MP4/M4A, WebM, and PCM formats — making it
 * compatible with whatever codec MediaRecorder produces in the browser
 * (webm/opus on Chromium, mp4/aac on Safari).
 *
 * @throws {SarvamSTTError} When the API key is missing, a network error
 *   occurs, or Sarvam returns a non-2xx response.
 */
export async function transcribeSpeech(
  audioBlob: Blob,
  config: SarvamSTTConfig = {},
): Promise<SarvamSTTResponse> {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    throw new SarvamSTTError("SARVAM_API_KEY environment variable is not set", 500);
  }

  const resolvedConfig: Required<SarvamSTTConfig> = { ...DEFAULTS, ...config };

  // Build multipart/form-data — Node 18+ fetch supports FormData natively.
  const form = new FormData();

  // Strip codec parameters from the MIME type before sending.
  // MediaRecorder reports "audio/webm;codecs=opus", but Sarvam's API only
  // accepts the base MIME type (e.g. "audio/webm") and returns HTTP 400 for
  // anything with a codec suffix. Re-wrapping in a new Blob replaces the
  // Content-Type that fetch embeds in the multipart part header.
  const baseMime = audioBlob.type.split(";")[0]?.trim() || "audio/webm";
  const cleanedBlob = new Blob([audioBlob], { type: baseMime });
  const ext = blobExtension(baseMime);
  form.append("file", cleanedBlob, `recording.${ext}`);
  form.append("model", resolvedConfig.model);
  form.append("mode", resolvedConfig.mode);

  // Only send language_code when it is not "unknown" — omitting it entirely
  // triggers Sarvam's language auto-detection, which is what we want for the
  // default case, and also what the API does when language_code is absent.
  if (resolvedConfig.language !== "unknown") {
    form.append("language_code", resolvedConfig.language);
  }

  const response = await fetch(SARVAM_STT_URL, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey,
      // Do NOT set Content-Type here — fetch sets it automatically with the
      // correct multipart boundary when body is FormData.
    },
    body: form,
  });

  if (!response.ok) {
    let errorCode: string | undefined;
    let errorMessage = `Sarvam STT API error: HTTP ${response.status}`;

    try {
      const errBody = (await response.json()) as SarvamSTTErrorResponse;
      errorMessage = errBody.error?.message ?? errorMessage;
      errorCode = errBody.error?.code;
    } catch {
      // Ignore parse errors; use the default message above
    }

    throw new SarvamSTTError(errorMessage, response.status, errorCode);
  }

  const data = (await response.json()) as SarvamSTTSuccessResponse;

  return {
    transcript: data.transcript ?? "",
    language_code: data.language_code ?? null,
    language_probability: data.language_probability ?? null,
  };
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Maps a MIME type to a file extension so the Sarvam API can identify the
 * audio codec. Falls back to "webm" which is the most common browser output.
 */
function blobExtension(mimeType: string): string {
  const mime = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  const map: Record<string, string> = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "mp4",
    "audio/x-m4a": "m4a",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/flac": "flac",
    "audio/aac": "aac",
    "video/webm": "webm", // MediaRecorder sometimes reports video/webm
  };
  return map[mime] ?? "webm";
}
