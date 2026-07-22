import { NextRequest, NextResponse } from "next/server";
import { clampScore } from "@/lib/conviction/scoring";
import type { EarningsEvidence, EarningsForecast, EarningsQuarter } from "@/lib/earnings/types";
import { fetchWithTimeout } from "@/lib/request-timeout";

export const dynamic = "force-dynamic";

const HEADERS = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (compatible; Conviction/1.0)",
};

type SurpriseResponse = { data?: { earningsSurpriseTable?: { rows?: Array<Record<string, unknown>> } } };
type ForecastResponse = { data?: { quarterlyForecast?: { rows?: Array<Record<string, unknown>> } } };

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetchWithTimeout(url, { headers: HEADERS, next: { revalidate: 21_600 } }, 10_000);
  if (!response.ok) throw new Error(`Earnings source returned ${response.status}`);
  return response.json() as Promise<T>;
}

export async function GET(request: NextRequest) {
  const ticker = new URL(request.url).searchParams.get("ticker")?.toUpperCase();
  if (!ticker || !/^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker)) {
    return NextResponse.json({ error: "A valid ticker is required" }, { status: 400 });
  }

  try {
    const [surprise, forecast] = await Promise.all([
      getJson<SurpriseResponse>(`https://api.nasdaq.com/api/company/${ticker}/earnings-surprise`),
      getJson<ForecastResponse>(`https://api.nasdaq.com/api/analyst/${ticker}/earnings-forecast`),
    ]);
    const history: EarningsQuarter[] = (surprise.data?.earningsSurpriseTable?.rows ?? []).slice(0, 4).map((row) => ({
      fiscalQuarter: String(row.fiscalQtrEnd ?? ""),
      reportedDate: String(row.dateReported ?? ""),
      actualEps: number(row.eps),
      estimatedEps: number(row.consensusForecast),
      surprisePercent: number(row.percentageSurprise),
    }));
    const forecasts: EarningsForecast[] = (forecast.data?.quarterlyForecast?.rows ?? []).slice(0, 4).map((row) => ({
      fiscalQuarter: String(row.fiscalEnd ?? ""),
      consensusEps: number(row.consensusEPSForecast),
      revisionsUp: number(row.up),
      revisionsDown: number(row.down),
    }));
    const historyScore = history.length ? clampScore(history.reduce((sum, quarter) => sum + (quarter.actualEps >= quarter.estimatedEps ? 25 : -25), 0)) : null;
    const ups = forecasts.reduce((sum, item) => sum + item.revisionsUp, 0);
    const downs = forecasts.reduce((sum, item) => sum + item.revisionsDown, 0);
    const revisionScore = ups + downs > 0 ? clampScore(((ups - downs) / (ups + downs)) * 100) : forecasts.length ? 0 : null;
    const score = historyScore !== null && revisionScore !== null
      ? clampScore(historyScore * 0.6 + revisionScore * 0.4)
      : historyScore ?? revisionScore;
    const datedHistory = history.map((row) => new Date(row.reportedDate)).filter((date) => Number.isFinite(date.getTime()));
    const asOfDate = datedHistory.sort((a, b) => b.getTime() - a.getTime())[0];
    const payload: EarningsEvidence = {
      ticker,
      history,
      forecasts,
      historyScore,
      revisionScore,
      score,
      momentum: revisionScore === null ? "Unavailable" : revisionScore >= 15 ? "Estimates rising" : revisionScore <= -15 ? "Estimates falling" : "Stable",
      nextEarningsDate: null,
      asOf: asOfDate?.toISOString() ?? null,
      source: "nasdaq",
      status: history.length && forecasts.length ? "success" : "partial",
    };
    return NextResponse.json(payload);
  } catch (error) {
    console.error(`[api/evidence/earnings] ${ticker}:`, error);
    const payload: EarningsEvidence = {
      ticker, history: [], forecasts: [], historyScore: null, revisionScore: null, score: null,
      momentum: "Unavailable", nextEarningsDate: null, asOf: null, source: "unavailable", status: "unavailable",
      message: "Earnings evidence is temporarily unavailable and is not included in the score.",
    };
    return NextResponse.json(payload);
  }
}
