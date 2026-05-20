/**
 * Sentry helpers for Lerno.
 *
 * Usage in API routes:
 *
 *   import { withSentry, setSentryUser } from "@/lib/sentry";
 *
 *   export const POST = withSentry("api/tutor/chat", async (request) => {
 *     // Your handler — any thrown error is automatically captured.
 *   });
 *
 * Usage after authenticating a user (server component, server action, or API route):
 *
 *   setSentryUser({ id: user.id, email: user.email });
 *
 * Usage for manually captured errors (e.g. inside a streaming catch block):
 *
 *   captureApiError(err, { route: "api/learn/kickoff", userId: user.id });
 */

import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RouteHandler = (
  request: NextRequest,
  context?: { params?: Record<string, string | string[]> }
) => Promise<NextResponse | Response>;

interface ApiErrorContext {
  route?: string;
  userId?: string;
  extra?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// User context
// ---------------------------------------------------------------------------

/**
 * Attach the authenticated user to every Sentry event produced in this
 * request scope. Call this as early as possible after confirming the user.
 */
export function setSentryUser(user: {
  id: string;
  email?: string | null;
  username?: string | null;
}) {
  Sentry.setUser({
    id: user.id,
    email: user.email ?? undefined,
    username: user.username ?? undefined,
  });
}

/**
 * Clear the Sentry user when the session ends (e.g. on sign-out).
 */
export function clearSentryUser() {
  Sentry.setUser(null);
}

// ---------------------------------------------------------------------------
// Manual capture helper
// ---------------------------------------------------------------------------

/**
 * Capture an error with optional structured context. Use this inside
 * streaming catch blocks or anywhere an error is handled without re-throwing.
 *
 * @example
 * } catch (err) {
 *   captureApiError(err, { route: "api/learn/kickoff", userId: user.id });
 *   controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Kickoff failed" })}\n\n`));
 * }
 */
export function captureApiError(
  error: unknown,
  context: ApiErrorContext = {}
): void {
  Sentry.withScope((scope) => {
    if (context.route) scope.setTag("api_route", context.route);
    if (context.userId) scope.setUser({ id: context.userId });
    if (context.extra) scope.setExtras(context.extra);
    scope.setTag("captured_manually", true);
    Sentry.captureException(error);
  });
}

// ---------------------------------------------------------------------------
// Route wrapper
// ---------------------------------------------------------------------------

/**
 * Wrap a Next.js App Router route handler so that any unhandled exception is
 * captured in Sentry before returning a 500 response to the client.
 *
 * Errors that are already caught internally (e.g. inside a try/catch that
 * returns an error JSON) are NOT automatically captured — use `captureApiError`
 * inside those catch blocks instead.
 *
 * @param routeName  A short identifier shown in Sentry (e.g. "api/tutor/chat")
 * @param handler    The original async route handler function
 */
export function withSentry(routeName: string, handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    return Sentry.withScope(async (scope) => {
      scope.setTag("api_route", routeName);
      scope.setTag("http.method", request.method);
      scope.setExtra("url", request.url);

      try {
        return await handler(request, context);
      } catch (error) {
        Sentry.captureException(error);
        console.error(`[${routeName}] Unhandled error:`, error);
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    });
  };
}

// ---------------------------------------------------------------------------
// Auth-callback helper
// ---------------------------------------------------------------------------

/**
 * Call after a successful Supabase auth exchange to attach the user to Sentry
 * for the duration of the request processing.
 */
export function identifyUserForSentry(userId: string, email?: string | null) {
  Sentry.setUser({ id: userId, email: email ?? undefined });
}
