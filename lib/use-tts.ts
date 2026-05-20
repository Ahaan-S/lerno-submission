"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Module-level audio cache ──────────────────────────────────────────────────
// Survives React re-renders and SPA navigation within the same page session.
// Keyed by the stable message id passed to speak().
// Stores raw ArrayBuffers so blob URLs can be re-created on demand (they
// are single-use and must be revoked after playback to avoid memory leaks).

const MAX_CACHE_ENTRIES = 30;
const audioCache = new Map<string, ArrayBuffer[]>();

function cacheSet(id: string, buffers: ArrayBuffer[]) {
  if (audioCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = audioCache.keys().next().value;
    if (oldest) audioCache.delete(oldest);
  }
  audioCache.set(id, buffers);
}

// ── Client-side text splitter ─────────────────────────────────────────────────
// Splits markdown text into paragraph-sized chunks (~500 chars each).
// Each chunk is sent as a separate /api/tts request so playback can start
// as soon as the first chunk is synthesised instead of waiting for all of them.
// The server handles markdown stripping per chunk.

const CHUNK_TARGET = 500;

function splitForTTS(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 5);

  if (!paragraphs.length) return [text.slice(0, CHUNK_TARGET * 8)];

  const chunks: string[] = [];
  let acc = "";

  for (const p of paragraphs) {
    const candidate = acc ? `${acc}\n\n${p}` : p;
    if (candidate.length > CHUNK_TARGET && acc) {
      chunks.push(acc);
      acc = p;
    } else {
      acc = candidate;
    }
  }
  if (acc) chunks.push(acc);

  return chunks;
}

// ── Fetch one paragraph from the TTS API ─────────────────────────────────────

async function fetchChunkBuffers(
  text: string,
  language: string | undefined,
  signal: AbortSignal,
): Promise<ArrayBuffer[]> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language }),
    signal,
  });

  if (!res.ok) {
    const errData = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errData?.error ?? `TTS request failed (HTTP ${res.status})`);
  }

  const { audios } = (await res.json()) as { audios: string[] };
  if (!audios?.length) throw new Error("Empty audio response from server");

  return audios.map((b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return bytes.buffer as ArrayBuffer;
  });
}

// ── Play a single ArrayBuffer as audio ───────────────────────────────────────

function playBuffer(
  buffer: ArrayBuffer,
  signal: AbortSignal,
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const blob = new Blob([buffer], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;

    const cleanup = () => URL.revokeObjectURL(url);

    const onAbort = () => {
      audio.pause();
      audio.src = "";
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    signal.addEventListener("abort", onAbort, { once: true });

    audio.onended = () => {
      signal.removeEventListener("abort", onAbort);
      cleanup();
      resolve();
    };

    audio.onerror = () => {
      signal.removeEventListener("abort", onAbort);
      cleanup();
      reject(new Error("Audio playback error"));
    };

    audio.play().catch((err: unknown) => {
      signal.removeEventListener("abort", onAbort);
      cleanup();
      reject(err);
    });
  });
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseTTSReturn {
  speak: (id: string, text: string, language?: string) => void;
  stop: () => void;
  speakingId: string | null;
  isLoading: boolean;
}

export function useTTS(): UseTTSReturn {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const speakingIdRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Two separate abort controllers:
  // - fetchAbortRef: aborted only when switching to a DIFFERENT message or unmounting.
  //   Lets background fetches complete so the cache is populated even after the user stops playback.
  // - playAbortRef: aborted on stop() so audio pauses immediately.
  const fetchAbortRef = useRef<AbortController | null>(null);
  const playAbortRef = useRef<AbortController | null>(null);

  const stopPlayback = useCallback(() => {
    playAbortRef.current?.abort();
    playAbortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  // Full teardown — cancel both fetch and playback (called when switching messages or unmounting).
  const teardown = useCallback(() => {
    stopPlayback();
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = null;
  }, [stopPlayback]);

  // stop() only kills playback. Fetch continues in background so the cache gets populated.
  const stop = useCallback(() => {
    stopPlayback();
    speakingIdRef.current = null;
    setSpeakingId(null);
    setIsLoading(false);
  }, [stopPlayback]);

  const speak = useCallback(
    (id: string, text: string, language?: string) => {
      // Toggle: tapping the active item stops it.
      if (speakingIdRef.current === id) {
        stop();
        return;
      }

      // Cancel any previous session (different message).
      teardown();

      speakingIdRef.current = id;
      setSpeakingId(id);

      const fetchController = new AbortController();
      fetchAbortRef.current = fetchController;

      const playController = new AbortController();
      playAbortRef.current = playController;

      // ── Cache hit — play instantly ─────────────────────────────────────
      const cached = audioCache.get(id);
      if (cached) {
        setIsLoading(false);

        void (async () => {
          try {
            for (const buffer of cached) {
              if (playController.signal.aborted) break;
              await playBuffer(buffer, playController.signal, audioRef);
            }
          } catch (err) {
            if ((err as Error).name === "AbortError") return;
            console.error("[useTTS] Cached playback error:", err);
          } finally {
            if (speakingIdRef.current === id) {
              speakingIdRef.current = null;
              setSpeakingId(null);
            }
          }
        })();
        return;
      }

      // ── Cache miss — fetch with paragraph-level pipelining ─────────────
      setIsLoading(true);

      const textChunks = splitForTTS(text);

      // Fire all paragraph requests concurrently. Each uses the fetch signal
      // (NOT the play signal) so they continue even if the user stops playback.
      const chunkPromises = textChunks.map((chunk) =>
        fetchChunkBuffers(chunk, language, fetchController.signal),
      );
      // Suppress unhandled rejections from any orphaned concurrent fetch promises.
      chunkPromises.forEach((p) => p.catch(() => {}));

      void (async () => {
        const allBuffers: ArrayBuffer[] = [];
        let firstChunk = true;

        try {
          for (const promise of chunkPromises) {
            if (fetchController.signal.aborted) break;

            const buffers = await promise;
            allBuffers.push(...buffers);

            if (firstChunk) {
              setIsLoading(false);
              firstChunk = false;
            }

            // Play each buffer — but only if playback hasn't been stopped.
            // If stopped, we keep iterating to collect remaining fetched buffers for caching.
            for (const buffer of buffers) {
              if (playController.signal.aborted) break;
              await playBuffer(buffer, playController.signal, audioRef);
            }
          }

          // Cache all fetched buffers regardless of whether playback completed.
          // This means: even if the user stopped early, the next play is instant.
          if (!fetchController.signal.aborted && allBuffers.length > 0) {
            cacheSet(id, allBuffers);
          }
        } catch (err) {
          if ((err as Error).name === "AbortError") return;
          console.error("[useTTS]", err);
          setIsLoading(false);
        } finally {
          if (speakingIdRef.current === id && !playController.signal.aborted) {
            speakingIdRef.current = null;
            setSpeakingId(null);
          }
        }
      })();
    },
    [stop, teardown],
  );

  useEffect(() => () => teardown(), [teardown]);

  return { speak, stop, speakingId, isLoading };
}
