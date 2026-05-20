import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // Server-side should use the non-public DSN env var
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV,

  // 100% in dev; 10% in production (server generates many spans)
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Include user IP and request headers so issues can be correlated to users
  sendDefaultPii: true,

  // Attach local variable values to stack frames — critical for debugging server errors
  includeLocalVariables: true,

  // Forward structured server logs to Sentry Logs
  enableLogs: true,

  integrations: [
    // Automatically capture every console.error and console.warn call across all API routes
    // as a Sentry event. Every existing console.error("[route] ...") becomes a tracked issue —
    // no per-route boilerplate needed.
    Sentry.captureConsoleIntegration({ levels: ["warn", "error"] }),
  ],

  // Only send events in production and development; never in test runs
  enabled: process.env.NODE_ENV !== "test",
});
