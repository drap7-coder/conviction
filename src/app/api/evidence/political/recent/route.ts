import { NextRequest, NextResponse } from "next/server";
import { getRecentPoliticalTrades } from "@/lib/political-trades";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 80) : 40;

  try {
    const trades = await getRecentPoliticalTrades(limit);
    return NextResponse.json({
      trades,
      fetchedAt: new Date().toISOString(),
      attemptedAt: new Date().toISOString(),
      source: "kadoa-open-data",
      status: trades.length > 0 ? "success" : "empty",
      message:
        trades.length > 0
          ? undefined
          : "No STOCK Act filings are available right now.",
    });
  } catch (err) {
    console.error("[api/evidence/political/recent]", err);
    return NextResponse.json(
      {
        trades: [],
        status: "error",
        error: "Political trade data unavailable",
        message: "STOCK Act filings could not be loaded.",
        attemptedAt: new Date().toISOString(),
      },
      { status: 502 },
    );
  }
}
