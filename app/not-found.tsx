import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Page Not Found | Lerno",
  robots: { index: false, follow: false },
};

export default function NotFound() {
    return (
        <main className="min-h-screen w-full flex items-center justify-center bg-white">
            <div className="flex flex-col items-center text-center" style={{ gap: "28px", padding: "32px 24px" }}>
                <div className="relative w-[48px] h-[48px]">
                    <Image
                        src="/lerno-cap.webp?v=2"
                        alt="Lerno"
                        width={48}
                        height={48}
                        className="object-contain"
                        unoptimized
                    />
                </div>

                <div className="flex flex-col items-center" style={{ gap: "8px" }}>
                    <h1
                        className="font-semibold text-slate-900"
                        style={{ fontFamily: "var(--font-inter)", fontSize: "20px" }}
                    >
                        Page not found
                    </h1>
                    <p
                        className="text-center"
                        style={{ fontFamily: "var(--font-inter)", fontSize: "14px", color: "#525252", maxWidth: "280px" }}
                    >
                        This page doesn&apos;t exist or may have been moved.
                    </p>
                </div>

                <Link
                    href="/"
                    className="flex items-center justify-center text-white transition-all hover:opacity-90 active:opacity-100"
                    style={{
                        backgroundColor: "var(--base-700)",
                        height: "44px",
                        borderRadius: "12px",
                        paddingLeft: "24px",
                        paddingRight: "24px",
                        fontSize: "15px",
                        fontWeight: 500,
                        fontFamily: "var(--font-inter)",
                    }}
                >
                    Go home
                </Link>
            </div>
        </main>
    );
}
