/**
 * Rate limiting via Upstash Redis.
 * Falls back gracefully (allows all) if UPSTASH_REDIS_REST_URL is not configured.
 *
 * Tiers:
 *   llm_chat       — 50  requests / hour  (Ask Mode & Learn Mode chat)
 *   llm_learn      — 20  requests / hour  (Learn kickoff / session start)
 *   llm_diagnostic — 10  requests / hour  (diagnostic generation)
 *   llm_evaluate   — 60  requests / hour  (short-answer grading)
 *   tts            — 100 requests / hour  (text-to-speech; ~20-30 full message reads/hr)
 */
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitTier =
  | "llm_chat"
  | "llm_learn"
  | "llm_diagnostic"
  | "llm_evaluate"
  | "tts";

const LIMITS: Record<RateLimitTier, { requests: number; window: `${number} ${"ms" | "s" | "m" | "h" | "d"}` }> = {
  llm_chat:       { requests: 50,  window: "1 h" },
  llm_learn:      { requests: 20,  window: "1 h" },
  llm_diagnostic: { requests: 10,  window: "1 h" },
  llm_evaluate:   { requests: 60,  window: "1 h" },
  tts:            { requests: 100, window: "1 h" },
};

let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

const limiterCache: Partial<Record<RateLimitTier, Ratelimit>> = {};
function getLimiter(tier: RateLimitTier): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  if (!limiterCache[tier]) {
    const { requests, window } = LIMITS[tier];
    limiterCache[tier] = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(requests, window),
      prefix: `lerno:rl:${tier}`,
    });
  }
  return limiterCache[tier]!;
}

export async function checkRateLimit(
  userId: string,
  tier: RateLimitTier
): Promise<{ success: boolean; remaining: number; limit: number; reset: number }> {
  const limiter = getLimiter(tier);
  if (!limiter) {
    // Upstash not configured — open (dev / self-hosted)
    return { success: true, remaining: 9999, limit: 9999, reset: 0 };
  }
  const result = await limiter.limit(userId);
  return {
    success: result.success,
    remaining: result.remaining,
    limit: result.limit,
    reset: result.reset,
  };
}

export function rateLimitedResponse(reset: number): NextResponse {
  const retryAfterSecs = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please wait a moment before trying again." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSecs),
        "X-RateLimit-Reset": String(reset),
      },
    }
  );
}
