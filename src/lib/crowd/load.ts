import { isDatabaseConfigured, query } from "@/lib/db";
import { buildCrowdSnapshot } from "@/lib/crowd/aggregate";
import { ensureCrowdSeedBooks } from "@/lib/crowd/ensure-seeds";
import { isCrowdSeedUserId, listCrowdSeedBooks } from "@/lib/crowd/seed-books";
import type { CrowdBook, CrowdSnapshot } from "@/lib/crowd/types";
import type { PersistedPosition } from "@/lib/portfolio/persist";

interface PortfolioRow {
  [key: string]: unknown;
  user_id: string;
  ticker: string;
  shares: number;
  average_cost: number | null;
  note: string | null;
}

interface WatchlistRow {
  [key: string]: unknown;
  user_id: string;
  ticker: string;
}

function rowToPosition(row: PortfolioRow): PersistedPosition {
  return {
    ticker: row.ticker.toUpperCase(),
    shares: Number(row.shares),
    averageCost: row.average_cost === null ? undefined : Number(row.average_cost),
    note: row.note || undefined,
  };
}

async function loadLiveBooksFromDb(): Promise<CrowdBook[]> {
  const positionResult = await query<PortfolioRow>(
    `select user_id, ticker, shares, average_cost, note
     from portfolio_positions
     order by user_id asc, created_at asc`,
  );
  const watchResult = await query<WatchlistRow>(
    `select user_id, ticker
     from watchlist_entries
     where status = 'active'
     order by user_id asc, created_at asc`,
  );

  const byUser = new Map<string, CrowdBook>();

  for (const row of positionResult.rows) {
    const id = row.user_id;
    const existing = byUser.get(id) ?? {
      id,
      label: isCrowdSeedUserId(id) ? id : "Member",
      source: isCrowdSeedUserId(id) ? "seed" : "live",
      positions: [] as PersistedPosition[],
      watchlist: [] as string[],
    };
    existing.positions.push(rowToPosition(row));
    byUser.set(id, existing);
  }

  for (const row of watchResult.rows) {
    const id = row.user_id;
    const existing = byUser.get(id) ?? {
      id,
      label: isCrowdSeedUserId(id) ? id : "Member",
      source: isCrowdSeedUserId(id) ? "seed" : "live",
      positions: [] as PersistedPosition[],
      watchlist: [] as string[],
    };
    existing.watchlist.push(row.ticker.toUpperCase());
    byUser.set(id, existing);
  }

  return [...byUser.values()].filter(
    (book) => book.positions.length > 0 || book.watchlist.length > 0,
  );
}

/**
 * Load Crowd books: Neon (after ensuring seeds) when configured,
 * otherwise in-memory starter books so guest/dev still sees a board.
 */
export async function loadCrowdBooks(): Promise<CrowdBook[]> {
  if (!isDatabaseConfigured()) {
    return listCrowdSeedBooks();
  }

  try {
    await ensureCrowdSeedBooks();
    return await loadLiveBooksFromDb();
  } catch {
    // DB hiccup — still show starter books so the page is never empty.
    return listCrowdSeedBooks();
  }
}

export async function loadCrowdSnapshot(): Promise<CrowdSnapshot> {
  const books = await loadCrowdBooks();
  return buildCrowdSnapshot(books);
}
