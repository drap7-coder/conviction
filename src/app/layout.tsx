import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomTicker } from "@/app/components/BottomTicker";
import { WatchlistSettingsMenu } from "@/app/components/WatchlistSettingsMenu";
import { Nav } from "@/app/components/Nav";
import { MarketTicker } from "@/app/components/MarketTicker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://conviction-orpin.vercel.app"),
  title: "CONVICTION — Evidence Detection",
  description: "Find material changes before they become obvious.",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "CONVICTION — Evidence Detection",
    description: "Find material changes before they become obvious.",
    url: "https://conviction-orpin.vercel.app",
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

const themeScript = `
(() => {
  try {
    const saved = localStorage.getItem("conviction-theme");
    const theme = saved === "light" || saved === "dark"
      ? saved
      : (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div className="app-shell">
          <header className="app-header">
            <div className="header-brand-row">
              <a className="app-brand" href="/" aria-label="CONVICTION home">
                <img
                  alt=""
                  aria-hidden="true"
                  className="app-logo"
                  src="/conviction-bull.png"
                />
                <h1 className="app-title">
                  CONVICTION<span className="accent-dot">.</span>
                </h1>
              </a>
            </div>
            <div className="header-actions">
              <Nav />
              <WatchlistSettingsMenu />
            </div>
          </header>
          <MarketTicker />
          {children}
        </div>
        <BottomTicker />
      </body>
    </html>
  );
}
