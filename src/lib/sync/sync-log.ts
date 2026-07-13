/**
 * Lightweight sync log for tracking ingestion operations.
 * Used by the admin resource dashboard to report on resource usage.
 *
 * Retention: logs are capped at MAX_SYNC_LOG_ENTRIES, oldest evicted.
 * This is a pure in-memory + JSON store (no Neon, no KV).
 */

import fs from "fs";
import path from "path";
import { SYNC_CONFIG } from "./sync-config";

const LOG_DIR = path.join(process.cwd(), ".conviction");
const LOG_FILE = path.join(LOG_DIR, "sync-log.json");

export interface SyncLogEntry {
  timestamp: string;
  source: string;
  ticker: string;
  durationMs: number;
  newRecords: number;
  totalRecords: number;
  errors: number;
  errorMessages: string[];
}

export interface SyncLogStore {
  entries: SyncLogEntry[];
  lastRun: string | null;
  totalNewRecords: number;
  totalErrors: number;
  totalRuns: number;
  averageDurationMs: number;
}

function getDefaultLogStore(): SyncLogStore {
  return {
    entries: [],
    lastRun: null,
    totalNewRecords: 0,
    totalErrors: 0,
    totalRuns: 0,
    averageDurationMs: 0,
  };
}

function readLogStore(): SyncLogStore {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const raw = fs.readFileSync(LOG_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch {
    // Ignore read errors
  }
  return getDefaultLogStore();
}

function writeLogStore(store: SyncLogStore): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    fs.writeFileSync(LOG_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.warn("[sync-log] Failed to write:", err);
  }
}

/**
 * Record a sync operation in the log.
 * Automatically applies retention: evicts oldest entries when over limit.
 */
export function recordSync(entry: SyncLogEntry): void {
  const store = readLogStore();

  store.entries.push(entry);
  store.lastRun = entry.timestamp;
  store.totalRuns++;
  store.totalNewRecords += entry.newRecords;
  store.totalErrors += entry.errors;
  store.averageDurationMs = Math.round(store.totalNewRecords > 0
    ? store.entries.reduce((s, e) => s + e.durationMs, 0) / store.entries.length
    : 0);

  // Evict oldest entries when over limit
  if (store.entries.length > SYNC_CONFIG.MAX_SYNC_LOG_ENTRIES) {
    store.entries = store.entries.slice(
      store.entries.length - SYNC_CONFIG.MAX_SYNC_LOG_ENTRIES,
    );
  }

  writeLogStore(store);
}

/**
 * Read the sync log store.
 */
export function getSyncLog(): SyncLogStore {
  return readLogStore();
}

/**
 * Clear the sync log (for testing or manual reset).
 */
export function clearSyncLog(): void {
  writeLogStore(getDefaultLogStore());
}