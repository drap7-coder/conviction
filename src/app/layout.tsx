import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomTicker } from "@/app/components/BottomTicker";
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
            <div className="flex items-center gap-8">
              <h1 className="app-title">
                CONVICTION<span className="accent-dot">.</span>
              </h1>
              <span className="demo-badge">DEMO DATA</span>
            </div>
            <Nav />
          </header>
          {children}
        </div>
        <BottomTicker />
      </body>
    </html>
  );
}