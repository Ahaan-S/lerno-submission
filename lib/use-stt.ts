"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Public interface ──────────────────────────────────────────────────────────

export interface UseSTTOptions {
  /**
   * Called with the final transcript text when transcription succeeds.
   * The caller is responsible for injecting it into the input field.
   */
  onTranscript: (text: string) => void;
  /**
   * BCP-47 language code sent to the API.
   * Default: "unknown" — the server auto-detects the language from the audio.
   * Pass a specific code when the session language is already known.
   */
  language?: string;
  /**
   * Maximum recording duration in milliseconds before auto-stop.
   * Default: 60 000 ms (60 seconds). The Sarvam REST STT endpoint works best
   * with short clips (≤30 s), but we allow up to 60 s to give users
   * flexibility; longer recordings are still sent as a single request.
   */
  maxDurationMs?: number;
  /**
   * MediaDevices deviceId for the preferred microphone.
   * When unset the browser picks the default input device.
   */
  deviceId?: string;
}

export interface UseSTTReturn {
  /** True while the microphone is open and audio is being captured. */
  isRecording: boolean;
  /** True while the audio is being uploaded and transcribed server-side. */
  isTranscribing: boolean;
  /**
   * Request microphone access and start recording.
   * Rejects if the user denies mic permission or if the browser does not
   * support MediaRecorder / getUserMedia.
   */
  startRecording: () => Promise<void>;
  /**
   * Stop recording and submit the captured audio for transcription.
   * No-op if not currently recording.
   */
  stopRecording: () => void;
  /**
   * Abort recording or an in-flight transcription request without emitting
   * a transcript. Call this when the user presses Escape or when the
   * component unmounts while recording.
   */
  cancelRecording: () => void;
  /** Non-null when the last operation failed. Cleared on the next start. */
  error: string | null;
  /** The live MediaStream while recording is active; null otherwise. Useful for audio visualisation. */
  stream: MediaStream | null;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_MAX_DURATION_MS = 60_000;

// Prefer these MIME types in order; fall back to the browser default.
const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

/**
 * Production-grade STT hook backed by the Sarvam saaras:v3 API.
 *
 * Features:
 * - getUserMedia + MediaRecorder — works in Chrome, Firefox, and Safari.
 * - Click-to-toggle: call startRecording() to begin, stopRecording() to
 *   finalise and transcribe, cancelRecording() to discard.
 * - Auto-stop after maxDurationMs to keep clips within API limits.
 * - AbortController — cancels in-flight network requests on cancel/unmount.
 * - Full stream/track cleanup on every exit path to release the mic indicator.
 * - Error messages surfaced to the UI via the `error` field.
 *
 * Usage:
 *   const { isRecording, isTranscribing, startRecording, stopRecording, cancelRecording, error } = useSTT({
 *     onTranscript: (text) => setInputValue((prev) => prev + (prev ? " " : "") + text),
 *   });
 */
export function useSTT({
  onTranscript,
  language,
  maxDurationMs = DEFAULT_MAX_DURATION_MS,
  deviceId,
}: UseSTTOptions): UseSTTReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);

  // Mutable refs — accessible inside async callbacks without stale closure issues.
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRecordingRef = useRef(false);

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Stops and releases the microphone stream (turns off the browser mic indicator). */
  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActiveStream(null);
  }, []);

  /** Clears the auto-stop timer. */
  const clearAutoStopTimer = useCallback(() => {
    if (autoStopTimerRef.current !== null) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  }, []);

  /**
   * Tears down all recording resources without touching React state.
   * Safe to call from any context.
   */
  const teardown = useCallback(() => {
    clearAutoStopTimer();
    abortRef.current?.abort();
    abortRef.current = null;

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    chunksRef.current = [];

    releaseStream();
    isRecordingRef.current = false;
  }, [clearAutoStopTimer, releaseStream]);

  // ── Transcription ─────────────────────────────────────────────────────────

  /**
   * Builds the audio blob, POSTs it to /api/stt, and calls onTranscript.
   * Called automatically by the MediaRecorder's onstop event after stopRecording().
   */
  const submitForTranscription = useCallback(
    async (chunks: BlobPart[], mimeType: string) => {
      if (!chunks.length) {
        setIsTranscribing(false);
        setError("No audio captured. Please try again.");
        return;
      }

      const blob = new Blob(chunks, { type: mimeType || "audio/webm" });

      // Guard: reject obviously empty blobs (below 500 bytes is almost certainly silence).
      if (blob.size < 500) {
        setIsTranscribing(false);
        setError("Recording was too short. Please speak and try again.");
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      const form = new FormData();
      form.append("audio", blob, `recording.${blobExtension(blob.type)}`);
      if (language) form.append("language", language);

      try {
        const res = await fetch("/api/stt", {
          method: "POST",
          body: form,
          signal: controller.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null) as { error?: string } | null;
          throw new Error(errData?.error ?? `STT request failed (HTTP ${res.status})`);
        }

        const data = (await res.json()) as { transcript: string; language_code: string | null };

        if (!data.transcript?.trim()) {
          throw new Error("No speech detected. Please try again.");
        }

        onTranscript(data.transcript.trim());
        setError(null);
      } catch (err) {
        if ((err as Error).name === "AbortError") return; // Cancelled intentionally — swallow silently.
        console.error("[useSTT]", err);
        setError((err as Error).message ?? "Transcription failed. Please try again.");
      } finally {
        abortRef.current = null;
        setIsTranscribing(false);
      }
    },
    [language, onTranscript],
  );

  // ── Public API ────────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;

    // Reset error and stale state.
    setError(null);

    // ── Microphone access ─────────────────────────────────────────────────
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Ask for a 16 kHz mono channel — optimal for Sarvam's STT models.
          sampleRate: { ideal: 16000 },
          channelCount: { ideal: 1 },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
      });
    } catch (err) {
      const domErr = err as DOMException;
      if (domErr.name === "NotAllowedError" || domErr.name === "PermissionDeniedError") {
        setError("Microphone access was denied. Please allow it in your browser settings.");
      } else if (domErr.name === "NotFoundError" || domErr.name === "DevicesNotFoundError") {
        setError("No microphone found. Please connect one and try again.");
      } else {
        setError("Could not access your microphone. Please try again.");
      }
      return;
    }

    streamRef.current = stream;
    setActiveStream(stream);

    // ── MediaRecorder setup ───────────────────────────────────────────────
    const mimeType = PREFERRED_MIME_TYPES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      releaseStream();
      setError("Your browser does not support audio recording. Please use Chrome or Firefox.");
      return;
    }

    const capturedChunks: BlobPart[] = [];
    chunksRef.current = capturedChunks;
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) capturedChunks.push(e.data);
    };

    recorder.onstop = () => {
      clearAutoStopTimer();
      releaseStream();
      recorderRef.current = null;
      isRecordingRef.current = false;
      setIsRecording(false);

      // Only transcribe if this stop was intentional (not cancelled).
      // abortRef being null at this point means cancel was NOT called.
      if (abortRef.current === null) {
        setIsTranscribing(true);
        void submitForTranscription(capturedChunks, mimeType);
      }
    };

    recorder.onerror = () => {
      teardown();
      setIsRecording(false);
      setIsTranscribing(false);
      setError("An error occurred during recording. Please try again.");
    };

    // Collect data every second so the final chunk arrives quickly on stop.
    recorder.start(1000);
    isRecordingRef.current = true;
    setIsRecording(true);

    // ── Auto-stop ─────────────────────────────────────────────────────────
    autoStopTimerRef.current = setTimeout(() => {
      if (recorderRef.current && recorderRef.current.state === "recording") {
        recorderRef.current.stop();
      }
    }, maxDurationMs);
  }, [deviceId, maxDurationMs, releaseStream, submitForTranscription, teardown]);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current || !recorderRef.current) return;
    clearAutoStopTimer();

    if (recorderRef.current.state === "recording") {
      // onstop fires asynchronously → sets isRecording=false and triggers transcription.
      recorderRef.current.stop();
    }
  }, [clearAutoStopTimer]);

  const cancelRecording = useCallback(() => {
    // Set a sentinel AbortController before calling teardown() so that
    // onstop (if it fires after teardown) skips transcription.
    abortRef.current = new AbortController();
    abortRef.current.abort();

    teardown();
    setIsRecording(false);
    setIsTranscribing(false);
    setError(null);
  }, [teardown]);

  // Clean up everything on unmount.
  useEffect(() => () => {
    // Abort any in-flight request.
    abortRef.current?.abort();
    teardown();
  }, [teardown]);

  return { isRecording, isTranscribing, startRecording, stopRecording, cancelRecording, error, stream: activeStream };
}

// ── Private helpers ───────────────────────────────────────────────────────────

function blobExtension(mimeType: string): string {
  const mime = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  const map: Record<string, string> = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "mp4",
    "audio/x-m4a": "m4a",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "video/webm": "webm",
  };
  return map[mime] ?? "webm";
}
