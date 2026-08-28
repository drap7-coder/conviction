import type { Metadata } from "next";
import { Suspense } from "react";
import Portfolio from "@/components/Portfolio";
import { PortfolioDataProvider } from "@/components/PortfolioData";
import { pageMetadata } from "@/lib/seo";
import "@/app/portfolio.css";
import "@/app/watchlist.css";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[]; view?: string | string[] }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const view = Array.isArray(params.view) ? params.view[0] : params.view;
  const isWatchlist = view === "watchlist" && mode !== "study";

  return pageMetadata({
    title: isWatchlist ? "Watchlist" : "Portfolio",
    description: isWatchlist
      ? "Follow the names you care about — today’s dollar and percent moves in one quote board."
      : "Live portfolio value and today’s move, sector mix, concentration, and compare-against guidance — plus Watchlist and Study Mode templates.",
    path: isWatchlist ? "/portfolio?view=watchlist" : "/portfolio",
    index: mode !== "study",
  });
}

export default function PortfolioPage() {
  return (
    <main className="portfolio-page">
      <h1 className="sr-only">Portfolio</h1>
      <Suspense fallback={null}>
        <PortfolioDataProvider>
          <Portfolio />
        </PortfolioDataProvider>
      </Suspense>
    </main>
  );
}
