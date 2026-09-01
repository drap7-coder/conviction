import type { PersistedPosition } from "@/lib/portfolio/persist";
import type {
  CrowdBook,
  CrowdHoldingRank,
  CrowdSnapshot,
  CrowdWatchRank,
} from "@/lib/crowd/types";

function positionWeightMap(positions: PersistedPosition[]): Map<string, number> {
  const weights = new Map<string, number>();
  let total = 0;
  const valued = positions.map((p) => {
    const cost = p.averageCost;
    const value =
      cost !== undefined && Number.isFinite(cost) && cost > 0
        ? p.shares * cost
        : null;
    return { ticker: p.ticker.toUpperCase(), value };
  });

  const allValued = valued.every((row) => row.value !== null);
  if (allValued) {
    for (const row of valued) total += row.value as number;
    if (total > 0) {
      for (const row of valued) {
        weights.set(row.ticker, ((row.value as number) / total) * 100);
      }
      return weights;
    }
  }

  const equal = positions.length > 0 ? 100 / positions.length : 0;
  for (const p of positions) {
    weights.set(p.ticker.toUpperCase(), equal);
  }
  return weights;
}

type HolderEntry = {
  count: number;
  liveCount: number;
  seedCount: number;
  weightSum: number;
  weightN: number;
};

/** Rank tickers by how many books hold them (classic “most owned”). */
export function rankCrowdHoldings(books: CrowdBook[]): CrowdHoldingRank[] {
  const bookCount = books.length;
  if (bookCount === 0) return [];

  const holders = new Map<string, HolderEntry>();

  for (const book of books) {
    if (book.positions.length === 0) continue;
    const weights = positionWeightMap(book.positions);
    const seen = new Set<string>();
    const isLive = book.source === "live";
    for (const position of book.positions) {
      const ticker = position.ticker.toUpperCase();
      if (seen.has(ticker)) continue;
      seen.add(ticker);
      const entry = holders.get(ticker) ?? {
        count: 0,
        liveCount: 0,
        seedCount: 0,
        weightSum: 0,
        weightN: 0,
      };
      entry.count += 1;
      if (isLive) entry.liveCount += 1;
      else entry.seedCount += 1;
      const weight = weights.get(ticker);
      if (weight !== undefined && Number.isFinite(weight)) {
        entry.weightSum += weight;
        entry.weightN += 1;
      }
      holders.set(ticker, entry);
    }
  }

  return [...holders.entries()]
    .map(([ticker, entry]) => ({
      ticker,
      holderCount: entry.count,
      liveHolderCount: entry.liveCount,
      seedHolderCount: entry.seedCount,
      bookCount,
      holderPct: Math.round((entry.count / bookCount) * 1000) / 10,
      avgWeightPct:
        entry.weightN > 0
          ? Math.round((entry.weightSum / entry.weightN) * 10) / 10
          : null,
    }))
    .sort((a, b) => {
      if (b.holderCount !== a.holderCount) return b.holderCount - a.holderCount;
      // Live participation breaks ties — not diluted by starter-only matches.
      if (b.liveHolderCount !== a.liveHolderCount) return b.liveHolderCount - a.liveHolderCount;
      const aw = a.avgWeightPct ?? 0;
      const bw = b.avgWeightPct ?? 0;
      if (bw !== aw) return bw - aw;
      return a.ticker.localeCompare(b.ticker);
    });
}

/** Rank tickers by how many watchlists follow them. */
export function rankCrowdWatched(books: CrowdBook[]): CrowdWatchRank[] {
  const lists = books.filter((book) => book.watchlist.length > 0);
  const listCount = lists.length;
  if (listCount === 0) return [];

  const watchers = new Map<
    string,
    { count: number; liveCount: number; seedCount: number }
  >();

  for (const book of lists) {
    const seen = new Set<string>();
    const isLive = book.source === "live";
    for (const raw of book.watchlist) {
      const ticker = raw.toUpperCase();
      if (seen.has(ticker)) continue;
      seen.add(ticker);
      const entry = watchers.get(ticker) ?? { count: 0, liveCount: 0, seedCount: 0 };
      entry.count += 1;
      if (isLive) entry.liveCount += 1;
      else entry.seedCount += 1;
      watchers.set(ticker, entry);
    }
  }

  return [...watchers.entries()]
    .map(([ticker, entry]) => ({
      ticker,
      watcherCount: entry.count,
      liveWatcherCount: entry.liveCount,
      seedWatcherCount: entry.seedCount,
      listCount,
      watcherPct: Math.round((entry.count / listCount) * 1000) / 10,
    }))
    .sort((a, b) => {
      if (b.watcherCount !== a.watcherCount) return b.watcherCount - a.watcherCount;
      if (b.liveWatcherCount !== a.liveWatcherCount) return b.liveWatcherCount - a.liveWatcherCount;
      return a.ticker.localeCompare(b.ticker);
    });
}

export function buildCrowdSnapshot(books: CrowdBook[], now = new Date()): CrowdSnapshot {
  const seedBookCount = books.filter((book) => book.source === "seed").length;
  const liveBookCount = books.filter((book) => book.source === "live").length;
  const listCount = books.filter((book) => book.watchlist.length > 0).length;

  return {
    bookCount: books.length,
    liveBookCount,
    seedBookCount,
    listCount,
    includesDemoBooks: seedBookCount > 0,
    held: rankCrowdHoldings(books),
    watched: rankCrowdWatched(books),
    generatedAt: now.toISOString(),
  };
}
