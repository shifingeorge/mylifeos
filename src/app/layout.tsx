import type { Metadata, Viewport } from "next";
import { DM_Mono, Syne } from "next/font/google";
import "./globals.css";

// Self-hosted by next/font — no external request, so they render offline.
const dmMono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-dm-mono",
});

const syne = Syne({
  weight: ["600", "700"],
  subsets: ["latin"],
  variable: "--font-syne",
});

const isDev = process.env.NEXT_PUBLIC_ENV_LABEL === "dev";

export const metadata: Metadata = {
  title: isDev ? "LIFE_OS · DEV" : "LIFE_OS",
  // A personal tool holding shop data does not belong in a search index.
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  viewportFit: "cover",
  // The grid is a fixed instrument, not a document to pinch around.
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmMono.variable} ${syne.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
