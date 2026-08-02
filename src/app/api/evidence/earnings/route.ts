import { NextRequest, NextResponse } from "next/server";
import { fetchEarningsEvidence } from "@/lib/earnings/fetch";
import type { EarningsEvidence } from "@/lib/earnings/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ticker = new URL(request.url).searchParams.get("ticker")?.toUpperCase();
  if (!ticker || !/^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker)) {
    return NextResponse.json({ error: "A valid ticker is required" }, { status: 400 });
  }

  try {
    const payload = await fetchEarningsEvidence(ticker);
    return NextResponse.json(payload);
  } catch (error) {
    console.error(`[api/evidence/earnings] ${ticker}:`, error);
    const payload: EarningsEvidence = {
      ticker,
      history: [],
      forecasts: [],
      gradeActions: [],
      historyScore: null,
      revisionScore: null,
      score: null,
      momentum: "Unavailable",
      nextEarningsDate: null,
      asOf: null,
      source: "unavailable",
      status: "unavailable",
      message: "Earnings evidence is temporarily unavailable and is not included in the score.",
    };
    return NextResponse.json(payload);
  }
}
