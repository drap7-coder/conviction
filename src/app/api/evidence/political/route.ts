import { NextRequest, NextResponse } from "next/server";
import { getPoliticalTradesForTicker } from "@/lib/political-trades";
import { isRequestTimeout } from "@/lib/request-timeout";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.toUpperCase();

  if (!ticker) {
    return NextResponse.json(
      { error: "ticker query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const result = await getPoliticalTradesForTicker(ticker);
    return NextResponse.json(result);
  } catch (err) {
    console.error(`[api/evidence/political] ${ticker}:`, err);
    const timedOut = isRequestTimeout(err);
    return NextResponse.json(
      {
        ticker,
        trades: [],
        purchases: [],
        sales: [],
        totalEstimatedPurchases: 0,
        totalEstimatedSales: 0,
        latestFilingDate: null,
        source: timedOut ? "timeout" : "error",
        status: timedOut ? "timeout" : "error",
        message: timedOut
          ? "Political disclosure data is temporarily unavailable."
          : "Political disclosure data could not be loaded.",
        fetchedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
}
