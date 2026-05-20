"use client";

import { useEffect, useMemo, useState } from "react";

const appBaseUrl =
  process.env.NODE_ENV === "development" ? "http://app.localhost:3000" : "https://app.lerno.in";

type MarketingCta = {
  href: string;
  label: "Start Learning" | "Continue Learning";
  trackingLabel: string;
};

export function useMarketingCta(): MarketingCta {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const response = await fetch(`${appBaseUrl}/api/auth/status`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return;

        const data = (await response.json()) as { authenticated?: unknown };
        if (!cancelled) setIsAuthenticated(data.authenticated === true);
      } catch {
        // Keep the logged-out CTA when the app-domain status check is unavailable.
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => ({
      href: isAuthenticated ? `${appBaseUrl}/learn` : `${appBaseUrl}/auth`,
      label: isAuthenticated ? "Continue Learning" : "Start Learning",
      trackingLabel: isAuthenticated ? "Continue learning" : "Start learning",
    }),
    [isAuthenticated]
  );
}
