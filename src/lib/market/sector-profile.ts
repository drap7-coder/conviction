import { fetchWithTimeout } from "@/lib/request-timeout";
import {
  getSectorByTicker,
  getSectorForCompany,
  normalizeSectorName,
} from "@/lib/market/industries";

const YAHOO_BASE = "https://query1.finance.yahoo.com";

export interface SectorProfile {
  ticker: string;
  sector: string | null;
  industry: string | null;
  longName: string | null;
  marketCap: number | null;
  /** Trailing dividend yield as a percent (e.g. 1.25 for 1.25%). */
  dividendYield: number | null;
  quoteType: string | null;
}

interface YahooRawNumber {
  raw?: number;
  fmt?: string;
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
        marketCap?: YahooRawNumber;
        quoteType?: string;
      };
      summaryDetail?: {
        dividendYield?: YahooRawNumber;
        trailingAnnualDividendYield?: YahooRawNumber;
        yield?: YahooRawNumber;
      };
    }>;
  };
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Yahoo yields arrive as fractions (0.012) or occasionally already as percent. */
export function normalizeYahooYieldPercent(raw: number | null | undefined): number | null {
  const value = toFiniteNumber(raw);
  if (value === null || value < 0) return null;
  if (value > 0 && value < 1) return value * 100;
  return value;
}

function emptyProfile(ticker: string, fallbackSector: string | null): SectorProfile {
  return {
    ticker,
    sector: fallbackSector,
    industry: null,
    longName: null,
    marketCap: null,
    dividendYield: null,
    quoteType: null,
  };
}

/**
 * Fetch sector/industry/profile info for a single ticker from Yahoo Finance.
 * Uses quoteSummary — chart meta often omits marketCap; price module is reliable.
 * summaryDetail carries dividend / fund yield.
 */
export async function fetchSectorProfile(ticker: string): Promise<SectorProfile | null> {
  const upper = ticker.trim().toUpperCase();
  const fallbackSector = normalizeSectorName(
    getSectorForCompany(upper)?.name ?? getSectorByTicker(upper)?.name ?? null,
  );
  const url = `${YAHOO_BASE}/v10/finance/quoteSummary/${encodeURIComponent(upper)}?modules=assetProfile%2Cprice%2CsummaryDetail`;

  try {
    const response = await fetchWithTimeout(url, {}, 6_000);
    if (!response.ok) {
      return emptyProfile(upper, fallbackSector);
    }

    const data = (await response.json()) as YahooQuoteSummaryResult;
    const result = data.quoteSummary?.result?.[0];
    if (!result) {
      return emptyProfile(upper, fallbackSector);
    }

    const profile = result.assetProfile;
    const price = result.price;
    const summary = result.summaryDetail;
    const dividendYield = normalizeYahooYieldPercent(
      summary?.dividendYield?.raw
      ?? summary?.trailingAnnualDividendYield?.raw
      ?? summary?.yield?.raw,
    );

    return {
      ticker: upper,
      sector: normalizeSectorName(profile?.sector) ?? fallbackSector,
      industry: profile?.industry ?? null,
      longName: price?.longName ?? null,
      marketCap: toFiniteNumber(price?.marketCap?.raw),
      dividendYield,
      quoteType: price?.quoteType?.toUpperCase() ?? null,
    };
  } catch {
    return emptyProfile(upper, fallbackSector);
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
