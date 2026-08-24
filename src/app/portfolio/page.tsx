import type { Metadata } from "next";
import { Suspense } from "react";
import Portfolio from "@/components/Portfolio";
import { PortfolioDataProvider } from "@/components/PortfolioData";
import { pageMetadata } from "@/lib/seo";
import "@/app/portfolio.css";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;

  return pageMetadata({
    title: "Portfolio",
    description:
      "Your book — live value, exposure mix, and holdings with ownership context.",
    path: "/portfolio",
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
