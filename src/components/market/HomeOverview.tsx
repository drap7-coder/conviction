"use client";

import { HomeMarketStrip } from "@/components/market/HomeMarketStrip";

/**
 * Home = broad market telemetry (regime, indexes, commodities, sectors).
 * Personal holdings / watchlist brief lives on Portfolio — not here.
 * Pulse owns the full Markets / Movers / Crypto / Intl workspace.
 */
export function HomeOverview() {
  return (
    <div className="pulse-dashboard pulse-home home-overview home-macro">
      <HomeMarketStrip />
    </div>
  );
}
