"use client";

import { HomeMarketDashboard } from "@/components/market/HomeMarketDashboard";
import { HomeMarketDrivers } from "@/components/market/HomeMarketDrivers";

/**
 * Home = one coherent market situation overview.
 * Personal company intelligence belongs in Portfolio; deeper market tables
 * remain in Pulse.
 */
export function HomeOverview() {
  return (
    <div className="pulse-dashboard pulse-home home-overview home-dashboard-overview">
      <HomeMarketDashboard />
      <HomeMarketDrivers />
    </div>
  );
}
