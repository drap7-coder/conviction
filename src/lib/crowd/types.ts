import type { PersistedPosition } from "@/lib/portfolio/persist";

export type CrowdBookSource = "seed" | "live";

/** One member book used for Crowd aggregates (never shown as an identity). */
export type CrowdBook = {
  id: string;
  label: string;
  source: CrowdBookSource;
  positions: PersistedPosition[];
  /** Tickers on that member's watchlist (may be empty). */
  watchlist: string[];
};

export type CrowdHoldingRank = {
  ticker: string;
  holderCount: number;
  /** Books with source live that hold this ticker. */
  liveHolderCount: number;
  /** Starter seed books that hold this ticker. */
  seedHolderCount: number;
  bookCount: number;
  /** Derived share — not used as primary UI metric (rounding collapses ties). */
  holderPct: number;
  /** Average weight among holders when cost basis exists; otherwise null. */
  avgWeightPct: number | null;
};

export type CrowdWatchRank = {
  ticker: string;
  watcherCount: number;
  /** Live-member lists that watch this ticker. */
  liveWatcherCount: number;
  /** Starter lists that watch this ticker. */
  seedWatcherCount: number;
  listCount: number;
  /** Derived share — not used as primary UI metric (rounding collapses ties). */
  watcherPct: number;
};

export type CrowdSnapshot = {
  bookCount: number;
  liveBookCount: number;
  seedBookCount: number;
  listCount: number;
  includesDemoBooks: boolean;
  held: CrowdHoldingRank[];
  watched: CrowdWatchRank[];
  generatedAt: string;
};
