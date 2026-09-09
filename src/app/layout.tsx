import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import MobileTabBar from "@/components/BottomTabBar";
import { AppHeader } from "@/components/AppHeader";
import { MarketTape } from "@/components/MarketTape";
import { GroupAccentProvider } from "@/components/GroupAccentProvider";
import { GroupOnboardingPrompt } from "@/components/GroupPanels";
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
  // Stable /favicon.png first for Google SERP (48px+). App Router still emits
  // icon.png / apple-icon.png from file conventions; favicon.ico lives in
  // public/ for browser auto-discovery without preempting the PNG links.
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/pulse",
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
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <body>
        <Script id="iqbulls-theme" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem('iqbulls-theme');if(t==='cream'){document.documentElement.dataset.theme='cream';document.documentElement.style.colorScheme='light'}}catch(e){}`}
        </Script>
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd()) }}
        />
        <GroupAccentProvider>
          <div className="app-shell">
            <AppHeader />
            <MarketTape />
            {children}
          </div>
          <MobileTabBar />
          <GroupOnboardingPrompt />
        </GroupAccentProvider>
      </body>
    </html>
  );
}
