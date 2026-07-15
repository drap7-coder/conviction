import { fetchWithTimeout } from "@/lib/request-timeout";

export interface StockQuote {
  ticker: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string | null;
  marketState: string | null;
  source: "yahoo-chart";
}

export type StockHistoryRange = "1d" | "1w" | "1m" | "6m" | "1y";

export interface StockHistoryPoint {
  date: string;
  close: number;
}

export interface StockHistory {
  ticker: string;
  range: StockHistoryRange;
  points: StockHistoryPoint[];
  startPrice: number | null;
  endPrice: number | null;
  change: number | null;
  changePercent: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  marketCap: number | null;
  source: "yahoo-chart";
}

interface YahooChartResult {
  meta?: {
    symbol?: string;
    regularMarketPrice?: number;
    chartPreviousClose?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    marketCap?: number;
    currency?: string;
    marketState?: string;
  };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      close?: Array<number | null>;
    }>;
  };
}

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[];
  };
}

function normalizeTicker(ticker: string) {
  return ticker.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function rangeToYahooParams(range: StockHistoryRange) {
  if (range === "1d") return { range: "1d", interval: "5m", revalidate: 60 };
  if (range === "1w") return { range: "5d", interval: "30m", revalidate: 5 * 60 };
  if (range === "1m") return { range: "1mo", interval: "1d", revalidate: 30 * 60 };
  if (range === "6m") return { range: "6mo", interval: "1d", revalidate: 60 * 60 };
  return { range: "1y", interval: "1d", revalidate: 60 * 60 };
}

function buildQuote(ticker: string, result?: YahooChartResult): StockQuote {
  const price = toFiniteNumber(result?.meta?.regularMarketPrice);
  const previousClose = toFiniteNumber(result?.meta?.chartPreviousClose);
  const change = price !== null && previousClose !== null
    ? price - previousClose
    : null;

  return {
    ticker,
    price,
    change,
    changePercent: change !== null && previousClose && previousClose !== 0
      ? (change / previousClose) * 100
      : null,
    currency: result?.meta?.currency ?? null,
    marketState: result?.meta?.marketState ?? null,
    source: "yahoo-chart",
  };
}

export function buildHistory(ticker: string, range: StockHistoryRange, result?: YahooChartResult): StockHistory {
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const points: StockHistoryPoint[] = [];

  for (let index = 0; index < timestamps.length; index++) {
    const close = toFiniteNumber(closes[index]);
    const timestamp = timestamps[index];
    if (close === null || !timestamp) continue;
    points.push({
      date: new Date(timestamp * 1000).toISOString(),
      close,
    });
  }

  const startPrice = points[0]?.close ?? null;
  const endPrice = points[points.length - 1]?.close ?? toFiniteNumber(result?.meta?.regularMarketPrice);
  const change = startPrice !== null && endPrice !== null ? endPrice - startPrice : null;

  return {
    ticker,
    range,
    points,
    startPrice,
    endPrice,
    change,
    changePercent: change !== null && startPrice && startPrice !== 0
      ? (change / startPrice) * 100
      : null,
    fiftyTwoWeekHigh: toFiniteNumber(result?.meta?.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: toFiniteNumber(result?.meta?.fiftyTwoWeekLow),
    marketCap: toFiniteNumber(result?.meta?.marketCap),
    source: "yahoo-chart",
  };
}

export async function fetchStockQuotes(tickers: string[]): Promise<StockQuote[]> {
  const uniqueTickers = Array.from(new Set(tickers.map(normalizeTicker).filter(Boolean)));
  if (uniqueTickers.length === 0) return [];

  const responses = await Promise.all(
    uniqueTickers.map(async (ticker) => {
      try {
        const response = await fetchWithTimeout(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1m`,
          {
            headers: {
              "User-Agent": "Conviction/1.0",
              Accept: "application/json",
            },
            next: { revalidate: 60 },
          },
          6_000,
        );

        if (!response.ok) return buildQuote(ticker);
        const payload = (await response.json()) as YahooChartResponse;
        return buildQuote(ticker, payload.chart?.result?.[0]);
      } catch {
        return buildQuote(ticker);
      }
    }),
  );

  return responses;
}

export async function fetchStockHistory(ticker: string, range: StockHistoryRange): Promise<StockHistory> {
  const normalizedTicker = normalizeTicker(ticker);
  const params = rangeToYahooParams(range);
  if (!normalizedTicker) return buildHistory(normalizedTicker, range);

  try {
    const response = await fetchWithTimeout(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalizedTicker)}?range=${params.range}&interval=${params.interval}`,
      {
        headers: {
          "User-Agent": "Conviction/1.0",
          Accept: "application/json",
        },
        next: { revalidate: params.revalidate },
      },
      6_000,
    );

    if (!response.ok) return buildHistory(normalizedTicker, range);
    const payload = (await response.json()) as YahooChartResponse;
    return buildHistory(normalizedTicker, range, payload.chart?.result?.[0]);
  } catch {
    return buildHistory(normalizedTicker, range);
  }
}
