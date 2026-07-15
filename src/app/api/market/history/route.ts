import { NextRequest, NextResponse } from "next/server";
import { fetchStockHistory, type StockHistoryRange } from "@/lib/market/quotes";

export const dynamic = "force-dynamic";

const VALID_RANGES = new Set<StockHistoryRange>(["1d", "1w", "1m", "6m", "1y"]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.trim() ?? "";
  const rangeParam = searchParams.get("range")?.trim().toLowerCase() ?? "1m";
  const range = VALID_RANGES.has(rangeParam as StockHistoryRange)
    ? rangeParam as StockHistoryRange
    : "1m";

  if (!ticker) {
    return NextResponse.json(
      { error: "ticker query parameter is required" },
      { status: 400 },
    );
  }

  const history = await fetchStockHistory(ticker, range);
  return NextResponse.json({ history, fetchedAt: new Date().toISOString() });
}
