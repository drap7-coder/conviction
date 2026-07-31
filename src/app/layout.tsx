import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MobileTabBar, { DesktopNav } from "@/components/BottomTabBar";
import { GlobalSearchPill } from "@/components/GlobalSearchPill";
import AnimatedTitle from "@/components/AnimatedTitle";
import { SITE_URL } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "CONVICTION — Evidence Detection",
  description: "Find material changes before they become obvious.",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "CONVICTION — Evidence Detection",
    description: "Find material changes before they become obvious.",
    url: SITE_URL,
    siteName: "CONVICTION",
    images: [
      {
        url: "/conviction-og.png",
        width: 1200,
        height: 630,
        alt: "CONVICTION pixel bull logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CONVICTION — Evidence Detection",
    description: "Find material changes before they become obvious.",
    images: ["/conviction-og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <div className="app-shell">
          <header className="app-header">
            <div className="header-brand-row">
              <a className="app-brand" href="/watchlist" aria-label="CONVICTION home">
                <img
                  alt=""
                  aria-hidden="true"
                  className="app-logo"
                  src="/conviction-bull.png"
                />
                <AnimatedTitle />
              </a>
              <DesktopNav />
              <div className="header-search">
                <GlobalSearchPill />
              </div>
            </div>
          </header>
          {children}
        </div>
        <div className="mobile-chrome">
          <GlobalSearchPill />
          <MobileTabBar />
        </div>
      </body>
    </html>
  );
}
