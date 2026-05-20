import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Automatically capture every unhandled server-side request error across all
// API routes, server actions, and server components — no per-route boilerplate needed.
// Requires @sentry/nextjs >= 8.28.0
export const onRequestError = Sentry.captureRequestError;
