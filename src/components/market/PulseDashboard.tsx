"use client";

import { PulseMarketBoard } from "@/components/market/PulseMarketBoard";

/**
 * Pulse workspace — Markets / Movers / Crypto / Intl.
 * Home (`/`) is the personal daily brief — not a second Pulse.
 */
export function PulseDashboard() {
  return (
    <div className="pulse-dashboard">
      <PulseMarketBoard />
    </div>
  );
}
