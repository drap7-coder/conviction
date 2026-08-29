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
  /** Share volume (shares) when available. */
  volume?: number | null;
  /** Notional volume when available — preferred for Highest volume ranking. */
  dollarVolume?: number | null;
}

export interface MarketMoversSplit {
  top: MarketMoverRow[];
  bottom: MarketMoverRow[];
}

type MoverInput = {
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
  volume?: number | null;
  dollarVolume?: number | null;
};

function toMoverRow(item: MoverInput, changePercent: number): MarketMoverRow {
  return {
    ticker: item.ticker,
    name: item.name,
    changePercent,
    price: item.price ?? null,
    change: item.change ?? null,
    extendedPrice: item.extendedPrice ?? null,
    extendedChange: item.extendedChange ?? null,
    extendedChangePercent: item.extendedChangePercent ?? null,
    extendedNoTrades: item.extendedNoTrades ?? false,
    sessionLabel: item.sessionLabel ?? null,
    volume: item.volume ?? null,
    dollarVolume: item.dollarVolume ?? null,
  };
}

/**
 * Split a quote set into CNBC-style Top (gainers) / Bottom (losers) by session %.
 * Rows without a usable % are dropped. Each side is capped at `limit`.
 */
export function splitMarketMovers(
  items: MoverInput[],
  limit = 5,
): MarketMoversSplit {
  const capped = Math.max(1, Math.floor(limit));
  const usable: MarketMoverRow[] = items
    .filter((item) => isFiniteNumber(item.changePercent) && item.changePercent !== 0)
    .map((item) => toMoverRow(item, item.changePercent as number));

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

/** Rank by dollar volume (fallback: share volume). Cap at `limit`. */
export function rankByVolume(items: MoverInput[], limit = 5): MarketMoverRow[] {
  const capped = Math.max(1, Math.floor(limit));
  return items
    .map((item) => {
      const changePercent = isFiniteNumber(item.changePercent) ? (item.changePercent as number) : 0;
      return toMoverRow(item, changePercent);
    })
    .filter((item) => {
      const notional = item.dollarVolume;
      const shares = item.volume;
      return (isFiniteNumber(notional) && (notional as number) > 0)
        || (isFiniteNumber(shares) && (shares as number) > 0);
    })
    .sort((a, b) => {
      const aVol = (a.dollarVolume ?? 0) > 0 ? (a.dollarVolume as number) : (a.volume as number);
      const bVol = (b.dollarVolume ?? 0) > 0 ? (b.dollarVolume as number) : (b.volume as number);
      return bVol - aVol;
    })
    .slice(0, capped);
}

/** Bar fill height 0–100 relative to the largest |%| in the column. */
export function moverBarHeight(changePercent: number, columnMaxAbs: number): number {
  if (!isFiniteNumber(changePercent) || columnMaxAbs <= 0) return 0;
  return Math.max(8, Math.min(100, (Math.abs(changePercent) / columnMaxAbs) * 100));
}
