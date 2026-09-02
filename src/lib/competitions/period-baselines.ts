import {
  fetchStockHistory,
  fetchStockQuotes,
  type StockHistoryRange,
  type StockQuote,
} from "@/lib/market/quotes";
import type { H2HPerfRange } from "@/lib/competitions/perf-range";

export type PeriodBaseline = {
  startPrice: number | null;
  startAt: string | null;
  currentPrice: number | null;
};

function historyRangeForPerf(range: H2HPerfRange): StockHistoryRange {
  if (range === "ytd") return "ytd";
  return range;
}

/**
 * Batch period open + current prices for H2H scoring.
 * Daily uses quote previousClose; longer windows use Yahoo history open.
 */
export async function fetchPeriodBaselines(
  tickers: string[],
  range: H2HPerfRange,
): Promise<Map<string, PeriodBaseline>> {
  const unique = [...new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))];
  const out = new Map<string, PeriodBaseline>();
  if (unique.length === 0) return out;

  const quotes = await fetchStockQuotes(unique);
  const byTicker = new Map(quotes.map((quote) => [quote.ticker.toUpperCase(), quote]));

  if (range === "1d") {
    for (const ticker of unique) {
      const quote = byTicker.get(ticker);
      out.set(ticker, baselineFromDailyQuote(quote));
    }
    return out;
  }

  const historyRange = historyRangeForPerf(range);
  const histories = await Promise.all(
    unique.map(async (ticker) => {
      try {
        return await fetchStockHistory(ticker, historyRange);
      } catch {
        return null;
      }
    }),
  );

  for (let index = 0; index < unique.length; index += 1) {
    const ticker = unique[index];
    const quote = byTicker.get(ticker);
    const history = histories[index];
    const current =
      quote?.price ??
      quote?.previousClose ??
      history?.endPrice ??
      null;
    out.set(ticker, {
      startPrice: history?.startPrice ?? null,
      startAt: history?.points[0]?.date ?? null,
      currentPrice: current !== null && Number.isFinite(current) && current > 0 ? current : null,
    });
  }

  return out;
}

function baselineFromDailyQuote(quote: StockQuote | undefined): PeriodBaseline {
  if (!quote) {
    return { startPrice: null, startAt: null, currentPrice: null };
  }
  const current = quote.price ?? quote.previousClose;
  return {
    startPrice: quote.previousClose,
    startAt: null,
    currentPrice: current !== null && Number.isFinite(current) && current > 0 ? current : null,
  };
}
