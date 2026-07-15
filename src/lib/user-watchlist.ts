import { query, isDatabaseConfigured } from "@/lib/db";
import type { WatchlistEntry } from "@/lib/watchlist/types";

export interface UserWatchlistEntry extends WatchlistEntry {
  id: string;
  note: string;
}

interface UserWatchlistRow {
  [key: string]: unknown;
  id: string;
  ticker: string;
  note: string | null;
  company_name: string;
  cik: string | null;
  status: WatchlistEntry["status"];
  status_message: string | null;
  created_at: Date | string;
}

function rowToEntry(row: UserWatchlistRow): UserWatchlistEntry {
  return {
    id: row.id,
    ticker: row.ticker,
    companyName: row.company_name,
    cik: row.cik ?? undefined,
    note: row.note ?? "",
    addedAt: new Date(row.created_at).toISOString(),
    status: row.status,
    statusMessage: row.status_message ?? undefined,
  };
}

export function isUserWatchlistAvailable() {
  return isDatabaseConfigured();
}

export async function getUserWatchlist(userId: string): Promise<UserWatchlistEntry[]> {
  if (!isDatabaseConfigured()) return [];

  const result = await query<UserWatchlistRow>(
    `select id, ticker, note, company_name, cik, status, status_message, created_at
     from watchlist_entries
     where user_id = $1
     order by created_at asc`,
    [userId],
  );

  return result.rows.map(rowToEntry);
}

export async function addUserWatchlistEntry(
  userId: string,
  entry: WatchlistEntry,
): Promise<{ success: boolean; entries: UserWatchlistEntry[]; error?: string }> {
  if (!isDatabaseConfigured()) {
    return { success: false, entries: [], error: "Sign-in storage is not configured yet" };
  }

  const result = await query<UserWatchlistRow>(
    `insert into watchlist_entries (user_id, ticker, company_name, cik, status, status_message)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (user_id, ticker) do nothing
     returning id, ticker, note, company_name, cik, status, status_message, created_at`,
    [userId, entry.ticker.toUpperCase(), entry.companyName, entry.cik ?? null, entry.status, entry.statusMessage ?? null],
  );

  const entries = await getUserWatchlist(userId);
  if (result.rowCount === 0) {
    return { success: false, entries, error: `${entry.ticker} is already saved` };
  }

  return { success: true, entries };
}

export async function removeUserWatchlistEntry(
  userId: string,
  ticker: string,
): Promise<{ success: boolean; entries: UserWatchlistEntry[]; error?: string }> {
  if (!isDatabaseConfigured()) {
    return { success: false, entries: [], error: "Sign-in storage is not configured yet" };
  }

  const result = await query(
    `delete from watchlist_entries
     where user_id = $1 and ticker = $2`,
    [userId, ticker.toUpperCase()],
  );
  const entries = await getUserWatchlist(userId);

  if (result.rowCount === 0) {
    return { success: false, entries, error: `${ticker.toUpperCase()} is not saved` };
  }

  return { success: true, entries };
}

export async function updateUserWatchlistNote(
  userId: string,
  ticker: string,
  note: string,
): Promise<{ success: boolean; entries: UserWatchlistEntry[]; error?: string }> {
  if (!isDatabaseConfigured()) {
    return { success: false, entries: [], error: "Sign-in storage is not configured yet" };
  }

  const result = await query(
    `update watchlist_entries
     set note = $3
     where user_id = $1 and ticker = $2`,
    [userId, ticker.toUpperCase(), note.slice(0, 1000)],
  );
  const entries = await getUserWatchlist(userId);

  if (result.rowCount === 0) {
    return { success: false, entries, error: `${ticker.toUpperCase()} is not saved` };
  }

  return { success: true, entries };
}

export async function migrateUserWatchlist(
  userId: string,
  entries: WatchlistEntry[],
): Promise<{ imported: number; entries: UserWatchlistEntry[] }> {
  if (!isDatabaseConfigured()) return { imported: 0, entries: [] };

  let imported = 0;
  for (const entry of entries) {
    const result = await query(
      `insert into watchlist_entries (user_id, ticker, company_name, cik, status, status_message)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (user_id, ticker) do nothing`,
      [
        userId,
        entry.ticker.toUpperCase(),
        entry.companyName,
        entry.cik ?? null,
        entry.status,
        entry.statusMessage ?? null,
      ],
    );
    if ((result.rowCount ?? 0) > 0) imported += 1;
  }

  return { imported, entries: await getUserWatchlist(userId) };
}
