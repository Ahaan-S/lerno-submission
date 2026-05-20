import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV,

  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  sendDefaultPii: true,

  enableLogs: true,

  integrations: [
    Sentry.captureConsoleIntegration({ levels: ["error"] }),
  ],

  enabled: process.env.NODE_ENV !== "test",
});
