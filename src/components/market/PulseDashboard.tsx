"use client";

import { PulseMarketBoard } from "@/components/market/PulseMarketBoard";

/**
 * Pulse workspace — Markets / Movers / Crypto / Intl.
 * Home (`/`) is the public macro glance; Portfolio owns personal names.
 */
export function PulseDashboard() {
  return (
    <div className="pulse-dashboard">
      <PulseMarketBoard />
    </div>
  );
}
