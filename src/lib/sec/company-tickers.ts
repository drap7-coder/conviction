/**
 * SEC company ticker dataset (company_tickers.json).
 *
 * Canonical source for ticker → CIK resolution.
 * ~10,000 entries, ~8MB, updated daily by the SEC.
 *
 * Normalizes CIKs to zero-padded 10-digit format.
 * Indexes by ticker and normalized company name.
 * Caches in memory for 24 hours.
 *
 * Does NOT classify ETFs, foreign issuers, or securities.
 * The hardcoded CIK_MAP remains the authoritative fallback.
 */

import { CIK_MAP } from "./cik";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompanyTickerEntry {
  cik: string;      // zero-padded to 10 digits
  ticker: string;   // uppercase
  name: string;     // SEC-listed company name
}

export interface CompanyTickerDataset {
  byTicker: Map<string, CompanyTickerEntry>;
  byName: Map<string, CompanyTickerEntry[]>;
  fetchedAt: string;
  count: number;
}

// ---------------------------------------------------------------------------
// User-Agent (SEC requires an identifiable one)
// ---------------------------------------------------------------------------

const UA = `Conviction (${process.env.SEC_CONTACT_EMAIL || "conviction@example.com"})`;
const TICKER_URL = "https://www.sec.gov/files/company_tickers.json";

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

let cached: CompanyTickerDataset | null = null;
let cachedAt = 0;
const TTL = 24 * 60 * 60 * 1000;

export function clearCache(): void {
  cached = null;
  cachedAt = 0;
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function getCompanyTickerDataset(): Promise<CompanyTickerDataset> {
  const now = Date.now();
  if (cached && now - cachedAt < TTL) return cached;

  const res = await fetch(TICKER_URL, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    next: { revalidate: 86400 },
  });

  if (!res.ok) {
    if (cached) {
      console.warn(`[companyTickers] SEC ${res.status}, using stale cache`);
      return cached;
    }
    throw new Error(`SEC ticker dataset returned ${res.status}`);
  }

  const raw: Record<string, { cik_str: number; ticker: string; title: string }> = await res.json();
  const byTicker = new Map<string, CompanyTickerEntry>();
  const byName = new Map<string, CompanyTickerEntry[]>();

  for (const key of Object.keys(raw)) {
    const r = raw[key];
    const ticker = r.ticker.toUpperCase().trim();
    const name = r.title.trim();
    const cik = String(r.cik_str).padStart(10, "0");
    if (!ticker || !name) continue;

    const entry: CompanyTickerEntry = { cik, ticker, name };

    // byTicker: first occurrence wins (SEC has rare duplicates)
    if (!byTicker.has(ticker)) byTicker.set(ticker, entry);

    // byName: normalize for lookup
    const norm = normalizeCompanyName(name);
    const existing = byName.get(norm);
    if (existing) existing.push(entry);
    else byName.set(norm, [entry]);
  }

  cached = { byTicker, byName, fetchedAt: new Date().toISOString(), count: byTicker.size };
  cachedAt = Date.now();
  console.log(`[companyTickers] ${cached.count} entries loaded`);
  return cached;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a ticker: uppercase, strip dots and hyphens (BRK.B → BRKB).
 * Returns the normalized form AND the original for lookup flexibility.
 */
export function normalizeTicker(raw: string): { normalized: string; original: string } {
  const original = raw.trim().toUpperCase();
  const normalized = original.replace(/[.\-]/g, "");
  return { normalized, original };
}

/**
 * Normalize a company name for matching.
 * Uppercase, strip punctuation, collapse whitespace, strip common suffixes.
 */
export function normalizeCompanyName(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[&]/g, " AND ")
    .replace(/[.,#!$%^*;:=_~'"®©™]/g, "")
    .replace(/\s+INCORPORATED\s*$/, "")
    .replace(/\s+CORPORATION\s*$/, "")
    .replace(/\s+COMPANY\s*$/, "")
    .replace(/\s+LIMITED\s*$/, "")
    .replace(/\s+L\.?\s*P\.?\s*$/, "")
    .replace(/\s+N\.?\s*A\.?\s*$/, "")
    .replace(/\s+(INC|CORP|LTD|LLC|PLC|SA|NV|SE|LP)\s*$/, "")
    .replace(/\s+THE\s*$/, "")
    .replace(/\s+HOLDINGS\s*$/, "")
    .replace(/\s+GROUP\s*$/, "")
    .replace(/\s+TECHNOLOGIES\s*$/, "")
    .replace(/\s+PHARMACEUTICALS\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export interface TickerResolution {
  found: boolean;
  ticker?: string;
  name?: string;
  cik?: string;
  source: "dataset" | "hardcoded" | "name_match" | "not_found";
}

/**
 * Resolve a ticker string to CIK and company name.
 * Tries: SEC dataset → hardcoded map → name match.
 */
export async function resolveCompanyByTicker(raw: string): Promise<TickerResolution> {
  const { normalized, original } = normalizeTicker(raw);

  // 1. Hardcoded map (fast path, authoritative)
  if (CIK_MAP[original]) {
    return { found: true, ticker: original, name: original, cik: CIK_MAP[original], source: "hardcoded" };
  }
  if (CIK_MAP[normalized]) {
    return { found: true, ticker: normalized, name: normalized, cik: CIK_MAP[normalized], source: "hardcoded" };
  }

  // 2. SEC dataset
  try {
    const ds = await getCompanyTickerDataset();

    // Try original ticker
    let entry = ds.byTicker.get(original);
    if (!entry && normalized !== original) entry = ds.byTicker.get(normalized);
    // Try hyphen variant (BRK.B → BRK-B, as stored in SEC dataset)
    if (!entry && original.includes(".")) {
      const hyphenForm = original.replace(/\./g, "-");
      entry = ds.byTicker.get(hyphenForm);
    }

    if (entry) {
      return { found: true, ticker: entry.ticker, name: entry.name, cik: entry.cik, source: "dataset" };
    }
  } catch {
    // fall through to not_found
  }

  return { found: false, source: "not_found" };
}

/**
 * Resolve a company name to ticker, CIK, and full name.
 * Tries: hardcoded name map → SEC dataset name match.
 */
export async function resolveCompanyByName(
  raw: string,
  hardcodedNameMap: Record<string, string>,
  hardcodedNames: Record<string, string>,
): Promise<TickerResolution> {
  const upper = raw.trim().toUpperCase();

  // 1. Hardcoded name map
  const mapped = hardcodedNameMap[upper];
  if (mapped && CIK_MAP[mapped]) {
    return {
      found: true,
      ticker: mapped,
      name: hardcodedNames[mapped] || mapped,
      cik: CIK_MAP[mapped],
      source: "hardcoded",
    };
  }

  // 2. SEC dataset name match
  try {
    const ds = await getCompanyTickerDataset();
    const norm = normalizeCompanyName(raw);

    // Exact match
    const exact = ds.byName.get(norm);
    if (exact && exact.length > 0) {
      const e = exact[0];
      return { found: true, ticker: e.ticker, name: e.name, cik: e.cik, source: "name_match" };
    }

    // Prefix match
    for (const [n, entries] of ds.byName) {
      if (n.startsWith(norm) || norm.startsWith(n)) {
        const e = entries[0];
        return { found: true, ticker: e.ticker, name: e.name, cik: e.cik, source: "name_match" };
      }
    }

    // Word-overlap match (for multi-word inputs)
    const words = norm.split(/\s+/);
    if (words.length >= 2) {
      for (const [n, entries] of ds.byName) {
        const nWords = n.split(/\s+/);
        const overlap = words.filter((w) => nWords.includes(w)).length;
        if (overlap >= words.length * 0.7) {
          const e = entries[0];
          return { found: true, ticker: e.ticker, name: e.name, cik: e.cik, source: "name_match" };
        }
      }
    }
  } catch {
    // fall through
  }

  return { found: false, source: "not_found" };
}