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
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site";

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
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
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
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/conviction-og.png"],
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
        </div>
        <MobileTabBar />
      </body>
    </html>
  );
}
