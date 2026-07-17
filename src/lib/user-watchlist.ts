import { query, isDatabaseConfigured } from "@/lib/db";
import type { WatchlistEntry, ThesisStatus, WatchlistThesis } from "@/lib/watchlist/types";

export interface UserWatchlistEntry extends WatchlistEntry {
  id: string;
  note: string;
  thesis?: WatchlistThesis;
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
  thesis?: string;
  invalidation?: string;
  review_at?: string | null;
  thesis_status?: ThesisStatus;
}

const THESIS_LENGTH_LIMIT = 1000;

function rowToEntry(row: UserWatchlistRow): UserWatchlistEntry {
  const thesis: WatchlistThesis | undefined =
    row.thesis !== undefined ||
    row.invalidation !== undefined ||
    row.review_at !== undefined ||
    row.thesis_status !== undefined
      ? {
          thesis: row.thesis?.slice(0, THESIS_LENGTH_LIMIT) ?? "",
          invalidation: row.invalidation?.slice(0, THESIS_LENGTH_LIMIT) ?? "",
          reviewAt: row.review_at ?? null,
          status: row.thesis_status ?? "building",
        }
      : undefined;

  return {
    id: row.id,
    ticker: row.ticker,
    companyName: row.company_name,
    cik: row.cik ?? undefined,
    note: row.note ?? "",
    addedAt: new Date(row.created_at).toISOString(),
    status: row.status,
    statusMessage: row.status_message ?? undefined,
    thesis,
  };
}

export function isUserWatchlistAvailable() {
  return isDatabaseConfigured();
}

export async function getUserWatchlist(userId: string): Promise<UserWatchlistEntry[]> {
  if (!isDatabaseConfigured()) return [];

  const result = await query<UserWatchlistRow>(
    `select id, ticker, note, company_name, cik, status, status_message, created_at,
            thesis, invalidation, review_at, thesis_status
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
    return { success: false, entries: [], error: "Private watchlist storage is temporarily unavailable" };
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
    return { success: false, entries: [], error: "Private watchlist storage is temporarily unavailable" };
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
    return { success: false, entries: [], error: "Private watchlist storage is temporarily unavailable" };
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

/**
 * Update thesis for a watchlist entry.
 * Returns the updated watchlist.
 */
export async function updateUserWatchlistThesis(
  userId: string,
  ticker: string,
  thesis: Pick<WatchlistThesis, "thesis" | "invalidation" | "reviewAt" | "status">,
): Promise<{ success: boolean; entries: UserWatchlistEntry[]; error?: string }> {
  if (!isDatabaseConfigured()) {
    return { success: false, entries: [], error: "Private watchlist storage is temporarily unavailable" };
  }

  const validation = validateThesisInput(thesis);
  if (!validation.valid) {
    return { success: false, entries: [], error: validation.error };
  }

  const result = await query<UserWatchlistRow>(
    `update watchlist_entries
     set thesis = $3, invalidation = $4, review_at = $5, thesis_status = $6
     where user_id = $1 and ticker = $2`,
    [
      userId,
      ticker.toUpperCase(),
      thesis.thesis.slice(0, THESIS_LENGTH_LIMIT),
      thesis.invalidation.slice(0, THESIS_LENGTH_LIMIT),
      thesis.reviewAt,
      thesis.status,
    ],
  );
  const entries = await getUserWatchlist(userId);

  if (result.rowCount === 0) {
    return { success: false, entries, error: `${ticker.toUpperCase()} is not saved` };
  }

  return { success: true, entries };
}

/**
 * Validate thesis input.
 */
export function validateThesisInput(
  thesis: Pick<WatchlistThesis, "thesis" | "invalidation" | "reviewAt" | "status">,
): { valid: true } | { valid: false; error: string } {
  const validStatuses: ThesisStatus[] = ["building", "supported", "review", "weakening", "broken"];

  if (!validStatuses.includes(thesis.status)) {
    return { valid: false, error: "Invalid thesis status" };
  }

  if (thesis.reviewAt !== null) {
    const date = new Date(thesis.reviewAt);
    if (isNaN(date.getTime())) {
      return { valid: false, error: "Invalid review date" };
    }
  }

  return { valid: true };
}
