/**
 * Watchlist types for CONVICTION.
 * Stored separately from transaction records in KV/local JSON.
 */

export interface WatchlistEntry {
  ticker: string;
  companyName: string;
  cik?: string;
  addedAt: string;
  lastSyncedAt?: string;
  status: "active" | "unsupported" | "error";
  statusMessage?: string;
}

export interface WatchlistStore {
  entries: WatchlistEntry[];
  /** KV_ENABLED: true when KV is configured, false when using local JSON fallback */
  kvEnabled: boolean;
}

export const SEED_WATCHLIST: WatchlistEntry[] = [
  { ticker: "OXY", companyName: "Occidental Petroleum", cik: "0000797468", addedAt: new Date("2026-07-01").toISOString(), status: "active" },
  { ticker: "INTC", companyName: "Intel Corporation", cik: "0000050863", addedAt: new Date("2026-07-01").toISOString(), status: "active" },
  { ticker: "GOOG", companyName: "Alphabet Inc.", cik: "0001652044", addedAt: new Date("2026-07-01").toISOString(), status: "active" },
  { ticker: "NVO", companyName: "Novo Nordisk", cik: "0000353278", addedAt: new Date("2026-07-01").toISOString(), status: "unsupported", statusMessage: "Foreign issuer — does not file SEC Form 4" },
  { ticker: "PFE", companyName: "Pfizer Inc.", cik: "0000078003", addedAt: new Date("2026-07-01").toISOString(), status: "active" },
  { ticker: "NBIS", companyName: "Nebius Group", cik: "0001712184", addedAt: new Date("2026-07-01").toISOString(), status: "active" },
];