"use client";

import { PortfolioPersonalBrief } from "@/components/PortfolioPersonalBrief";
import { HomeMarketStrip } from "@/components/market/HomeMarketStrip";

/**
 * Home = public macro tape + personal daily brief charts.
 * Pulse stays the full Markets / Movers / Crypto / Intl workspace.
 * Portfolio Watchlist also keeps the brief for the personal workspace.
 */
export function HomeOverview() {
  return (
    <div className="pulse-dashboard pulse-home home-overview home-macro">
      <HomeMarketStrip />
      <section
        className="home-personal-brief"
        aria-label="Personal daily intelligence"
      >
        <PortfolioPersonalBrief />
      </section>
    </div>
  );
}
