import type { Metadata } from "next";

// Portal routes are authenticated app pages — they should never appear in search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
