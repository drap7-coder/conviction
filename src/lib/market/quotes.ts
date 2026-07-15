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

interface YahooChartResult {
  meta?: {
    symbol?: string;
    regularMarketPrice?: number;
    chartPreviousClose?: number;
    currency?: string;
    marketState?: string;
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
