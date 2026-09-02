import { NextRequest, NextResponse } from "next/server";
import { fetchStockHistory, type StockHistoryRange } from "@/lib/market/quotes";

const VALID_RANGES = new Set<StockHistoryRange>(["1d", "1w", "1m", "6m", "1y", "ytd"]);

/** Range-appropriate public CDN TTLs (seconds). Not user-specific. */
function cacheControlForRange(range: StockHistoryRange): string {
  if (range === "1d") return "public, s-maxage=60, stale-while-revalidate=120";
  if (range === "1w") return "public, s-maxage=300, stale-while-revalidate=600";
  if (range === "1m") return "public, s-maxage=1800, stale-while-revalidate=3600";
  if (range === "ytd") return "public, s-maxage=3600, stale-while-revalidate=7200";
  return "public, s-maxage=3600, stale-while-revalidate=7200";
}

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
  return NextResponse.json(
    { history, fetchedAt: new Date().toISOString() },
    { headers: { "Cache-Control": cacheControlForRange(range) } },
  );
}
