import { NextRequest, NextResponse } from "next/server";
import { getMajorOwnershipSummary } from "@/lib/sec/major-ownership";
import { isRequestTimeout } from "@/lib/request-timeout";
import { validateTicker } from "@/lib/watchlist/validate";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.toUpperCase();

  if (!ticker) {
    return NextResponse.json(
      { error: "ticker query parameter is required" },
      { status: 400 },
    );
  }

  const resolved = await validateTicker(ticker);
  if (!resolved.valid) {
    return NextResponse.json({
      ticker,
      status: "unsupported",
      filings: [],
      latestFiling: null,
      fetchedAt: new Date().toISOString(),
      source: "sec-submissions",
    }, { status: 200 });
  }

  try {
    const summary = await getMajorOwnershipSummary(resolved.ticker, resolved.cik);
    return NextResponse.json(summary);
  } catch (error) {
    const timedOut = isRequestTimeout(error);
    return NextResponse.json({
      ticker: resolved.ticker,
      status: timedOut ? "timeout" : "error",
      filings: [],
      latestFiling: null,
      message: timedOut
        ? "SEC major ownership filings are temporarily unavailable."
        : "SEC major ownership filings could not be loaded.",
      fetchedAt: new Date().toISOString(),
      source: timedOut ? "timeout" : "error",
    }, { status: 200 });
  }
}
