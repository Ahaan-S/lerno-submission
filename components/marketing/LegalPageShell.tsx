import type { ReactNode } from "react";
import StaticShell from "./StaticShell";

interface LegalPageShellProps {
  title: string;
  children?: ReactNode;
}

export default function LegalPageShell({ title, children }: LegalPageShellProps) {
  return (
    <StaticShell>
      <div
        className="w-full px-6"
        style={{ paddingTop: "160px", paddingBottom: "120px" }}
      >
        {/* Page title */}
        <div className="text-center">
          <h1
            style={{
              fontFamily: "var(--font-crimson-pro)",
              fontSize: "clamp(40px, 8vw, 64px)",
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: "var(--base-800)",
              margin: 0,
            }}
          >
            {title}
          </h1>
        </div>

        {/* Content */}
        <div
          className="mx-auto"
          style={{ marginTop: "72px", maxWidth: "700px" }}
        >
          <div
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "15px",
              lineHeight: "1.8",
              color: "var(--base-500)",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </StaticShell>
  );
}
