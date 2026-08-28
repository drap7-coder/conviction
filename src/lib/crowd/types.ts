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
  bookCount: number;
  /** 0–100 share of books that hold this ticker. */
  holderPct: number;
  /** Average weight among holders when cost basis exists; otherwise null. */
  avgWeightPct: number | null;
};

export type CrowdWatchRank = {
  ticker: string;
  watcherCount: number;
  listCount: number;
  /** 0–100 share of watchlists that follow this ticker. */
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
