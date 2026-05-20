import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV,

  // 100% in dev so nothing is missed locally; 10% in production to stay within quota
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Record 10% of all sessions; always record sessions that hit an error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Include user IP and request headers in events
  sendDefaultPii: true,

  // Enable structured log forwarding to Sentry Logs
  enableLogs: true,

  integrations: [
    // Capture client-side console.error calls as Sentry events
    Sentry.captureConsoleIntegration({ levels: ["error"] }),
    // Session Replay — soft-masked by default; fine-tune per-project if needed
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
      maskAllInputs: true, // always mask form inputs for privacy
    }),
    // Report the exact user interaction that triggered an error
    Sentry.browserTracingIntegration(),
  ],

  // Filter out low-signal browser noise
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error promise rejection captured",
    // Benign navigation cancel (user clicked back before page loaded)
    "Navigation cancelled",
    // Safari PWA quirk
    "An attempt was made to use an object that is not, or is no longer, usable",
  ],

  // Only send events in production and development; never in test runs
  enabled: process.env.NODE_ENV !== "test",
});

// Capture App Router navigation transitions as performance spans
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
