import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { BuildDebugMarker } from "@/components/BuildDebugMarker";
import MobileTabBar, { DesktopNav } from "@/components/BottomTabBar";
import { GlobalSearchPill } from "@/components/GlobalSearchPill";
import { MarketTape } from "@/components/MarketTape";
import AnimatedTitle from "@/components/AnimatedTitle";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OG_IMAGE,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site";
import { siteJsonLd } from "@/lib/seo";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  category: "finance",
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/pulse",
  },
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: `${SITE_URL}/pulse`,
    siteName: SITE_NAME,
    images: [SITE_OG_IMAGE],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE.url],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0A0E14",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd()) }}
        />
        <div className="app-shell">
          <header className="app-header">
            <div className="header-brand-row">
              <Link className="app-brand" href="/pulse" aria-label="CONVICTION home">
                <img
                  alt=""
                  aria-hidden="true"
                  className="app-logo"
                  src="/conviction-bull.png"
                />
                <AnimatedTitle />
              </Link>
              <DesktopNav />
              <div className="header-search">
                <GlobalSearchPill />
              </div>
            </div>
          </header>
          <MarketTape />
          {children}
          <Suspense fallback={null}>
            <BuildDebugMarker />
          </Suspense>
        </div>
        <MobileTabBar />
      </body>
    </html>
  );
}
