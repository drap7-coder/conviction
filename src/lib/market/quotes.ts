import { fetchWithTimeout } from "@/lib/request-timeout";

export interface StockQuote {
  ticker: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  dollarVolume: number | null;
  currency: string | null;
  marketState: string | null;
  marketCap: number | null;
  /** Pre-market price (populated ~4:00–9:30am ET) */
  preMarketPrice: number | null;
  preMarketChange: number | null;
  preMarketChangePercent: number | null;
  /** After-hours price (populated ~4:00–8:00pm ET) */
  postMarketPrice: number | null;
  postMarketChange: number | null;
  postMarketChangePercent: number | null;
  source: "yahoo-chart";
  /** Intraday sparkline points (up to ~42) extracted from the same chart response */
  sparkline: StockHistoryPoint[];
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
    regularMarketVolume?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    marketCap?: number;
    currency?: string;
    marketState?: string;
    preMarketPrice?: number;
    preMarketChange?: number;
    preMarketChangePercent?: number;
    postMarketPrice?: number;
    postMarketChange?: number;
    postMarketChangePercent?: number;
    currentTradingPeriod?: {
      pre?: { start?: number; end?: number };
      regular?: { start?: number; end?: number };
      post?: { start?: number; end?: number };
    };
  };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      close?: Array<number | null>;
    }>;
  };
}

type TradingPeriod = { start?: number; end?: number } | undefined;
type TradingPeriods = {
  pre?: { start?: number; end?: number };
  regular?: { start?: number; end?: number };
  post?: { start?: number; end?: number };
} | undefined;

function isWithinPeriod(epochSeconds: number, period: TradingPeriod) {
  return Boolean(
    period?.start &&
      period?.end &&
      epochSeconds >= period.start &&
      epochSeconds < period.end,
  );
}

export function inferMarketState(
  periods: TradingPeriods,
  epochSeconds = Math.floor(Date.now() / 1000),
) {
  if (isWithinPeriod(epochSeconds, periods?.pre)) return "PRE";
  if (isWithinPeriod(epochSeconds, periods?.regular)) return "REGULAR";
  if (isWithinPeriod(epochSeconds, periods?.post)) return "POST";
  return "CLOSED";
}

function lastPriceWithinPeriod(result: YahooChartResult | undefined, period: TradingPeriod) {
  if (!period?.start || !period?.end) return null;
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];

  for (let index = timestamps.length - 1; index >= 0; index -= 1) {
    const timestamp = timestamps[index];
    if (timestamp < period.start || timestamp >= period.end) continue;
    const close = toFiniteNumber(closes[index]);
    if (close !== null) return close;
  }
  return null;
}

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[];
  };
}

function normalizeTicker(ticker: string) {
  return ticker.trim().toUpperCase().replace(/[^A-Z0-9.^-]/g, "");
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function calculateExtendedHoursMove(
  extendedPrice: number | null,
  regularClose: number | null,
) {
  const change = extendedPrice !== null && regularClose !== null
    ? extendedPrice - regularClose
    : null;
  return {
    change,
    changePercent: change !== null && regularClose
      ? (change / regularClose) * 100
      : null,
  };
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
  const volume = toFiniteNumber(result?.meta?.regularMarketVolume);
  const change = price !== null && previousClose !== null
    ? price - previousClose
    : null;

  // Pre-market
  const periods = result?.meta?.currentTradingPeriod;
  const marketState = result?.meta?.marketState ?? inferMarketState(periods);
  const derivedPreMarketPrice = lastPriceWithinPeriod(result, periods?.pre);
  const preMarketPrice = toFiniteNumber(result?.meta?.preMarketPrice) ?? derivedPreMarketPrice;
  const derivedPreMarketMove = calculateExtendedHoursMove(preMarketPrice, price);
  const preMarketChange = toFiniteNumber(result?.meta?.preMarketChange) ??
    derivedPreMarketMove.change;
  const preMarketChangePercent = toFiniteNumber(result?.meta?.preMarketChangePercent) ??
    derivedPreMarketMove.changePercent;

  // After-hours
  const derivedPostMarketPrice = lastPriceWithinPeriod(result, periods?.post);
  const postMarketPrice = toFiniteNumber(result?.meta?.postMarketPrice) ?? derivedPostMarketPrice;
  const derivedPostMarketMove = calculateExtendedHoursMove(postMarketPrice, price);
  const postMarketChange = toFiniteNumber(result?.meta?.postMarketChange) ??
    derivedPostMarketMove.change;
  const postMarketChangePercent = toFiniteNumber(result?.meta?.postMarketChangePercent) ??
    derivedPostMarketMove.changePercent;

  // Extract intraday sparkline from the same chart response
  const sparkline: StockHistoryPoint[] = [];
  if (result) {
    const timestamps = result.timestamp ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = toFiniteNumber(closes[i]);
      const timestamp = timestamps[i];
      if (close !== null && timestamp) {
        sparkline.push({
          date: new Date(timestamp * 1000).toISOString(),
          close,
        });
      }
    }
  }

  return {
    ticker,
    price,
    previousClose,
    change,
    changePercent: change !== null && previousClose && previousClose !== 0
      ? (change / previousClose) * 100
      : null,
    volume,
    dollarVolume: price !== null && volume !== null ? price * volume : null,
    currency: result?.meta?.currency ?? null,
    marketState,
    marketCap: toFiniteNumber(result?.meta?.marketCap),
    preMarketPrice,
    preMarketChange,
    preMarketChangePercent,
    postMarketPrice,
    postMarketChange,
    postMarketChangePercent,
    source: "yahoo-chart",
    sparkline: sparkline.slice(-42),
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
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1m&includePrePost=true`,
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
