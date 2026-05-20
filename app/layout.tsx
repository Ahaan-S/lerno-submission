import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Geist, Geist_Mono, Crimson_Pro, Inter, Nunito } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import { StreakCelebrationLayer } from "@/components/streak/StreakCelebrationLayer";
import TopLoader from "@/components/ui/TopLoader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const crimsonPro = Crimson_Pro({
  variable: "--font-crimson-pro",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://lerno.in"),
  title: "Lerno — Free Personal AI Tutor for CBSE Class 10 & 11",
  description:
    "Free personal AI tutor for CBSE Class 10 & 11. Get instant NCERT-based explanations, guided chapter sessions, and smart practice questions — completely free for every student.",
  icons: {
    icon: "/lerno-cap-dark.webp",
    shortcut: "/lerno-cap-dark.webp",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Lerno — Free Personal AI Tutor for CBSE Class 10 & 11",
    description:
      "Free personal AI tutor for CBSE Class 10 & 11. Instant NCERT explanations, guided lessons, and smart practice — all free.",
    url: "https://lerno.in",
    siteName: "Lerno",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Lerno — Free Personal AI Tutor for CBSE Class 10 & 11",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lerno — Free Personal AI Tutor for CBSE Class 10 & 11",
    description:
      "Free personal AI tutor for CBSE Class 10 & 11. Instant NCERT explanations, guided lessons, and smart practice — all free.",
    images: ["/og-image.png"],
  },
};

export const viewport = {
  width: "device-width" as const,
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${crimsonPro.variable} ${inter.variable} ${nunito.variable} antialiased`}
        suppressHydrationWarning
      >
        <GoogleAnalytics gaId="G-3MBDX6SK3R" />
        <TopLoader />
        <StreakCelebrationLayer />
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
