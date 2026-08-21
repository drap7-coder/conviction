import type { Metadata } from "next";
import { Suspense } from "react";
import Portfolio from "@/components/Portfolio";
import { PortfolioDataProvider } from "@/components/PortfolioData";
import "@/app/portfolio.css";

export const metadata: Metadata = {
  title: "Portfolio",
  description:
    "Your book — live value, exposure mix, and holdings with ownership context.",
  alternates: {
    canonical: "/portfolio",
  },
};

export default function PortfolioPage() {
  return (
    <div className="portfolio-page">
      <Suspense fallback={null}>
        <PortfolioDataProvider>
          <Portfolio composeFirst />
        </PortfolioDataProvider>
      </Suspense>
    </div>
  );
}
