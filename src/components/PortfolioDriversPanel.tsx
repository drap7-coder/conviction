"use client";

import {
  MoveDriversPanel,
  type MoveDriverHolding,
} from "@/components/MoveDriversPanel";

export type PortfolioDriverHolding = MoveDriverHolding;

/**
 * Portfolio-scoped What’s driving the move carousel.
 */
export function PortfolioDriversPanel({ holdings }: { holdings: PortfolioDriverHolding[] }) {
  return (
    <MoveDriversPanel
      holdings={holdings}
      title="What’s driving the move"
      lede="Headlines and themes behind your holdings’ session moves."
    />
  );
}
