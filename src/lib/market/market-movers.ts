import { isFiniteNumber } from "@/lib/display/format";
import type { MarketSession } from "@/lib/market/live-quote";

/** Canonical movers board session — independent of Yahoo marketState strings. */
export type MoversActiveSession = "PRE_MARKET" | "REGULAR" | "AFTER_HOURS";

export type MoversSessionDisplayLabel = "Pre-Market" | "After Hours";

export interface MarketMoverRow {
  ticker: string;
  name: string;
  /**
   * Primary session % used to rank Top / Bottom and shown in the bold stack line.
   * Bound to the active session only (never a prior-session fallback while ranking).
   */
  changePercent: number;
  /** Display last for the ranked / active session. */
  price?: number | null;
  /** Primary $ change for the ranked / active session. */
  change?: number | null;
  /** Secondary line: prior RTH close when ranking extended, else unused. */
  extendedPrice?: number | null;
  extendedChange?: number | null;
  extendedChangePercent?: number | null;
  extendedNoTrades?: boolean;
  sessionLabel?: MoversSessionDisplayLabel | null;
  /**
   * When true, primary is the live pre/AH print and the secondary icon line
   * carries the prior regular-session close.
   */
  priorCloseSecondary?: boolean;
  /** Share volume (shares) when available — totalVolume fallback for ranking. */
  volume?: number | null;
  /** Notional volume when available — preferred for Highest volume ranking. */
  dollarVolume?: number | null;
  /** True when this name was excluded from off-hours ranking for missing prints. */
  insufficientData?: boolean;
}

export interface MarketMoversSplit {
  top: MarketMoverRow[];
  bottom: MarketMoverRow[];
}

/** @deprecated Prefer `MoversActiveSession` via `resolveMoversActiveSession`. */
export type MarketMoversRankBy = "regular" | "extended";

export type MoverInput = {
  ticker: string;
  name: string;
  /** Regular-session (RTH) % — `regularSessionChangePct`. */
  changePercent: number | null | undefined;
  /** Regular-session last — `currentPrice`. */
  price?: number | null;
  /** Regular-session $ — `regularSessionChange`. */
  change?: number | null;
  /**
   * Active off-hours print when the board is Pre-Market / After Hours
   * (`preMarket*` / `afterHours*` mapped by the caller).
   */
  extendedPrice?: number | null;
  extendedChange?: number | null;
  extendedChangePercent?: number | null;
  extendedNoTrades?: boolean;
  sessionLabel?: MoversSessionDisplayLabel | null;
  volume?: number | null;
  dollarVolume?: number | null;
};

/** Resolved metrics for the board’s active session. */
export type ActiveSessionMetrics = {
  session: MoversActiveSession;
  price: number | null;
  change: number | null;
  pct: number | null;
  volume: number | null;
  dollarVolume: number | null;
  /** Enough live session data to rank / display as a primary metric. */
  hasSessionData: boolean;
  insufficientData: boolean;
  displayLabel: MoversSessionDisplayLabel | null;
};

export type ResolveMoversSessionInput = {
  /** Per-quote extended label (Pre-Market / After Hours). */
  sessionLabel?: MoversSessionDisplayLabel | string | null;
  /** Optional tab / slicer override. */
  override?: MoversActiveSession | null;
  /** Clock-derived session from `getLivePrice` / eastern clock. */
  clockSession?: MarketSession | null;
};

export type SplitMarketMoversOptions = {
  /** Explicit board session. Wins over legacy `rankBy`. */
  session?: MoversActiveSession;
  /**
   * Legacy: `regular` → REGULAR, `extended` → PRE_MARKET/AFTER_HOURS via labels.
   * Prefer `session`.
   */
  rankBy?: MarketMoversRankBy;
};

export type RankByVolumeOptions = SplitMarketMoversOptions;

function displayLabelFor(session: MoversActiveSession): MoversSessionDisplayLabel | null {
  if (session === "PRE_MARKET") return "Pre-Market";
  if (session === "AFTER_HOURS") return "After Hours";
  return null;
}

/**
 * Centralized session resolver for Market Movers boards.
 * Tab override → quote session label → clock → REGULAR.
 */
export function resolveMoversActiveSession(
  input: ResolveMoversSessionInput = {},
): MoversActiveSession {
  if (input.override === "PRE_MARKET" || input.override === "REGULAR" || input.override === "AFTER_HOURS") {
    return input.override;
  }

  const label = input.sessionLabel ?? null;
  if (label === "Pre-Market") return "PRE_MARKET";
  if (label === "After Hours") return "AFTER_HOURS";

  if (input.clockSession === "pre_market") return "PRE_MARKET";
  if (input.clockSession === "after_hours") return "AFTER_HOURS";

  return "REGULAR";
}

export function moversSessionDisplayLabel(
  session: MoversActiveSession,
): MoversSessionDisplayLabel | null {
  return displayLabelFor(session);
}

/** True when Pulse/Watchlist should rank on the extended session print. */
export function shouldRankMoversByExtended(
  sessionLabel: string | null | undefined,
): boolean {
  return resolveMoversActiveSession({ sessionLabel }) !== "REGULAR";
}

export function isOffHoursMoversSession(session: MoversActiveSession): boolean {
  return session === "PRE_MARKET" || session === "AFTER_HOURS";
}

/**
 * Map stock fields onto the active session’s price / change / pct / volume.
 *
 * Pre-Market  → extended* (caller maps preMarket*)
 * After Hours → extended* (caller maps afterHours* / postMarket*)
 * Regular     → price / change / changePercent
 *
 * Off-hours never falls back to RTH % for ranking — missing prints are
 * `insufficientData` and must be excluded from Gainers / Losers / Volume.
 */
export function resolveActiveSessionMetrics(
  item: MoverInput,
  session: MoversActiveSession,
): ActiveSessionMetrics {
  const volume = isFiniteNumber(item.volume) ? (item.volume as number) : null;
  const dollarVolume = isFiniteNumber(item.dollarVolume)
    ? (item.dollarVolume as number)
    : null;

  if (isOffHoursMoversSession(session)) {
    const pct = isFiniteNumber(item.extendedChangePercent)
      ? (item.extendedChangePercent as number)
      : null;
    const price = isFiniteNumber(item.extendedPrice) ? (item.extendedPrice as number) : null;
    const change = isFiniteNumber(item.extendedChange) ? (item.extendedChange as number) : null;
    const hasSessionData =
      !item.extendedNoTrades && pct !== null && price !== null;
    return {
      session,
      price,
      change,
      pct,
      volume: hasSessionData ? volume : null,
      dollarVolume: hasSessionData ? dollarVolume : null,
      hasSessionData,
      insufficientData: !hasSessionData,
      displayLabel: displayLabelFor(session),
    };
  }

  const pct = isFiniteNumber(item.changePercent) ? (item.changePercent as number) : null;
  const price = isFiniteNumber(item.price) ? (item.price as number) : null;
  const change = isFiniteNumber(item.change) ? (item.change as number) : null;
  const hasSessionData = pct !== null;
  return {
    session: "REGULAR",
    price,
    change,
    pct,
    volume,
    dollarVolume,
    hasSessionData,
    insufficientData: !hasSessionData,
    displayLabel: null,
  };
}

function resolveSessionFromOptions(
  items: MoverInput[],
  options: SplitMarketMoversOptions,
): MoversActiveSession {
  if (options.session) return options.session;

  if (options.rankBy === "extended") {
    const label =
      items.find((item) => item.sessionLabel === "Pre-Market" || item.sessionLabel === "After Hours")
        ?.sessionLabel ?? "Pre-Market";
    return resolveMoversActiveSession({ sessionLabel: label });
  }

  if (options.rankBy === "regular") return "REGULAR";

  const label =
    items.find((item) => item.sessionLabel === "Pre-Market" || item.sessionLabel === "After Hours")
      ?.sessionLabel ?? null;
  return resolveMoversActiveSession({ sessionLabel: label });
}

/**
 * Dual-print stack for Pre-Market / AH boards:
 * bold primary = live extended print; secondary icon line = prior RTH close.
 */
function toActiveSessionRow(
  item: MoverInput,
  active: ActiveSessionMetrics,
): MarketMoverRow {
  if (isOffHoursMoversSession(active.session)) {
    const rthPct = isFiniteNumber(item.changePercent) ? (item.changePercent as number) : null;
    return {
      ticker: item.ticker,
      name: item.name,
      changePercent: active.pct as number,
      price: active.price,
      change: active.change,
      extendedPrice: item.price ?? null,
      extendedChange: item.change ?? null,
      extendedChangePercent: rthPct,
      extendedNoTrades: false,
      sessionLabel: active.displayLabel,
      priorCloseSecondary: true,
      volume: active.volume,
      dollarVolume: active.dollarVolume,
      insufficientData: false,
    };
  }

  return {
    ticker: item.ticker,
    name: item.name,
    changePercent: active.pct as number,
    price: active.price,
    change: active.change,
    extendedPrice: item.extendedPrice ?? null,
    extendedChange: item.extendedChange ?? null,
    extendedChangePercent: item.extendedChangePercent ?? null,
    extendedNoTrades: item.extendedNoTrades ?? false,
    sessionLabel: item.sessionLabel ?? null,
    priorCloseSecondary: false,
    volume: active.volume,
    dollarVolume: active.dollarVolume,
    insufficientData: false,
  };
}

/**
 * Align Highest volume rows with Gainers/Losers when the board session badge
 * is Pre-Market / After Hours: bold live print, prior close on the icon line.
 * Prefer building rows via `rankByVolume({ session })` instead.
 */
export function promoteMoversExtendedPrimary(row: MarketMoverRow): MarketMoverRow {
  if (
    row.priorCloseSecondary ||
    !row.sessionLabel ||
    row.extendedNoTrades ||
    !isFiniteNumber(row.extendedChangePercent)
  ) {
    return row;
  }
  return {
    ...row,
    price: row.extendedPrice ?? row.price ?? null,
    change: row.extendedChange ?? null,
    changePercent: row.extendedChangePercent as number,
    extendedPrice: row.price ?? null,
    extendedChange: row.change ?? null,
    extendedChangePercent: row.changePercent,
    extendedNoTrades: false,
    priorCloseSecondary: true,
  };
}

/**
 * Split a quote set into Gainers / Losers by the active session’s %.
 * Strict guardrails: Gainers require `pct > 0`, Losers `pct < 0`.
 * Off-hours names without a live print are excluded (no RTH fallback).
 */
export function splitMarketMovers(
  items: MoverInput[],
  limit = 5,
  options: SplitMarketMoversOptions = {},
): MarketMoversSplit {
  const capped = Math.max(1, Math.floor(limit));
  const session = resolveSessionFromOptions(items, options);

  const usable: MarketMoverRow[] = [];
  for (const item of items) {
    const active = resolveActiveSessionMetrics(item, session);
    if (!active.hasSessionData || active.pct === null || active.pct === 0) continue;
    usable.push(toActiveSessionRow(item, active));
  }

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

/**
 * Rank by dollar volume (fallback: share / total volume). Cap at `limit`.
 * Off-hours: only names with a live session print — never rank on RTH-only data.
 * Regular: volume can rank even when % is flat/missing (primary still binds active session).
 */
export function rankByVolume(
  items: MoverInput[],
  limit = 5,
  options: RankByVolumeOptions = {},
): MarketMoverRow[] {
  const capped = Math.max(1, Math.floor(limit));
  const session = resolveSessionFromOptions(items, options);
  const offHours = isOffHoursMoversSession(session);

  return items
    .map((item) => {
      const active = resolveActiveSessionMetrics(item, session);
      if (offHours && !active.hasSessionData) {
        return { active, row: null as MarketMoverRow | null };
      }

      const notional = offHours ? active.dollarVolume : (item.dollarVolume ?? null);
      const shares = offHours ? active.volume : (item.volume ?? null);
      const hasVolume =
        (isFiniteNumber(notional) && (notional as number) > 0)
        || (isFiniteNumber(shares) && (shares as number) > 0);
      if (!hasVolume) {
        return { active, row: null as MarketMoverRow | null };
      }

      // Volume cards may show a flat primary % in RTH; off-hours always have a print here.
      const pct = active.pct ?? 0;
      const row = toActiveSessionRow(item, {
        ...active,
        pct,
        volume: isFiniteNumber(shares) ? (shares as number) : null,
        dollarVolume: isFiniteNumber(notional) ? (notional as number) : null,
        hasSessionData: true,
        insufficientData: false,
      });
      return { active, row };
    })
    .filter((entry): entry is { active: ActiveSessionMetrics; row: MarketMoverRow } => entry.row !== null)
    .sort((a, b) => {
      const aVol = (a.row.dollarVolume ?? 0) > 0
        ? (a.row.dollarVolume as number)
        : (a.row.volume as number);
      const bVol = (b.row.dollarVolume ?? 0) > 0
        ? (b.row.dollarVolume as number)
        : (b.row.volume as number);
      return bVol - aVol;
    })
    .slice(0, capped)
    .map(({ row }) => row);
}

/** Bar fill height 0–100 relative to the largest |%| in the column. */
export function moverBarHeight(changePercent: number, columnMaxAbs: number): number {
  if (!isFiniteNumber(changePercent) || columnMaxAbs <= 0) return 0;
  return Math.max(8, Math.min(100, (Math.abs(changePercent) / columnMaxAbs) * 100));
}

/** Empty-column copy when the active session has no usable prints. */
export function moversInsufficientDataLabel(session: MoversActiveSession): string {
  if (session === "PRE_MARKET") return "Insufficient pre-market data.";
  if (session === "AFTER_HOURS") return "Insufficient after-hours data.";
  return "No names in this column.";
}
