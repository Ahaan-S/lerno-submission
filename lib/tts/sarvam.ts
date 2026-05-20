/**
 * Sarvam AI Text-to-Speech client.
 *
 * Server-side only — never import this module from a client component.
 * All provider-specific logic lives here; to swap TTS providers, only this
 * file needs to change.
 *
 * Docs: https://docs.sarvam.ai/api-reference-docs/text-to-speech/convert
 * Model: bulbul:v3 (30+ voices, 2500-char limit, Indian languages + English)
 */

const SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech";

// ── Public types ─────────────────────────────────────────────────────────────

export type SarvamLanguageCode =
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
  | "te-IN";

/** Voices available for bulbul:v3. */
export type SarvamSpeaker =
  | "shubh" | "aditya" | "ritu" | "priya" | "neha" | "rahul" | "pooja"
  | "rohan" | "simran" | "kavya" | "amit" | "dev" | "ishita" | "shreya"
  | "ratan" | "varun" | "manan" | "sumit" | "roopa" | "kabir" | "aayan"
  | "ashutosh" | "advait" | "amelia" | "sophia" | "anand" | "tanya" | "tarun"
  | "sunny" | "mani" | "gokul" | "vijay" | "shruti" | "suhani" | "mohit"
  | "kavitha" | "rehan" | "soham" | "rupali"
  // bulbul:v2 only — kept for future model-switching
  | "anushka" | "abhilash" | "manisha" | "vidya" | "arya" | "karun" | "hitesh";

export type SarvamModel = "bulbul:v3" | "bulbul:v2";

export type SarvamAudioCodec =
  | "wav" | "mp3" | "linear16" | "mulaw" | "alaw" | "opus" | "flac" | "aac";

export type SarvamSampleRate = 8000 | 16000 | 22050 | 24000 | 32000 | 44100 | 48000;

/**
 * Configuration for Sarvam TTS synthesis.
 * All fields are optional — sensible defaults are applied.
 */
export interface SarvamTTSConfig {
  /** BCP-47 language code. Default: "en-IN" (Indian English). */
  language?: SarvamLanguageCode;
  /** Speaker voice. Default: "anushka" — clear, neutral female voice. */
  speaker?: SarvamSpeaker;
  /** Model version. Default: "bulbul:v3". */
  model?: SarvamModel;
  /**
   * Speech pace multiplier. 0.5–2.0 for v3.
   * Default: 1.0 (natural speed).
   */
  pace?: number;
  /** Audio sample rate in Hz. Default: 22050. */
  speechSampleRate?: SarvamSampleRate;
  /** Output audio format. Default: "wav". */
  outputAudioCodec?: SarvamAudioCodec;
  /**
   * Temperature for expressiveness. 0.01–2.0.
   * Lower = more stable and consistent. Default: 0.5 (slightly conservative
   * for educational content where accuracy matters).
   */
  temperature?: number;
}

// ── Internal types (Sarvam wire format) ─────────────────────────────────────

interface SarvamTTSRequestBody {
  text: string;
  target_language_code: SarvamLanguageCode;
  model: SarvamModel;
  speaker: SarvamSpeaker;
  pace: number;
  speech_sample_rate: SarvamSampleRate;
  output_audio_codec: SarvamAudioCodec;
  temperature: number;
}

interface SarvamTTSSuccessResponse {
  request_id: string | null;
  audios: string[];
}

interface SarvamTTSErrorResponse {
  error: {
    request_id: string | null;
    message: string;
    code: string;
  };
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS = {
  model: "bulbul:v3" as SarvamModel,
  speaker: "shubh" as SarvamSpeaker,
  language: "en-IN" as SarvamLanguageCode,
  pace: 1.0,
  speechSampleRate: 22050 as SarvamSampleRate,
  outputAudioCodec: "wav" as SarvamAudioCodec,
  temperature: 0.5,
} satisfies Required<SarvamTTSConfig>;

// ── Custom error ─────────────────────────────────────────────────────────────

export class SarvamTTSError extends Error {
  constructor(
    message: string,
    /** The HTTP status code returned by the Sarvam API (or 500 for internal issues). */
    public readonly status: number,
    /** Sarvam-specific error code, if available. */
    public readonly code?: string,
  ) {
    super(message);
    this.name = "SarvamTTSError";
  }
}

// ── Core implementation ──────────────────────────────────────────────────────

/**
 * Sends a single text chunk to the Sarvam TTS API.
 * Returns a base64-encoded WAV audio string.
 */
async function synthesizeChunk(
  text: string,
  config: Required<SarvamTTSConfig>,
  apiKey: string,
): Promise<string> {
  const body: SarvamTTSRequestBody = {
    text,
    target_language_code: config.language,
    model: config.model,
    speaker: config.speaker,
    pace: config.pace,
    speech_sample_rate: config.speechSampleRate,
    output_audio_codec: config.outputAudioCodec,
    temperature: config.temperature,
  };

  const response = await fetch(SARVAM_TTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorCode: string | undefined;
    let errorMessage = `Sarvam TTS API error: HTTP ${response.status}`;

    try {
      const errBody = (await response.json()) as SarvamTTSErrorResponse;
      errorMessage = errBody.error?.message ?? errorMessage;
      errorCode = errBody.error?.code;
    } catch {
      // Ignore parse errors; use the default message above
    }

    throw new SarvamTTSError(errorMessage, response.status, errorCode);
  }

  const data = (await response.json()) as SarvamTTSSuccessResponse;

  const audio = data.audios?.[0];
  if (!audio) {
    throw new SarvamTTSError("Sarvam returned an empty audio payload", 500);
  }

  return audio;
}

/**
 * Synthesizes speech for an array of text chunks and returns a base64-encoded
 * audio string for each chunk (in the same order).
 *
 * Chunks are synthesized concurrently for minimal latency.
 *
 * @throws {SarvamTTSError} When the API key is missing, a network error
 *   occurs, or Sarvam returns a non-2xx response.
 */
export async function synthesizeSpeech(
  chunks: string[],
  config: SarvamTTSConfig = {},
): Promise<string[]> {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    throw new SarvamTTSError("SARVAM_API_KEY environment variable is not set", 500);
  }

  const resolvedConfig: Required<SarvamTTSConfig> = { ...DEFAULTS, ...config };

  return Promise.all(chunks.map((chunk) => synthesizeChunk(chunk, resolvedConfig, apiKey)));
}
