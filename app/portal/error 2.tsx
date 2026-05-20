"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <h2 className="text-2xl font-semibold tracking-tight">Something went wrong</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        An unexpected error occurred. Our team has been notified and is looking into it.
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
