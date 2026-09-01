import { isFiniteNumber } from "@/lib/display/format";

export interface MarketMoverRow {
  ticker: string;
  name: string;
  /**
   * Primary session % used to rank Top / Bottom and shown in the bold stack line.
   * Regular when the board is in RTH; pre/AH % when that badge is active.
   */
  changePercent: number;
  /** Display last for the ranked session (RTH close, or pre/AH print when ranking extended). */
  price?: number | null;
  /** Primary $ change for the ranked session. */
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

export type MarketMoversRankBy = "regular" | "extended";

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

export type SplitMarketMoversOptions = {
  /**
   * `regular` — rank on RTH `changePercent` (default).
   * `extended` — rank on pre/AH `extendedChangePercent` when that session badge is active.
   */
  rankBy?: MarketMoversRankBy;
};

function toRegularRankedRow(item: MoverInput, changePercent: number): MarketMoverRow {
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
 * Promote pre/AH into the primary stack slots so Gainers/Losers % matches the
 * session badge. Secondary Pre/AH line is cleared to avoid duplicating the same print.
 */
function toExtendedRankedRow(item: MoverInput, changePercent: number): MarketMoverRow {
  return {
    ticker: item.ticker,
    name: item.name,
    changePercent,
    price: item.extendedPrice ?? item.price ?? null,
    change: item.extendedChange ?? null,
    extendedPrice: null,
    extendedChange: null,
    extendedChangePercent: null,
    extendedNoTrades: false,
    sessionLabel: null,
    volume: item.volume ?? null,
    dollarVolume: item.dollarVolume ?? null,
  };
}

function toMoverRow(item: MoverInput, changePercent: number): MarketMoverRow {
  return toRegularRankedRow(item, changePercent);
}

/**
 * Split a quote set into CNBC-style Top (gainers) / Bottom (losers) by session %.
 * Rows without a usable % are dropped. Each side is capped at `limit`.
 *
 * When `rankBy: "extended"`, sort and primary display use pre/AH % so a
 * Pre-Market / After Hours badge matches the Gainers list order.
 */
export function splitMarketMovers(
  items: MoverInput[],
  limit = 5,
  options: SplitMarketMoversOptions = {},
): MarketMoversSplit {
  const capped = Math.max(1, Math.floor(limit));
  const rankBy = options.rankBy ?? "regular";

  const usable: MarketMoverRow[] =
    rankBy === "extended"
      ? items
          .filter(
            (item) =>
              !item.extendedNoTrades &&
              isFiniteNumber(item.extendedChangePercent) &&
              item.extendedChangePercent !== 0,
          )
          .map((item) =>
            toExtendedRankedRow(item, item.extendedChangePercent as number),
          )
      : items
          .filter(
            (item) =>
              isFiniteNumber(item.changePercent) && item.changePercent !== 0,
          )
          .map((item) =>
            toRegularRankedRow(item, item.changePercent as number),
          );

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

/** True when Pulse/Watchlist should rank Gainers on the extended session print. */
export function shouldRankMoversByExtended(
  sessionLabel: string | null | undefined,
): boolean {
  return sessionLabel === "Pre-Market" || sessionLabel === "After Hours";
}
