"use client";

import { HomePersonalBrief } from "@/components/HomePersonalBrief";
import { HomeMarketDashboard } from "@/components/market/HomeMarketDashboard";

/**
 * Home = immediate market situation plus the personal evidence brief.
 * Pulse remains the full Markets / Movers / Crypto / Intl workspace.
 */
export function HomeOverview() {
  return (
    <div className="pulse-dashboard pulse-home home-overview home-dashboard-overview">
      <HomeMarketDashboard />
      <HomePersonalBrief />
    </div>
  );
}
