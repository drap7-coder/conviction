import { NextRequest, NextResponse } from "next/server";
import {
  getConvictionScoreForTicker,
  getConvictionScoresForTickers,
} from "@/lib/conviction/score";
import { validateTicker } from "@/lib/watchlist/validate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BATCH = 25;

async function resolveCompanyName(ticker: string): Promise<string> {
  const resolved = await validateTicker(ticker);
  if (resolved.valid) return resolved.companyName ?? ticker;
  return ticker;
}

/**
 * Shared Conviction Score API.
 *
 *   GET /api/conviction/score?ticker=APLD
 *   GET /api/conviction/score?tickers=APLD,AAPL,MSFT
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const single = searchParams.get("ticker")?.trim().toUpperCase() ?? null;
  const batchRaw = searchParams.get("tickers")?.trim() ?? null;

  if (single) {
    const companyName = await resolveCompanyName(single);
    const score = await getConvictionScoreForTicker(single, { companyName });
    return NextResponse.json(score);
  }

  if (batchRaw) {
    const tickers = batchRaw
      .split(",")
      .map((ticker) => ticker.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, MAX_BATCH);

    if (tickers.length === 0) {
      return NextResponse.json(
        { error: "tickers query parameter is empty" },
        { status: 400 },
      );
    }

    const resolved = await Promise.all(
      tickers.map(async (ticker) => ({
        ticker,
        companyName: await resolveCompanyName(ticker),
      })),
    );
    const scores = await getConvictionScoresForTickers(resolved);
    return NextResponse.json({ scores, count: Object.keys(scores).length });
  }

  return NextResponse.json(
    { error: "ticker or tickers query parameter is required" },
    { status: 400 },
  );
}
