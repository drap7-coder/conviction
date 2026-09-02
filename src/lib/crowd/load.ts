import { isDatabaseConfigured, query } from "@/lib/db";
import { buildCrowdSnapshot } from "@/lib/crowd/aggregate";
import { ensureCrowdSeedBooksIfNeeded } from "@/lib/crowd/ensure-seeds";
import { isCrowdSeedUserId, listCrowdSeedBooks } from "@/lib/crowd/seed-books";
import { SEED_BOOK_GROUP_IDS } from "@/lib/groups/seed-groups";
import { ensureSeedGroups } from "@/lib/groups/store";
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

interface MembershipRow {
  [key: string]: unknown;
  user_id: string;
  group_id: string;
}

function rowToPosition(row: PortfolioRow): PersistedPosition {
  return {
    ticker: row.ticker.toUpperCase(),
    shares: Number(row.shares),
    averageCost: row.average_cost === null ? undefined : Number(row.average_cost),
    note: row.note || undefined,
  };
}

function withSeedGroupIds(books: CrowdBook[]): CrowdBook[] {
  return books.map((book) => ({
    ...book,
    groupIds: book.groupIds ?? SEED_BOOK_GROUP_IDS[book.id] ?? [],
  }));
}

async function attachLiveGroupIds(books: CrowdBook[]): Promise<CrowdBook[]> {
  try {
    const result = await query<MembershipRow>(
      `select user_id, group_id from user_group_memberships`,
    );
    const byUser = new Map<string, string[]>();
    for (const row of result.rows) {
      const list = byUser.get(row.user_id) ?? [];
      list.push(row.group_id);
      byUser.set(row.user_id, list);
    }
    return books.map((book) => ({
      ...book,
      groupIds: byUser.get(book.id) ?? SEED_BOOK_GROUP_IDS[book.id] ?? [],
    }));
  } catch {
    return withSeedGroupIds(books);
  }
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

  const books = [...byUser.values()].filter(
    (book) => book.positions.length > 0 || book.watchlist.length > 0,
  );
  return attachLiveGroupIds(books);
}

/**
 * Load Crowd books: Neon (after ensuring seeds) when configured,
 * otherwise in-memory starter books so guest/dev still sees a board.
 */
export async function loadCrowdBooks(): Promise<CrowdBook[]> {
  if (!isDatabaseConfigured()) {
    return withSeedGroupIds(listCrowdSeedBooks());
  }

  try {
    await ensureCrowdSeedBooksIfNeeded();
    await ensureSeedGroups();
    return await loadLiveBooksFromDb();
  } catch {
    return withSeedGroupIds(listCrowdSeedBooks());
  }
}

export async function loadCrowdSnapshot(groupId?: string | null): Promise<CrowdSnapshot> {
  const books = await loadCrowdBooks();
  const scoped = groupId
    ? books.filter((book) => (book.groupIds ?? []).includes(groupId))
    : books;
  return buildCrowdSnapshot(scoped);
}
