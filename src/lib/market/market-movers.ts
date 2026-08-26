import { isFiniteNumber } from "@/lib/display/format";

export interface MarketMoverRow {
  ticker: string;
  name: string;
  /** Regular-session % used to rank Top / Bottom. */
  changePercent: number;
  /** Display last: RTH close in extended hours, live when open. */
  price?: number | null;
  /** Regular-session $ change. */
  change?: number | null;
  extendedPrice?: number | null;
  extendedChange?: number | null;
  extendedChangePercent?: number | null;
  extendedNoTrades?: boolean;
  sessionLabel?: "Pre-Market" | "After Hours" | null;
}

export interface MarketMoversSplit {
  top: MarketMoverRow[];
  bottom: MarketMoverRow[];
}

/**
 * Split a quote set into CNBC-style Top (gainers) / Bottom (losers) by session %.
 * Rows without a usable % are dropped. Each side is capped at `limit`.
 */
export function splitMarketMovers(
  items: Array<{
    ticker: string;
    name: string;
    changePercent: number | null | undefined;
    price?: number | null;
    change?: number | null;
    extendedPrice?: number | null;
    extendedChange?: number | null;
    extendedChangePercent?: number | null;
    extendedNoTrades?: boolean;
    sessionLabel?: "Pre-Market" | "After Hours" | null;
  }>,
  limit = 5,
): MarketMoversSplit {
  const capped = Math.max(1, Math.min(10, limit));
  const usable: MarketMoverRow[] = items
    .filter((item) => isFiniteNumber(item.changePercent) && item.changePercent !== 0)
    .map((item) => ({
      ticker: item.ticker,
      name: item.name,
      changePercent: item.changePercent as number,
      price: item.price ?? null,
      change: item.change ?? null,
      extendedPrice: item.extendedPrice ?? null,
      extendedChange: item.extendedChange ?? null,
      extendedChangePercent: item.extendedChangePercent ?? null,
      extendedNoTrades: item.extendedNoTrades ?? false,
      sessionLabel: item.sessionLabel ?? null,
    }));

  const top = usable
    .filter((item) => item.changePercent > 0)
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, capped);

  const bottom = usable
    .filter((item) => item.changePercent < 0)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, capped);

  return { top, bottom };
}

/** Bar fill height 0–100 relative to the largest |%| in the column. */
export function moverBarHeight(changePercent: number, columnMaxAbs: number): number {
  if (!isFiniteNumber(changePercent) || columnMaxAbs <= 0) return 0;
  return Math.max(8, Math.min(100, (Math.abs(changePercent) / columnMaxAbs) * 100));
}
