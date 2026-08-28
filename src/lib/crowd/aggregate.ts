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

/** Rank tickers by how many books hold them (classic “most owned”). */
export function rankCrowdHoldings(books: CrowdBook[]): CrowdHoldingRank[] {
  const bookCount = books.length;
  if (bookCount === 0) return [];

  const holders = new Map<string, { count: number; weightSum: number; weightN: number }>();

  for (const book of books) {
    if (book.positions.length === 0) continue;
    const weights = positionWeightMap(book.positions);
    const seen = new Set<string>();
    for (const position of book.positions) {
      const ticker = position.ticker.toUpperCase();
      if (seen.has(ticker)) continue;
      seen.add(ticker);
      const entry = holders.get(ticker) ?? { count: 0, weightSum: 0, weightN: 0 };
      entry.count += 1;
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
      bookCount,
      holderPct: Math.round((entry.count / bookCount) * 1000) / 10,
      avgWeightPct:
        entry.weightN > 0
          ? Math.round((entry.weightSum / entry.weightN) * 10) / 10
          : null,
    }))
    .sort((a, b) => {
      if (b.holderCount !== a.holderCount) return b.holderCount - a.holderCount;
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

  const watchers = new Map<string, number>();
  for (const book of lists) {
    const seen = new Set<string>();
    for (const raw of book.watchlist) {
      const ticker = raw.toUpperCase();
      if (seen.has(ticker)) continue;
      seen.add(ticker);
      watchers.set(ticker, (watchers.get(ticker) ?? 0) + 1);
    }
  }

  return [...watchers.entries()]
    .map(([ticker, watcherCount]) => ({
      ticker,
      watcherCount,
      listCount,
      watcherPct: Math.round((watcherCount / listCount) * 1000) / 10,
    }))
    .sort((a, b) => {
      if (b.watcherCount !== a.watcherCount) return b.watcherCount - a.watcherCount;
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
