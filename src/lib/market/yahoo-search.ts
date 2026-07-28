/**
 * Yahoo Finance symbol search — used to supplement SEC company_tickers
 * typeahead so ETFs, funds, and other listed symbols resolve.
 */

import { fetchWithTimeout } from "@/lib/request-timeout";
import type { CompanySuggestion } from "@/lib/sec/company-tickers";

interface YahooSearchQuote {
  symbol?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchDisp?: string;
  exchange?: string;
}

interface YahooSearchResponse {
  quotes?: YahooSearchQuote[];
}

const ALLOWED_TYPES = new Set(["EQUITY", "ETF", "MUTUALFUND", "INDEX"]);

function isUsListed(quote: YahooSearchQuote): boolean {
  const exchange = (quote.exchDisp ?? quote.exchange ?? "").toUpperCase();
  if (!exchange) return true;
  return (
    exchange.includes("NASDAQ") ||
    exchange.includes("NYSE") ||
    exchange.includes("AMEX") ||
    exchange.includes("ARCA") ||
    exchange.includes("BATS") ||
    exchange.includes("OTC") ||
    exchange === "NMS" ||
    exchange === "NYQ" ||
    exchange === "PCX" ||
    exchange === "ASE"
  );
}

/**
 * Search Yahoo Finance for symbols matching a query.
 * Returns CompanySuggestion-shaped results (cik empty for non-SEC symbols).
 */
export async function searchYahooSymbols(
  query: string,
  limit = 8,
): Promise<CompanySuggestion[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  try {
    const response = await fetchWithTimeout(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=${Math.min(limit + 4, 12)}&newsCount=0`,
      {
        headers: {
          "User-Agent": "Conviction/1.0",
          Accept: "application/json",
        },
        next: { revalidate: 300 },
      },
      4_000,
    );

    if (!response.ok) return [];
    const payload = (await response.json()) as YahooSearchResponse;
    const suggestions: CompanySuggestion[] = [];
    const seen = new Set<string>();

    for (const quote of payload.quotes ?? []) {
      const ticker = quote.symbol?.trim().toUpperCase();
      if (!ticker || seen.has(ticker)) continue;
      if (ticker.includes("=") || ticker.includes("^")) continue; // skip FX / futures
      if (quote.quoteType && !ALLOWED_TYPES.has(quote.quoteType)) continue;
      if (!isUsListed(quote)) continue;

      seen.add(ticker);
      const name =
        quote.longname?.trim() ||
        quote.shortname?.trim() ||
        ticker;
      suggestions.push({
        ticker,
        name,
        cik: "",
      });
      if (suggestions.length >= limit) break;
    }

    return suggestions;
  } catch {
    return [];
  }
}
