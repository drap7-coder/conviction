import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomTicker } from "@/app/components/BottomTicker";
import { ExperienceControls } from "@/app/components/ExperienceControls";
import { Nav } from "@/app/components/Nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CONVICTION — Evidence Detection",
  description: "Find material changes before they become obvious.",
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
            <div className="flex items-center gap-8">
              <h1 className="app-title">
                CONVICTION<span className="accent-dot">.</span>
              </h1>
              <span className="demo-badge">SEC 13F</span>
            </div>
            <div className="header-actions">
              <Nav />
              <ExperienceControls />
            </div>
          </header>
          {children}
        </div>
        <BottomTicker />
      </body>
    </html>
  );
}
