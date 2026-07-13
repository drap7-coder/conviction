/**
 * Lightweight persistence layer for CONVICTION.
 * Uses Vercel KV when available, falls back to in-memory + JSON.
 *
 * Retention:
 * - Transaction records: max 100 per ticker (newest)
 * - Dedup keys: max 5,000 (oldest pruned)
 * - Last fetch timestamps: one per ticker (never grows unboundedly)
 */

import { kv } from "@vercel/kv";
import fs from "fs";
import path from "path";
import type { InsiderTransaction, TransactionCode, InsiderTransactionType } from "./types";
import { isDirectionalType } from "./types";
import { SYNC_CONFIG } from "../sync/sync-config";

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
  transactionType: string;
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

export async function getLastFetchTime(ticker: string): Promise<string | null> {
  if (KV_ENABLED) {
    const val = await kvGet<string>(`conviction:fetch:${ticker}`);
    if (val) return val;
  }
  const store = readLocalStore();
  return store.lastFetchByTicker[ticker] || null;
}

export async function setLastFetchTime(ticker: string, timestamp: string): Promise<void> {
  if (KV_ENABLED) {
    await kvSet(`conviction:fetch:${ticker}`, timestamp);
  }
  const store = readLocalStore();
  store.lastFetchByTicker[ticker] = timestamp;
  writeLocalStore(store);
}

export async function isKnownTransaction(id: string): Promise<boolean> {
  if (KV_ENABLED) {
    const exists = await kvGet<boolean>(`conviction:dedup:${id}`);
    if (exists) return true;
  }
  const store = readLocalStore();
  return store.dedupKeys.includes(id);
}

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
  let dedupKeys = Array.from(existing);

  // Prune oldest keys when over max limit
  if (dedupKeys.length > SYNC_CONFIG.MAX_DEDUP_KEYS) {
    dedupKeys.sort(); // chronological based on format: TICKER::ACCESSION::INDEX::CODE
    dedupKeys = dedupKeys.slice(dedupKeys.length - SYNC_CONFIG.MAX_DEDUP_KEYS);
  }

  store.dedupKeys = dedupKeys;
  writeLocalStore(store);
}

export async function getStoredTransactions(ticker: string): Promise<TransactionRecord[]> {
  if (KV_ENABLED) {
    const val = await kvGet<TransactionRecord[]>(`conviction:tx:${ticker}`);
    if (val) return val;
  }
  const store = readLocalStore();
  return store.transactionsByTicker[ticker] || [];
}

export async function storeTransactions(
  ticker: string,
  records: TransactionRecord[],
  dedupKeys: string[],
): Promise<void> {
  const existing = await getStoredTransactions(ticker);
  const existingIds = new Set(existing.map((t) => t.id));
  const merged = [...existing];

  for (const record of records) {
    if (!existingIds.has(record.id)) {
      merged.push(record);
    }
  }

  merged.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  const trimmed = merged.slice(0, SYNC_CONFIG.MAX_TRANSACTIONS_PER_TICKER);

  if (KV_ENABLED) {
    await kvSet(`conviction:tx:${ticker}`, trimmed);
  }
  const store = readLocalStore();
  store.transactionsByTicker[ticker] = trimmed;
  writeLocalStore(store);

  await markKnownTransactions(dedupKeys);
}

export async function getAllDedupKeys(): Promise<Set<string>> {
  const store = readLocalStore();
  return new Set(store.dedupKeys);
}

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
    transactionType: tx.transactionType,
    transactionCode: tx.transactionCode,
    transactionDate: tx.transactionDate,
    filingDate: tx.filingDate,
    shares: tx.shares,
    pricePerShare: tx.pricePerShare,
    totalValue: tx.totalValue,
    sharesOwnedAfter: tx.sharesOwnedAfter,
    filingUrl: tx.filingUrl,
    isDirectional: isDirectionalType(tx.transactionType),
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
    transactionType: record.transactionType as InsiderTransactionType,
    shares: record.shares,
    pricePerShare: record.pricePerShare,
    totalValue: record.totalValue,
    sharesOwnedAfter: record.sharesOwnedAfter,
    isDirectOwnership: record.isDirectOwnership,
    ownershipChange: record.ownershipChange,
  };
}