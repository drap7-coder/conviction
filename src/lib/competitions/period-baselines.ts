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
  /**
   * Today only: brokerage session % (quote.changePercent) when Yahoo provides it.
   * Prefer this over recomputing from spots so Campus matches ticker boards.
   */
  sessionReturnPct?: number | null;
};

function historyRangeForPerf(range: H2HPerfRange): StockHistoryRange {
  if (range === "ytd") return "ytd";
  return range;
}

/**
 * Batch period open + current prices for H2H scoring.
 * Today uses quote previousClose (session %); longer windows use Yahoo history open.
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
      out.set(ticker, baselineFromTodayQuote(quote));
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

/** Today = regular session result vs prior close (brokerage “Today %”). */
function baselineFromTodayQuote(quote: StockQuote | undefined): PeriodBaseline {
  if (!quote) {
    return { startPrice: null, startAt: null, currentPrice: null, sessionReturnPct: null };
  }
  // Prefer live last; fall back to previous close so a quiet tape still scores 0%.
  const current = quote.price ?? quote.previousClose;
  const start = quote.previousClose;
  const currentOk = current !== null && Number.isFinite(current) && current > 0;
  let sessionReturnPct: number | null =
    typeof quote.changePercent === "number" && Number.isFinite(quote.changePercent)
      ? Math.round(quote.changePercent * 100) / 100
      : null;
  if (
    sessionReturnPct === null &&
    start !== null &&
    Number.isFinite(start) &&
    start > 0 &&
    currentOk
  ) {
    sessionReturnPct = Math.round(((current! - start) / start) * 10000) / 100;
  }
  return {
    startPrice: start,
    startAt: null,
    currentPrice: currentOk ? current : null,
    sessionReturnPct,
  };
}
