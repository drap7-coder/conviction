/**
 * Watchlist persistence layer.
 * Stored under `conviction:watchlist` in KV, with local JSON fallback.
 *
 * In production (KV), the watchlist is durable across deployments.
 * When KV is not configured, it falls back to a local JSON file
 * that is specific to the machine/environment (not durable on Vercel).
 *
 * The KV_ENABLED status is reported in the admin dashboard so it's
 * clear whether storage is production-grade or local-development-only.
 */

import { kv } from "@vercel/kv";
import fs from "fs";
import path from "path";
import type { WatchlistEntry } from "./types";
import { SEED_WATCHLIST } from "./types";
import { getDefaultThesis } from "./priority-review";

const KV_KEY = "conviction:watchlist";
const KV_ENABLED = !!process.env.KV_URL && !!process.env.KV_REST_API_URL;

const LOCAL_STORE_DIR = path.join(process.cwd(), ".conviction");
const LOCAL_STORE_FILE = path.join(LOCAL_STORE_DIR, "watchlist.json");

let inMemoryCache: WatchlistEntry[] | null = null;

function normalizeEntry(entry: WatchlistEntry): WatchlistEntry {
  if (entry.thesis) return entry;
  return { ...entry, thesis: getDefaultThesis() };
}

function getDefaultEntries(): WatchlistEntry[] {
  return SEED_WATCHLIST.map((e) => normalizeEntry({ ...e }));
}

function readLocalEntries(): WatchlistEntry[] {
  try {
    if (fs.existsSync(LOCAL_STORE_FILE)) {
      const raw = fs.readFileSync(LOCAL_STORE_FILE, "utf-8");
      const parsed = JSON.parse(raw) as WatchlistEntry[];
      return parsed.map(normalizeEntry);
    }
  } catch {
    // Ignore read errors
  }
  return getDefaultEntries();
}

function writeLocalEntries(entries: WatchlistEntry[]): void {
  try {
    if (!fs.existsSync(LOCAL_STORE_DIR)) {
      fs.mkdirSync(LOCAL_STORE_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(entries, null, 2), "utf-8");
  } catch (err) {
    console.warn("[watchlist] Failed to write local store:", err);
  }
}

/**
 * Get the watchlist from persistent storage.
 * Returns seed entries if nothing is stored yet (first run migration).
 */
export async function getWatchlist(): Promise<WatchlistEntry[]> {
  if (inMemoryCache) return inMemoryCache.map(normalizeEntry);

  if (KV_ENABLED) {
    try {
      const stored = await kv.get<WatchlistEntry[]>(KV_KEY);
      if (stored && Array.isArray(stored) && stored.length > 0) {
        inMemoryCache = stored;
        return stored.map(normalizeEntry);
      }
      // First run — seed the watchlist
      const seeded = getDefaultEntries();
      await kv.set(KV_KEY, seeded);
      inMemoryCache = seeded;
      return seeded;
    } catch (err) {
      console.warn("[watchlist] KV read failed, falling back to local:", err);
    }
  }

  inMemoryCache = readLocalEntries();
  return inMemoryCache;
}

/**
 * Persist the watchlist.
 */
export async function saveWatchlist(entries: WatchlistEntry[]): Promise<void> {
  inMemoryCache = entries;

  if (KV_ENABLED) {
    try {
      await kv.set(KV_KEY, entries);
      return;
    } catch (err) {
      console.warn("[watchlist] KV write failed, falling back to local:", err);
    }
  }

  writeLocalEntries(entries);
}

/**
 * Add an entry to the watchlist (no-op if duplicate).
 * Returns the updated watchlist.
 */
export async function addToWatchlist(entry: WatchlistEntry): Promise<{
  success: boolean;
  entries: WatchlistEntry[];
  error?: string;
}> {
  const entries = await getWatchlist();

  if (entries.some((e) => e.ticker === entry.ticker)) {
    return { success: false, entries, error: `${entry.ticker} is already on your watchlist` };
  }

  entries.push(entry);
  await saveWatchlist(entries);
  return { success: true, entries };
}

/**
 * Remove an entry from the watchlist by ticker.
 * Does not delete historical transaction data.
 */
export async function removeFromWatchlist(ticker: string): Promise<{
  success: boolean;
  entries: WatchlistEntry[];
  error?: string;
}> {
  const entries = await getWatchlist();
  const idx = entries.findIndex((e) => e.ticker === ticker);

  if (idx === -1) {
    return { success: false, entries, error: `${ticker} is not on your watchlist` };
  }

  const updated = entries.filter((e) => e.ticker !== ticker);
  await saveWatchlist(updated);
  return { success: true, entries: updated };
}

/**
 * Update the sync time and status for a ticker.
 */
export async function updateWatchlistSync(
  ticker: string,
  status: WatchlistEntry["status"],
  statusMessage?: string,
): Promise<void> {
  const entries = await getWatchlist();
  const entry = entries.find((e) => e.ticker === ticker);
  if (!entry) return;

  entry.lastSyncedAt = new Date().toISOString();
  entry.status = status;
  if (statusMessage !== undefined) {
    entry.statusMessage = statusMessage;
  }
  await saveWatchlist(entries);
}

/**
 * Check whether KV persistence is active.
 */
export function isKvEnabled(): boolean {
  return KV_ENABLED;
}

/**
 * Get only active (supported) tickers from the watchlist.
 */
export async function getActiveTickers(): Promise<string[]> {
  const entries = await getWatchlist();
  return entries.filter((e) => e.status === "active").map((e) => e.ticker);
}

/**
 * Get watchlist entries sorted by lastSyncedAt ascending (least-recently-synced first).
 */
export async function getWatchlistSortedBySyncPriority(): Promise<WatchlistEntry[]> {
  const entries = await getWatchlist();
  const active = entries.filter((e) => e.status === "active");

  active.sort((a, b) => {
    if (!a.lastSyncedAt && !b.lastSyncedAt) return 0;
    if (!a.lastSyncedAt) return -1;
    if (!b.lastSyncedAt) return 1;
    return a.lastSyncedAt.localeCompare(b.lastSyncedAt);
  });

  return active;
}