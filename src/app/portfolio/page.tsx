import type { Metadata } from "next";
import Portfolio from "@/components/Portfolio";
import { PortfolioDataProvider, PortfolioHero } from "@/components/PortfolioData";

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
      <PortfolioDataProvider>
        <PortfolioHero />
        <Portfolio hideHero composeFirst />
      </PortfolioDataProvider>
    </div>
  );
}
