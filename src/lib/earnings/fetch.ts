/**
 * Earnings evidence: Financial Modeling Prep primary, Nasdaq fallback.
 *
 * Set FMP_API_KEY for the primary path. Without a key, Nasdaq-only is used.
 * Ticker variants (BRK-B / BRK.B) are tried so provider symbol formats differ.
 */

import { clampScore } from "@/lib/conviction/scoring";
import type {
  EarningsEvidence,
  EarningsForecast,
  EarningsQuarter,
} from "@/lib/earnings/types";
import { fetchWithTimeout } from "@/lib/request-timeout";

const HEADERS = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (compatible; Conviction/1.0)",
};

const REVALIDATE = { next: { revalidate: 21_600 } } as const;

type SurpriseResponse = {
  data?: { earningsSurpriseTable?: { rows?: Array<Record<string, unknown>> } };
  status?: { rCode?: number };
};
type ForecastResponse = {
  data?: { quarterlyForecast?: { rows?: Array<Record<string, unknown>> } };
  status?: { rCode?: number };
};

type FmpEarningsRow = {
  date?: string;
  symbol?: string;
  epsActual?: number | null;
  epsEstimated?: number | null;
  eps?: number | null;
  revenueActual?: number | null;
  revenueEstimated?: number | null;
};

type FmpEstimateRow = {
  symbol?: string;
  date?: string;
  epsAvg?: number | null;
  epsHigh?: number | null;
  epsLow?: number | null;
  numberAnalystEstimatedEps?: number | null;
};

type FmpGradeRow = {
  symbol?: string;
  date?: string;
  action?: string;
  previousGrade?: string;
  newGrade?: string;
};

function number(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function finiteOrNull(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Providers disagree on class-share punctuation (BRK-B vs BRK.B). */
export function earningsTickerVariants(ticker: string): string[] {
  const upper = ticker.trim().toUpperCase();
  const variants = new Set<string>([upper]);
  if (upper.includes("-")) variants.add(upper.replace(/-/g, "."));
  if (upper.includes(".")) variants.add(upper.replace(/\./g, "-"));
  return Array.from(variants);
}

async function getJson<T>(url: string, timeoutMs = 10_000): Promise<T | null> {
  try {
    const response = await fetchWithTimeout(url, { headers: HEADERS, ...REVALIDATE }, timeoutMs);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function momentumLabel(
  revisionScore: number | null,
): EarningsEvidence["momentum"] {
  if (revisionScore === null) return "Unavailable";
  if (revisionScore >= 15) return "Estimates rising";
  if (revisionScore <= -15) return "Estimates falling";
  return "Stable";
}

export function scoreEarningsParts(
  history: EarningsQuarter[],
  forecasts: EarningsForecast[],
): Pick<
  EarningsEvidence,
  "historyScore" | "revisionScore" | "score" | "momentum" | "asOf" | "status"
> {
  const historyScore = history.length
    ? clampScore(
        history.reduce(
          (sum, quarter) => sum + (quarter.actualEps >= quarter.estimatedEps ? 25 : -25),
          0,
        ),
      )
    : null;

  const ups = forecasts.reduce((sum, item) => sum + item.revisionsUp, 0);
  const downs = forecasts.reduce((sum, item) => sum + item.revisionsDown, 0);
  const revisionScore =
    ups + downs > 0
      ? clampScore(((ups - downs) / (ups + downs)) * 100)
      : forecasts.length
        ? 0
        : null;

  const score =
    historyScore !== null && revisionScore !== null
      ? clampScore(historyScore * 0.6 + revisionScore * 0.4)
      : historyScore ?? revisionScore;

  const datedHistory = history
    .map((row) => new Date(row.reportedDate))
    .filter((date) => Number.isFinite(date.getTime()));
  const asOfDate = datedHistory.sort((a, b) => b.getTime() - a.getTime())[0];

  return {
    historyScore,
    revisionScore,
    score,
    momentum: momentumLabel(revisionScore),
    asOf: asOfDate?.toISOString() ?? null,
    status: history.length && forecasts.length ? "success" : history.length || forecasts.length ? "partial" : "unavailable",
  };
}

function mapNasdaqHistory(rows: Array<Record<string, unknown>> | undefined): EarningsQuarter[] {
  return (rows ?? []).slice(0, 4).map((row) => ({
    fiscalQuarter: String(row.fiscalQtrEnd ?? ""),
    reportedDate: String(row.dateReported ?? ""),
    actualEps: number(row.eps),
    estimatedEps: number(row.consensusForecast),
    surprisePercent: number(row.percentageSurprise),
  }));
}

function mapNasdaqForecasts(rows: Array<Record<string, unknown>> | undefined): EarningsForecast[] {
  return (rows ?? []).slice(0, 4).map((row) => ({
    fiscalQuarter: String(row.fiscalEnd ?? ""),
    consensusEps: number(row.consensusEPSForecast),
    revisionsUp: number(row.up),
    revisionsDown: number(row.down),
  }));
}

function mapFmpHistory(rows: FmpEarningsRow[]): EarningsQuarter[] {
  return rows
    .filter((row) => finiteOrNull(row.epsActual ?? row.eps) !== null)
    .slice(0, 4)
    .map((row) => {
      const actual = finiteOrNull(row.epsActual ?? row.eps) ?? 0;
      const estimated = finiteOrNull(row.epsEstimated) ?? actual;
      const surprisePercent =
        estimated !== 0 ? ((actual - estimated) / Math.abs(estimated)) * 100 : 0;
      return {
        fiscalQuarter: String(row.date ?? "").slice(0, 7),
        reportedDate: String(row.date ?? ""),
        actualEps: actual,
        estimatedEps: estimated,
        surprisePercent,
      };
    });
}

function mapFmpForecasts(rows: FmpEstimateRow[]): EarningsForecast[] {
  return rows
    .filter((row) => finiteOrNull(row.epsAvg) !== null)
    .slice(0, 4)
    .map((row) => ({
      fiscalQuarter: String(row.date ?? "").slice(0, 7),
      consensusEps: finiteOrNull(row.epsAvg) ?? 0,
      revisionsUp: 0,
      revisionsDown: 0,
    }));
}

/** Map recent analyst grade actions into synthetic revision up/down counts. */
function forecastsFromGrades(grades: FmpGradeRow[]): EarningsForecast[] {
  if (grades.length === 0) return [];
  let revisionsUp = 0;
  let revisionsDown = 0;
  for (const grade of grades.slice(0, 20)) {
    const action = String(grade.action ?? "").toLowerCase();
    if (action.includes("upgrade") || action === "buy" || action === "outperform") {
      revisionsUp += 1;
    } else if (
      action.includes("downgrade")
      || action === "sell"
      || action === "underperform"
    ) {
      revisionsDown += 1;
    }
  }
  if (revisionsUp + revisionsDown === 0) {
    return [
      {
        fiscalQuarter: "grades",
        consensusEps: 0,
        revisionsUp: 0,
        revisionsDown: 0,
      },
    ];
  }
  return [
    {
      fiscalQuarter: "grades",
      consensusEps: 0,
      revisionsUp,
      revisionsDown,
    },
  ];
}

async function fetchNasdaqBundle(symbol: string): Promise<{
  history: EarningsQuarter[];
  forecasts: EarningsForecast[];
} | null> {
  const [surprise, forecast] = await Promise.all([
    getJson<SurpriseResponse>(
      `https://api.nasdaq.com/api/company/${encodeURIComponent(symbol)}/earnings-surprise`,
    ),
    getJson<ForecastResponse>(
      `https://api.nasdaq.com/api/analyst/${encodeURIComponent(symbol)}/earnings-forecast`,
    ),
  ]);
  if (!surprise && !forecast) return null;
  return {
    history: mapNasdaqHistory(surprise?.data?.earningsSurpriseTable?.rows),
    forecasts: mapNasdaqForecasts(forecast?.data?.quarterlyForecast?.rows),
  };
}

async function fetchFmpBundle(
  symbol: string,
  apiKey: string,
): Promise<{
  history: EarningsQuarter[];
  forecasts: EarningsForecast[];
} | null> {
  const key = encodeURIComponent(apiKey);
  const sym = encodeURIComponent(symbol);
  const [earnings, estimates, grades] = await Promise.all([
    getJson<FmpEarningsRow[] | { Error?: string }>(
      `https://financialmodelingprep.com/stable/earnings?symbol=${sym}&apikey=${key}`,
    ),
    getJson<FmpEstimateRow[] | { Error?: string }>(
      `https://financialmodelingprep.com/stable/analyst-estimates?symbol=${sym}&period=quarter&page=0&limit=8&apikey=${key}`,
    ),
    getJson<FmpGradeRow[] | { Error?: string }>(
      `https://financialmodelingprep.com/stable/grades?symbol=${sym}&apikey=${key}`,
    ),
  ]);

  const earningsRows = Array.isArray(earnings) ? earnings : [];
  const estimateRows = Array.isArray(estimates) ? estimates : [];
  const gradeRows = Array.isArray(grades) ? grades : [];

  if (earningsRows.length === 0 && estimateRows.length === 0 && gradeRows.length === 0) {
    return null;
  }

  const history = mapFmpHistory(earningsRows);
  const estimateForecasts = mapFmpForecasts(estimateRows);
  const gradeForecasts = forecastsFromGrades(gradeRows);
  // Prefer estimate rows for consensus; use grades for revision pressure when estimates lack up/down.
  const forecasts =
    estimateForecasts.length > 0
      ? estimateForecasts.map((row, index) =>
          index === 0 && gradeForecasts[0]
            ? {
                ...row,
                revisionsUp: gradeForecasts[0].revisionsUp,
                revisionsDown: gradeForecasts[0].revisionsDown,
              }
            : row,
        )
      : gradeForecasts;

  return { history, forecasts };
}

async function firstBundle(
  variants: string[],
  fetcher: (symbol: string) => Promise<{ history: EarningsQuarter[]; forecasts: EarningsForecast[] } | null>,
): Promise<{ history: EarningsQuarter[]; forecasts: EarningsForecast[]; symbol: string } | null> {
  for (const symbol of variants) {
    const bundle = await fetcher(symbol);
    if (!bundle) continue;
    if (bundle.history.length > 0 || bundle.forecasts.length > 0) {
      return { ...bundle, symbol };
    }
  }
  return null;
}

function unavailable(ticker: string, message?: string): EarningsEvidence {
  return {
    ticker,
    history: [],
    forecasts: [],
    historyScore: null,
    revisionScore: null,
    score: null,
    momentum: "Unavailable",
    nextEarningsDate: null,
    asOf: null,
    source: "unavailable",
    status: "unavailable",
    message:
      message
      ?? "Earnings evidence is temporarily unavailable and is not included in the score.",
  };
}

export async function fetchEarningsEvidence(ticker: string): Promise<EarningsEvidence> {
  const normalized = ticker.trim().toUpperCase();
  const variants = earningsTickerVariants(normalized);
  const apiKey = process.env.FMP_API_KEY?.trim() || null;

  let history: EarningsQuarter[] = [];
  let forecasts: EarningsForecast[] = [];
  let usedFmp = false;
  let usedNasdaq = false;

  if (apiKey) {
    const fmp = await firstBundle(variants, (symbol) => fetchFmpBundle(symbol, apiKey));
    if (fmp) {
      history = fmp.history;
      forecasts = fmp.forecasts;
      usedFmp = true;
    }
  }

  const needsHistory = history.length === 0;
  const needsRevisionSignal =
    forecasts.length === 0
    || forecasts.every((row) => row.revisionsUp + row.revisionsDown === 0);

  if (needsHistory || needsRevisionSignal) {
    const nasdaq = await firstBundle(variants, fetchNasdaqBundle);
    if (nasdaq) {
      usedNasdaq = true;
      if (needsHistory && nasdaq.history.length > 0) {
        history = nasdaq.history;
      }
      if (needsRevisionSignal && nasdaq.forecasts.length > 0) {
        // Keep FMP consensus when present; take Nasdaq revision counts / forecasts when stronger.
        if (forecasts.length === 0) {
          forecasts = nasdaq.forecasts;
        } else {
          const nasdaqUps = nasdaq.forecasts.reduce((sum, row) => sum + row.revisionsUp, 0);
          const nasdaqDowns = nasdaq.forecasts.reduce((sum, row) => sum + row.revisionsDown, 0);
          if (nasdaqUps + nasdaqDowns > 0) {
            forecasts = forecasts.map((row, index) => ({
              ...row,
              revisionsUp: nasdaq.forecasts[index]?.revisionsUp ?? row.revisionsUp,
              revisionsDown: nasdaq.forecasts[index]?.revisionsDown ?? row.revisionsDown,
            }));
          }
        }
      }
    }
  }

  if (history.length === 0 && forecasts.length === 0) {
    return unavailable(
      normalized,
      apiKey
        ? "No earnings surprise or estimate data found for this symbol."
        : "Earnings evidence is unavailable. Set FMP_API_KEY for broader coverage, or retry later.",
    );
  }

  const scored = scoreEarningsParts(history, forecasts);
  if (scored.status === "unavailable" || scored.score === null) {
    return unavailable(normalized, "Earnings evidence could not be scored for this symbol.");
  }

  return {
    ticker: normalized,
    history,
    forecasts,
    ...scored,
    nextEarningsDate: null,
    source: usedFmp ? "fmp" : usedNasdaq ? "nasdaq" : "unavailable",
    message: usedFmp && usedNasdaq ? "Combined FMP primary with Nasdaq revision fallback." : undefined,
  };
}
