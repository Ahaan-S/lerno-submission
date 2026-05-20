import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /** Canonical tutor home is `/learn`. Avoid RSC `redirect()` on a dedicated page — it can trigger
   *  Performance.measure errors ("negative time stamp") in dev. */
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.lerno.in" }],
        destination: "https://lerno.in/:path*",
        permanent: true,
      },
      { source: "/dashboard", destination: "/learn", permanent: false },
      { source: "/portal/dashboard", destination: "/portal/learn", permanent: false },
    ];
  },

  // Produces a self-contained build under .next/standalone — required for Cloud Run Docker deploys.
  output: "standalone",

  compress: true,

  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 100],
  },

  // optimizePackageImports is a webpack-era hint — Turbopack tree-shakes automatically, no config needed.
};

export default withSentryConfig(nextConfig, {
  // Sentry org/project slugs — set these in env or here
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for uploading source maps (set in .env.sentry-build-plugin or CI secrets)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Suppress Sentry CLI output outside of CI
  silent: !process.env.CI,

  // Upload a broader set of client source files so stack traces resolve to real file names
  widenClientFileUpload: true,

  // Proxy Sentry event requests through /monitoring to bypass ad-blockers
  tunnelRoute: "/monitoring",

  // Tree-shake Sentry debug code from client bundles (webpack only; Turbopack handles this automatically)
  disableLogger: true,
});
