"use client";

import { HomePersonalBrief } from "@/components/HomePersonalBrief";

/**
 * Home = personal briefing and evidence visuals, never a second market board.
 * Pulse owns the full Markets / Movers / Crypto / Intl workspace.
 */
export function HomeOverview() {
  return (
    <div className="pulse-dashboard pulse-home home-overview">
      <HomePersonalBrief />
    </div>
  );
}
