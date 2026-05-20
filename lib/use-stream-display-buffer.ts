"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Default pacing for streamed assistant text (Learn + Ask).
 *
 * How to tweak (fastest path):
 * 1. Change the numbers in `STREAM_DISPLAY_DEFAULTS` below — applies everywhere that uses the hook without overrides.
 * 2. Or pass options at a call site: `useStreamDisplayBuffer({ intervalMs: 110, minChunkChars: 2, maxChunkChars: 12 })`.
 * 3. Cached tutor replies also use `CACHE_SSE_CHUNK_CHARS` in `app/api/tutor/chat/route.ts` — smaller chunks = gentler token delivery before the client buffer runs.
 *
 * | Knob | Effect |
 * |------|--------|
 * | `intervalMs` ↑ | Fewer screen updates per second → calmer, slightly “slower” reveal. |
 * | `intervalMs` ↓ | More frequent updates → snappier, closer to raw tokens. |
 * | `minChunkChars` ↓ | Smaller minimum reveal slices near the end → gentler finish. |
 * | `maxChunkChars` ↓ | Smaller max reveal slices when the model is far ahead → less abrupt bursts. |
 */
export const STREAM_DISPLAY_DEFAULTS = {
  /** ms between visible refreshes toward the latest full text. */
  intervalMs: 170,
  /** Smallest slice revealed per tick so the tail still moves steadily. */
  minChunkChars: 28,
  /** Largest slice revealed per tick when the model is far ahead of the display. */
  maxChunkChars: 180,
} as const;

export interface UseStreamDisplayBufferOptions {
  intervalMs?: number;
  minChunkChars?: number;
  maxChunkChars?: number;
}

/**
 * Batches streaming text for display so React does not re-render on every model token.
 * Large jumps (cache hits, bursts) are revealed in steady slices so the answer does not flash in at once.
 */
export function useStreamDisplayBuffer(options?: UseStreamDisplayBufferOptions) {
  const intervalMs = options?.intervalMs ?? STREAM_DISPLAY_DEFAULTS.intervalMs;
  const minChunkChars =
    options?.minChunkChars ?? STREAM_DISPLAY_DEFAULTS.minChunkChars;
  const maxChunkChars =
    options?.maxChunkChars ?? STREAM_DISPLAY_DEFAULTS.maxChunkChars;

  const [displayText, setDisplayText] = useState("");
  const [displayChunks, setDisplayChunks] = useState<string[]>([]);
  const targetRef = useRef("");
  const displayRef = useRef("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const drainResolverRef = useRef<(() => void) | null>(null);

  const resolveDrainIfSettled = useCallback(() => {
    if (displayRef.current !== targetRef.current) return;
    const resolve = drainResolverRef.current;
    if (!resolve) return;
    drainResolverRef.current = null;
    resolve();
  }, []);

  const tick = useCallback(() => {
    const target = targetRef.current;
    const cur = displayRef.current;
    if (cur === target) {
      resolveDrainIfSettled();
      return;
    }

    const behind = target.length - cur.length;
    const baseChars = Math.max(
      minChunkChars,
      Math.min(maxChunkChars, Math.ceil(behind / 4))
    );
    const start = cur.length;
    let end = Math.min(target.length, start + baseChars);

    // Prefer natural boundaries so text appears in meaningful chunks.
    const paragraphBreak = target.indexOf("\n\n", start + Math.max(8, Math.floor(minChunkChars / 2)));
    if (paragraphBreak !== -1 && paragraphBreak + 2 <= start + maxChunkChars * 2) {
      end = Math.min(target.length, paragraphBreak + 2);
    } else {
      const windowEnd = Math.min(target.length, start + maxChunkChars);
      const windowText = target.slice(start, windowEnd);
      const sentenceMatch = windowText.match(/[.!?]\s(?!.*[.!?]\s)/);
      if (sentenceMatch && sentenceMatch.index != null) {
        end = Math.min(target.length, start + sentenceMatch.index + sentenceMatch[0].length);
      }
    }

    if (end <= start) end = Math.min(target.length, start + baseChars);
    const nextChunk = target.slice(start, end);
    const next = cur + nextChunk;
    displayRef.current = next;
    setDisplayText(next);
    if (nextChunk) {
      setDisplayChunks((prev) => [...prev, nextChunk]);
    }
    if (next === target) {
      resolveDrainIfSettled();
    }
  }, [maxChunkChars, minChunkChars, resolveDrainIfSettled]);

  const start = useCallback(() => {
    targetRef.current = "";
    displayRef.current = "";
    drainResolverRef.current = null;
    setDisplayText("");
    setDisplayChunks([]);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, intervalMs);
  }, [intervalMs, tick]);

  const setTarget = useCallback((full: string) => {
    targetRef.current = full;
  }, []);

  const finish = useCallback(() => {
    if (displayRef.current === targetRef.current) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      drainResolverRef.current = resolve;
    });
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const remaining = targetRef.current.slice(displayRef.current.length);
    displayRef.current = targetRef.current;
    setDisplayText(targetRef.current);
    if (remaining) setDisplayChunks((prev) => [...prev, remaining]);
    resolveDrainIfSettled();
  }, [resolveDrainIfSettled]);

  const flush = useCallback(() => {
    const remaining = targetRef.current.slice(displayRef.current.length);
    displayRef.current = targetRef.current;
    setDisplayText(targetRef.current);
    if (remaining) setDisplayChunks((prev) => [...prev, remaining]);
    resolveDrainIfSettled();
  }, [resolveDrainIfSettled]);

  const reset = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    drainResolverRef.current?.();
    drainResolverRef.current = null;
    targetRef.current = "";
    displayRef.current = "";
    setDisplayText("");
    setDisplayChunks([]);
  }, []);

  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    []
  );

  return { displayText, displayChunks, setTarget, start, finish, stop, flush, reset };
}
