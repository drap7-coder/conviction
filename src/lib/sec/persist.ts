/**
 * Lightweight persistence layer for CONVICTION.
 * Uses Vercel KV when available, falls back to in-memory + JSON.
 *
 * Stores:
 * - Last fetch timestamp per ticker
 * - Deduplication keys (known transaction IDs)
 * - Normalized insider transactions
 * - Emerging evidence candidates
 */

import { kv } from "@vercel/kv";
import fs from "fs";
import path from "path";
import type { InsiderTransaction, TransactionCode } from "./types";

const KV_ENABLED = !!process.env.KV_URL && !!process.env.KV_REST_API_URL;

// Local fallback file path
const LOCAL_STORE_DIR = path.join(process.cwd(), ".conviction");
const LOCAL_STORE_FILE = path.join(LOCAL_STORE_DIR, "store.json");

interface LocalStore {
  lastFetchByTicker: Record<string, string>;
  dedupKeys: string[];
  transactionsByTicker: Record<string, TransactionRecord[]>;
}

export interface TransactionRecord {
  id: string;
  ticker: string;
  insiderName: string;
  insiderRole: string | null;
  transactionClass: string;
  transactionCode: string;
  transactionDate: string;
  filingDate: string;
  shares: number;
  pricePerShare: number | null;
  totalValue: number | null;
  sharesOwnedAfter: number | null;
  filingUrl: string;
  isDirectional: boolean;
  cik: string;
  accessionNumber: string;
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;
  isDirectOwnership: boolean;
  ownershipChange: number | null;
}

function getDefaultStore(): LocalStore {
  return {
    lastFetchByTicker: {},
    dedupKeys: [],
    transactionsByTicker: {},
  };
}

function readLocalStore(): LocalStore {
  try {
    if (fs.existsSync(LOCAL_STORE_FILE)) {
      const raw = fs.readFileSync(LOCAL_STORE_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch {
    // Ignore read errors
  }
  return getDefaultStore();
}

function writeLocalStore(store: LocalStore): void {
  try {
    if (!fs.existsSync(LOCAL_STORE_DIR)) {
      fs.mkdirSync(LOCAL_STORE_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.warn("[persist] Failed to write local store:", err);
  }
}

async function kvGet<T>(key: string): Promise<T | null> {
  if (KV_ENABLED) {
    try {
      return await kv.get<T>(key);
    } catch {
      return null;
    }
  }
  return null;
}

async function kvSet(key: string, value: unknown): Promise<void> {
  if (KV_ENABLED) {
    try {
      await kv.set(key, value);
    } catch {
      // fall through to local
    }
  }
}

/**
 * Get the last fetch timestamp for a ticker.
 */
export async function getLastFetchTime(ticker: string): Promise<string | null> {
  if (KV_ENABLED) {
    const val = await kvGet<string>(`conviction:fetch:${ticker}`);
    if (val) return val;
  }
  const store = readLocalStore();
  return store.lastFetchByTicker[ticker] || null;
}

/**
 * Set the last fetch timestamp for a ticker.
 */
export async function setLastFetchTime(ticker: string, timestamp: string): Promise<void> {
  if (KV_ENABLED) {
    await kvSet(`conviction:fetch:${ticker}`, timestamp);
  }
  const store = readLocalStore();
  store.lastFetchByTicker[ticker] = timestamp;
  writeLocalStore(store);
}

/**
 * Check if a transaction ID is already known (deduplication).
 */
export async function isKnownTransaction(id: string): Promise<boolean> {
  if (KV_ENABLED) {
    const exists = await kvGet<boolean>(`conviction:dedup:${id}`);
    if (exists) return true;
  }
  const store = readLocalStore();
  return store.dedupKeys.includes(id);
}

/**
 * Mark transaction IDs as known.
 */
export async function markKnownTransactions(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  if (KV_ENABLED) {
    const pipeline = kv.pipeline();
    for (const id of ids) {
      pipeline.set(`conviction:dedup:${id}`, true);
    }
    await pipeline.exec();
  }

  const store = readLocalStore();
  const existing = new Set(store.dedupKeys);
  for (const id of ids) {
    existing.add(id);
  }
  store.dedupKeys = Array.from(existing);
  writeLocalStore(store);
}

/**
 * Get stored transactions for a ticker.
 */
export async function getStoredTransactions(ticker: string): Promise<TransactionRecord[]> {
  if (KV_ENABLED) {
    const val = await kvGet<TransactionRecord[]>(`conviction:tx:${ticker}`);
    if (val) return val;
  }
  const store = readLocalStore();
  return store.transactionsByTicker[ticker] || [];
}

/**
 * Store transactions for a ticker, merging with existing data.
 */
export async function storeTransactions(
  ticker: string,
  records: TransactionRecord[],
  dedupKeys: string[],
): Promise<void> {
  // Merge with existing
  const existing = await getStoredTransactions(ticker);
  const existingIds = new Set(existing.map((t) => t.id));
  const merged = [...existing];

  for (const record of records) {
    if (!existingIds.has(record.id)) {
      merged.push(record);
    }
  }

  // Sort by transaction date descending, keep last 100
  merged.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  const trimmed = merged.slice(0, 100);

  if (KV_ENABLED) {
    await kvSet(`conviction:tx:${ticker}`, trimmed);
  }
  const store = readLocalStore();
  store.transactionsByTicker[ticker] = trimmed;
  writeLocalStore(store);

  // Mark dedup keys
  await markKnownTransactions(dedupKeys);
}

/**
 * Get all known dedup keys.
 */
export async function getAllDedupKeys(): Promise<Set<string>> {
  if (KV_ENABLED) {
    // For KV we need a different approach — scan
    // Fall back to local for this
  }
  const store = readLocalStore();
  return new Set(store.dedupKeys);
}

/**
 * Get all tickers with stored transactions.
 */
export async function getAllTrackedTickers(): Promise<string[]> {
  const store = readLocalStore();
  return Object.keys(store.transactionsByTicker);
}

/**
 * Convert InsiderTransaction to TransactionRecord for persistence.
 */
export function txToRecord(tx: InsiderTransaction): TransactionRecord {
  return {
    id: tx.id,
    ticker: tx.ticker,
    insiderName: tx.insiderName,
    insiderRole: tx.insiderRole,
    transactionClass: tx.transactionClass,
    transactionCode: tx.transactionCode,
    transactionDate: tx.transactionDate,
    filingDate: tx.filingDate,
    shares: tx.shares,
    pricePerShare: tx.pricePerShare,
    totalValue: tx.totalValue,
    sharesOwnedAfter: tx.sharesOwnedAfter,
    filingUrl: tx.filingUrl,
    isDirectional: tx.transactionClass === "open-market-purchase" || tx.transactionClass === "open-market-sale",
    cik: tx.cik,
    accessionNumber: tx.accessionNumber,
    isDirector: tx.isDirector,
    isOfficer: tx.isOfficer,
    isTenPercentOwner: tx.isTenPercentOwner,
    isDirectOwnership: tx.isDirectOwnership,
    ownershipChange: tx.ownershipChange,
  };
}

/**
 * Inflate a TransactionRecord back to an InsiderTransaction.
 */
export function recordToTx(record: TransactionRecord): InsiderTransaction {
  return {
    id: record.id,
    ticker: record.ticker,
    cik: record.cik,
    accessionNumber: record.accessionNumber,
    filingUrl: record.filingUrl,
    insiderName: record.insiderName,
    insiderRole: record.insiderRole,
    isDirector: record.isDirector,
    isOfficer: record.isOfficer,
    isTenPercentOwner: record.isTenPercentOwner,
    transactionDate: record.transactionDate,
    filingDate: record.filingDate,
    transactionCode: record.transactionCode as TransactionCode,
    transactionClass: record.transactionClass as any,
    shares: record.shares,
    pricePerShare: record.pricePerShare,
    totalValue: record.totalValue,
    sharesOwnedAfter: record.sharesOwnedAfter,
    isDirectOwnership: record.isDirectOwnership,
    ownershipChange: record.ownershipChange,
  };
}