import { NextRequest, NextResponse } from "next/server";
import { getNewsEvidenceSummary } from "@/lib/evidence/news-evidence";
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
      events: [],
      fetchedAt: new Date().toISOString(),
      source: "curated-material-news",
    }, { status: 200 });
  }

  try {
    return NextResponse.json(getNewsEvidenceSummary(
      resolved.ticker,
      resolved.companyName ?? resolved.ticker,
    ));
  } catch {
    return NextResponse.json({
      ticker: resolved.ticker,
      status: "error",
      events: [],
      message: "Material news evidence could not be loaded.",
      fetchedAt: new Date().toISOString(),
      source: "error",
    }, { status: 200 });
  }
}
