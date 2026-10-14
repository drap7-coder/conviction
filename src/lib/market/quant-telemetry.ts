/**
 * Honest quant telemetry from daily closes only.
 * No style-factor model, implied vol, or order-book depth — those need feeds we do not have here.
 */

export type ClosePoint = { t: number; close: number };

export type QuantTickerTelemetry = {
  ticker: string;
  held: boolean;
  /** Latest close vs trailing mean, in σ of trailing returns window. */
  zScore: number | null;
  /** OLS beta vs benchmark on overlapping daily log returns. */
  beta: number | null;
  /** Annualized realized vol from daily log returns (window). */
  realizedVol: number | null;
  /** Recent close series for sparkline (normalized 0–1). */
  spark: number[];
  /** True when |z| ≥ threshold. */
  anomaly: boolean;
  sampleSize: number;
};

const TRADING_DAYS = 252;
const DEFAULT_WINDOW = 60;
const ANOMALY_Z = 2;

export function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const a = closes[i - 1];
    const b = closes[i];
    if (!(a > 0) || !(b > 0)) continue;
    out.push(Math.log(b / a));
  }
  return out;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function sampleStdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values);
  if (m == null) return null;
  const variance =
    values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Price z-score: (last − mean) / σ over the trailing window of closes. */
export function priceZScore(closes: number[], window = DEFAULT_WINDOW): number | null {
  if (closes.length < Math.min(20, window)) return null;
  const slice = closes.slice(-window);
  const m = mean(slice);
  const sd = sampleStdev(slice);
  if (m == null || sd == null || sd === 0) return null;
  return (slice[slice.length - 1] - m) / sd;
}

/** Annualized realized volatility from daily log returns. */
export function realizedVolatility(closes: number[], window = DEFAULT_WINDOW): number | null {
  const returns = logReturns(closes.slice(-(window + 1)));
  const sd = sampleStdev(returns);
  if (sd == null) return null;
  return sd * Math.sqrt(TRADING_DAYS);
}

/** OLS beta of asset vs benchmark on aligned return pairs. */
export function olsBeta(assetReturns: number[], benchReturns: number[]): number | null {
  const n = Math.min(assetReturns.length, benchReturns.length);
  if (n < 20) return null;
  const a = assetReturns.slice(-n);
  const b = benchReturns.slice(-n);
  const meanA = mean(a);
  const meanB = mean(b);
  if (meanA == null || meanB == null) return null;
  let cov = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varB += db * db;
  }
  if (varB === 0) return null;
  return cov / varB;
}

/** Pairwise Pearson correlation on overlapping return windows. */
export function returnCorrelation(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 20) return null;
  const x = a.slice(-n);
  const y = b.slice(-n);
  const mx = mean(x);
  const my = mean(y);
  if (mx == null || my == null) return null;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const vx = x[i] - mx;
    const vy = y[i] - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

export function normalizeSpark(closes: number[], maxPoints = 28): number[] {
  if (closes.length < 2) return [];
  const slice = closes.slice(-maxPoints);
  const min = Math.min(...slice);
  const max = Math.max(...slice);
  if (min === max) return slice.map(() => 0.5);
  return slice.map((value) => (value - min) / (max - min));
}

export function buildQuantTelemetry(input: {
  ticker: string;
  held: boolean;
  closes: number[];
  benchReturns: number[];
  window?: number;
  anomalyZ?: number;
}): QuantTickerTelemetry {
  const window = input.window ?? DEFAULT_WINDOW;
  const anomalyZ = input.anomalyZ ?? ANOMALY_Z;
  const returns = logReturns(input.closes.slice(-(window + 1)));
  const zScore = priceZScore(input.closes, window);
  return {
    ticker: input.ticker,
    held: input.held,
    zScore,
    beta: olsBeta(returns, input.benchReturns),
    realizedVol: realizedVolatility(input.closes, window),
    spark: normalizeSpark(input.closes),
    anomaly: zScore != null && Math.abs(zScore) >= anomalyZ,
    sampleSize: input.closes.length,
  };
}

export function buildCorrelationMatrix(
  series: Array<{ ticker: string; returns: number[] }>,
): { tickers: string[]; values: Array<Array<number | null>> } {
  const tickers = series.map((row) => row.ticker);
  const values = tickers.map((_, i) =>
    tickers.map((__, j) => {
      if (i === j) return 1;
      return returnCorrelation(series[i].returns, series[j].returns);
    }),
  );
  return { tickers, values };
}

export function closesFromPoints(points: ClosePoint[]): number[] {
  return points
    .filter((point) => Number.isFinite(point.close) && point.close > 0)
    .map((point) => point.close);
}
