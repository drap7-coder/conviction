import { NextRequest, NextResponse } from "next/server";
import { isRequestTimeout } from "@/lib/request-timeout";
import { fetchShortInterestSummary } from "@/lib/market/short-interest";
import { validateTicker } from "@/lib/watchlist/validate";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawTicker = searchParams.get("ticker")?.toUpperCase();

  if (!rawTicker) {
    return NextResponse.json(
      { error: "ticker query parameter is required" },
      { status: 400 },
    );
  }

  const resolved = await validateTicker(rawTicker);
  if (!resolved.valid) {
    return NextResponse.json({
      ticker: rawTicker,
      status: "unsupported",
      latest: null,
      previous: null,
      fetchedAt: new Date().toISOString(),
      source: "finra-consolidated-short-interest",
    }, { status: 200 });
  }

  try {
    return NextResponse.json(await fetchShortInterestSummary(resolved.ticker));
  } catch (error) {
    const timedOut = isRequestTimeout(error);
    return NextResponse.json({
      ticker: resolved.ticker,
      status: timedOut ? "timeout" : "error",
      latest: null,
      previous: null,
      message: timedOut
        ? "Short interest data is temporarily unavailable."
        : "Short interest data could not be loaded.",
      fetchedAt: new Date().toISOString(),
      source: timedOut ? "timeout" : "error",
    }, { status: 200 });
  }
}
