import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";
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
    // New filename + ?v= busts aggressive browser favicon caches. Same URL paths
    // stay sticky in tabs — bump both whenever the mark changes.
    icon: [
      { url: "/iqbulls-favicon.png?v=20260831d", type: "image/png", sizes: "512x512" },
      { url: "/favicon.ico?v=20260831d", type: "image/x-icon", sizes: "48x48" },
    ],
    apple: [{ url: "/iqbulls-apple-icon.png?v=20260831d", type: "image/png", sizes: "180x180" }],
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
              <Link className="app-brand" href="/pulse" aria-label="IQBulls home">
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
        </div>
        <MobileTabBar />
      </body>
    </html>
  );
}
