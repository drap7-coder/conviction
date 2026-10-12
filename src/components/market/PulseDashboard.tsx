"use client";

import { PulseMarketBoard } from "@/components/market/PulseMarketBoard";

/**
 * Pulse workspace — Markets / Movers / Crypto / Intl only.
 * The four-section homepage overview lives on `/` (`HomeOverview`).
 */
export function PulseDashboard() {
  return (
    <div className="pulse-dashboard">
      <PulseMarketBoard variant="pulse" />
    </div>
  );
}
