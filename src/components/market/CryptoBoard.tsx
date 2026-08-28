"use client";

import type { PulseGlobalMarket } from "@/app/api/market/pulse/route";
import { MarketScoreboard } from "@/components/market/IndexScoreboard";

/** Crypto as an index-style board on the Pulse Crypto slicer view. */
export function CryptoBoard({ markets }: { markets: PulseGlobalMarket[] }) {
  if (markets.length === 0) return null;

  return (
    <div className="pulse-crypto-board">
      <MarketScoreboard title="Crypto" rows={markets} />
    </div>
  );
}
