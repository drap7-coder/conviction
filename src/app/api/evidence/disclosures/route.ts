import { NextRequest, NextResponse } from "next/server";
import { getCorporateDisclosureSummary } from "@/lib/sec/corporate-disclosures";
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
      lastEarningsRelease: null,
      lastQuarterlyReport: null,
      lastAnnualReport: null,
      latestDisclosure: null,
      disclosures: [],
      fetchedAt: new Date().toISOString(),
      source: "sec-submissions",
    }, { status: 200 });
  }

  try {
    const summary = await getCorporateDisclosureSummary(
      resolved.ticker,
      resolved.cik,
    );
    return NextResponse.json(summary);
  } catch (error) {
    const timedOut = isRequestTimeout(error);
    return NextResponse.json({
      ticker: resolved.ticker,
      status: timedOut ? "timeout" : "error",
      lastEarningsRelease: null,
      lastQuarterlyReport: null,
      lastAnnualReport: null,
      latestDisclosure: null,
      disclosures: [],
      message: timedOut
        ? "SEC corporate disclosures are temporarily unavailable."
        : "SEC corporate disclosures could not be loaded.",
      fetchedAt: new Date().toISOString(),
      source: timedOut ? "timeout" : "error",
    }, { status: 200 });
  }
}
