/**
 * Vertex AI auth for the OpenAI-compatible chat completions endpoint.
 *
 * Supported:
 *   • Service account — OAuth access token (GCP_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS)
 *   • Vertex API key — from Google Cloud “API Keys” (restricted to Vertex AI API). Passed as `?key=` on the request URL.
 *
 * AI Studio (`GEMINI_API_KEY` → generativelanguage.googleapis.com) is handled in lib/ai/llm.ts, not here.
 */

import type { JWTInput } from "google-auth-library";
import { GoogleAuth } from "google-auth-library";

const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

/** Vertex / Google Cloud API key (NOT the AI Studio key). See VERTEX_AI_API_KEY in .env.example */
export function vertexApiKeyFromEnv(): string | undefined {
  const v = process.env.VERTEX_AI_API_KEY?.trim();
  if (v) return v;
  const g = process.env.GOOGLE_API_KEY?.trim();
  if (g) return g;
  return undefined;
}

function createGoogleAuth(): GoogleAuth {
  const json = process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (json) {
    return new GoogleAuth({
      credentials: JSON.parse(json) as JWTInput,
      scopes: [CLOUD_PLATFORM_SCOPE],
    });
  }
  return new GoogleAuth({
    scopes: [CLOUD_PLATFORM_SCOPE],
  });
}

let authSingleton: GoogleAuth | null = null;
let cachedClient: Awaited<ReturnType<GoogleAuth["getClient"]>> | null = null;

function getAuth(): GoogleAuth {
  if (!authSingleton) authSingleton = createGoogleAuth();
  return authSingleton;
}

/** Service account JSON or ADC file path — preferred for production. */
export function isVertexServiceAccountConfigured(): boolean {
  return Boolean(
    process.env.GCP_PROJECT_ID &&
      process.env.GCP_REGION &&
      (process.env.GCP_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS)
  );
}

/**
 * Vertex “API Keys” console key + project/region. Ignored if a service account is configured (SA wins).
 */
export function isVertexApiKeyConfigured(): boolean {
  if (isVertexServiceAccountConfigured()) return false;
  return Boolean(
    process.env.GCP_PROJECT_ID && process.env.GCP_REGION && vertexApiKeyFromEnv()
  );
}

/** True when we should call the regional Vertex OpenAI endpoint (not AI Studio). */
export function isVertexConfigured(): boolean {
  return isVertexServiceAccountConfigured() || isVertexApiKeyConfigured();
}

/** Regional Vertex OpenAI-compatible chat completions URL (v1beta1). */
export function getVertexChatCompletionsUrl(): string {
  const project = process.env.GCP_PROJECT_ID!;
  const location = process.env.GCP_REGION!;
  let url = `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${project}/locations/${location}/endpoints/openapi/chat/completions`;
  if (isVertexApiKeyConfigured()) {
    const key = vertexApiKeyFromEnv();
    if (key) {
      url += `${url.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
    }
  }
  return url;
}

/**
 * Short-lived OAuth access token. Cached until ~1 min before expiry.
 */
export async function getVertexAccessToken(): Promise<string> {
  if (!cachedClient) {
    cachedClient = await getAuth().getClient();
  }
  const client = cachedClient;
  const { token } = await client.getAccessToken();
  if (!token) {
    throw new Error("[vertex-auth] Failed to obtain access token");
  }
  return token;
}
