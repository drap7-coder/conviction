import { fetchWithTimeout } from "@/lib/request-timeout";
import { getSectorByTicker, getSectorForCompany } from "@/lib/market/industries";

const YAHOO_BASE = "https://query1.finance.yahoo.com";

export interface SectorProfile {
  ticker: string;
  sector: string | null;
  industry: string | null;
  longName: string | null;
  marketCap: number | null;
}

interface YahooQuoteSummaryResult {
  quoteSummary?: {
    result?: Array<{
      assetProfile?: {
        sector?: string;
        industry?: string;
        address1?: string;
        city?: string;
        state?: string;
        country?: string;
        website?: string;
        longBusinessSummary?: string;
        fullTimeEmployees?: number;
      };
      price?: {
        longName?: string;
        marketCap?: { raw: number; fmt: string };
      };
    }>;
  };
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Fetch sector/industry/profile info for a single ticker from Yahoo Finance.
 * Uses the quoteSummary endpoint which returns assetProfile data.
 */
export async function fetchSectorProfile(ticker: string): Promise<SectorProfile | null> {
  const upper = ticker.trim().toUpperCase();
  const fallbackSector = getSectorForCompany(upper)?.name ?? getSectorByTicker(upper)?.name ?? null;
  const url = `${YAHOO_BASE}/v10/finance/quoteSummary/${encodeURIComponent(upper)}?modules=assetProfile%2Cprice`;

  try {
    const response = await fetchWithTimeout(url, {}, 6_000);
    if (!response.ok) {
      return { ticker: upper, sector: fallbackSector, industry: null, longName: null, marketCap: null };
    }

    const data = (await response.json()) as YahooQuoteSummaryResult;
    const result = data.quoteSummary?.result?.[0];
    if (!result) {
      return { ticker: upper, sector: fallbackSector, industry: null, longName: null, marketCap: null };
    }

    const profile = result.assetProfile;
    const price = result.price;

    return {
      ticker: upper,
      sector: profile?.sector ?? fallbackSector,
      industry: profile?.industry ?? null,
      longName: price?.longName ?? null,
      marketCap: toFiniteNumber(price?.marketCap?.raw),
    };
  } catch {
    return { ticker: upper, sector: fallbackSector, industry: null, longName: null, marketCap: null };
  }
}

/**
 * Fetch sector profiles for multiple tickers concurrently.
 * Returns a map of ticker → SectorProfile.
 */
export async function fetchSectorProfiles(tickers: string[]): Promise<Map<string, SectorProfile>> {
  const unique = [...new Set(tickers.map((t) => t.trim().toUpperCase()))].filter(Boolean);
  const results = await Promise.allSettled(
    unique.map((ticker) => fetchSectorProfile(ticker)),
  );

  const map = new Map<string, SectorProfile>();
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      map.set(result.value.ticker, result.value);
    }
  }
  return map;
}
