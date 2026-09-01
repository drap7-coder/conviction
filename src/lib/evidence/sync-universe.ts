/**
 * Evidence sync universe (ops / cron) — not a personal user watchlist.
 *
 * Guest SoT: browser localStorage. Signed-in SoT: Neon watchlist_entries.
 * This module is only the daily-sync / emerging-ideas ticker universe.
 *
 * Storage: KV `conviction:sync-universe` (falls back to legacy
 * `conviction:watchlist`), or `.conviction/sync-universe.json` locally
 * (falls back to legacy `watchlist.json`).
 */

import { kv } from "@vercel/kv";
import fs from "fs";
import path from "path";
import type { WatchlistEntry } from "@/lib/watchlist/types";
import { SEED_WATCHLIST } from "@/lib/watchlist/types";
import { SYNC_CONFIG } from "@/lib/sync/sync-config";
import { listPopularMemberWatchlistTickers } from "@/lib/user-watchlist";

const KV_KEY = "conviction:sync-universe";
const KV_KEY_LEGACY = "conviction:watchlist";
const KV_ENABLED = !!process.env.KV_URL && !!process.env.KV_REST_API_URL;

const LOCAL_STORE_DIR = path.join(process.cwd(), ".conviction");
const LOCAL_STORE_FILE = path.join(LOCAL_STORE_DIR, "sync-universe.json");
const LOCAL_STORE_FILE_LEGACY = path.join(LOCAL_STORE_DIR, "watchlist.json");

let inMemoryCache: WatchlistEntry[] | null = null;

function getDefaultEntries(): WatchlistEntry[] {
  return SEED_WATCHLIST.map((e) => ({ ...e }));
}

function readLocalEntries(): WatchlistEntry[] {
  for (const file of [LOCAL_STORE_FILE, LOCAL_STORE_FILE_LEGACY]) {
    try {
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, "utf-8");
        const parsed = JSON.parse(raw) as WatchlistEntry[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore read errors; try next path / seed.
    }
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
    console.warn("[sync-universe] Failed to write local store:", err);
  }
}

/** Load the ops sync universe from KV/JSON (seeded on first run). */
export async function getSyncUniverse(): Promise<WatchlistEntry[]> {
  if (inMemoryCache) return inMemoryCache;

  if (KV_ENABLED) {
    try {
      const stored =
        (await kv.get<WatchlistEntry[]>(KV_KEY)) ??
        (await kv.get<WatchlistEntry[]>(KV_KEY_LEGACY));
      if (stored && Array.isArray(stored) && stored.length > 0) {
        inMemoryCache = stored;
        // Migrate legacy key forward when present.
        if (!(await kv.get(KV_KEY))) {
          await kv.set(KV_KEY, stored).catch(() => undefined);
        }
        return stored;
      }
      const seeded = getDefaultEntries();
      await kv.set(KV_KEY, seeded);
      inMemoryCache = seeded;
      return seeded;
    } catch (err) {
      console.warn("[sync-universe] KV read failed, falling back to local:", err);
    }
  }

  inMemoryCache = readLocalEntries();
  return inMemoryCache;
}

export async function saveSyncUniverse(entries: WatchlistEntry[]): Promise<void> {
  inMemoryCache = entries;

  if (KV_ENABLED) {
    try {
      await kv.set(KV_KEY, entries);
      return;
    } catch (err) {
      console.warn("[sync-universe] KV write failed, falling back to local:", err);
    }
  }

  writeLocalEntries(entries);
}

export async function addToSyncUniverse(entry: WatchlistEntry): Promise<{
  success: boolean;
  entries: WatchlistEntry[];
  error?: string;
}> {
  const entries = await getSyncUniverse();

  if (entries.some((e) => e.ticker === entry.ticker)) {
    return { success: false, entries, error: `${entry.ticker} is already in the sync universe` };
  }

  entries.push(entry);
  await saveSyncUniverse(entries);
  return { success: true, entries };
}

export async function removeFromSyncUniverse(ticker: string): Promise<{
  success: boolean;
  entries: WatchlistEntry[];
  error?: string;
}> {
  const entries = await getSyncUniverse();
  const idx = entries.findIndex((e) => e.ticker === ticker);

  if (idx === -1) {
    return { success: false, entries, error: `${ticker} is not in the sync universe` };
  }

  const updated = entries.filter((e) => e.ticker !== ticker);
  await saveSyncUniverse(updated);
  return { success: true, entries: updated };
}

/** Touch sync metadata for a ticker already in the ops universe (no-op otherwise). */
export async function updateSyncUniverseStatus(
  ticker: string,
  status: WatchlistEntry["status"],
  statusMessage?: string,
): Promise<void> {
  const entries = await getSyncUniverse();
  const entry = entries.find((e) => e.ticker === ticker);
  if (!entry) return;

  entry.lastSyncedAt = new Date().toISOString();
  entry.status = status;
  if (statusMessage !== undefined) {
    entry.statusMessage = statusMessage;
  }
  await saveSyncUniverse(entries);
}

export function isSyncUniverseKvEnabled(): boolean {
  return KV_ENABLED;
}

/** @deprecated Prefer isSyncUniverseKvEnabled */
export function isKvEnabled(): boolean {
  return KV_ENABLED;
}

export async function getActiveSyncTickers(): Promise<string[]> {
  const entries = await getSyncUniverse();
  return entries.filter((e) => e.status === "active").map((e) => e.ticker);
}

/** Ops-universe actives, least-recently-synced first. */
export async function getSyncUniverseSortedByPriority(): Promise<WatchlistEntry[]> {
  const entries = await getSyncUniverse();
  const active = entries.filter((e) => e.status === "active");

  active.sort((a, b) => {
    if (!a.lastSyncedAt && !b.lastSyncedAt) return 0;
    if (!a.lastSyncedAt) return -1;
    if (!b.lastSyncedAt) return 1;
    return a.lastSyncedAt.localeCompare(b.lastSyncedAt);
  });

  return active;
}

/**
 * Daily sync queue: ops universe first (LRU), then fill remaining slots with
 * popular Neon member tickers (excludes crowd-seed users). Does not write
 * Neon names into the ops store — evidence persist still works per ticker.
 */
export async function buildDailySyncQueue(
  limit = SYNC_CONFIG.MAX_COMPANIES_PER_SYNC,
): Promise<WatchlistEntry[]> {
  const safeLimit = Math.max(1, Math.min(limit, SYNC_CONFIG.MAX_COMPANIES_PER_SYNC));
  const ops = await getSyncUniverseSortedByPriority();
  const queue: WatchlistEntry[] = [];
  const seen = new Set<string>();

  for (const entry of ops) {
    if (queue.length >= safeLimit) break;
    const ticker = entry.ticker.toUpperCase();
    if (seen.has(ticker)) continue;
    seen.add(ticker);
    queue.push(entry);
  }

  if (queue.length >= safeLimit) return queue;

  const popular = await listPopularMemberWatchlistTickers(safeLimit * 2);
  for (const row of popular) {
    if (queue.length >= safeLimit) break;
    const ticker = row.ticker.toUpperCase();
    if (seen.has(ticker)) continue;
    seen.add(ticker);
    queue.push({
      ticker,
      companyName: row.companyName || ticker,
      cik: row.cik,
      addedAt: row.addedAt,
      status: "active",
      lastSyncedAt: undefined,
    });
  }

  return queue;
}
