import { NextRequest, NextResponse } from "next/server";
import { getMoveEvent } from "@/lib/evidence/move-events";
import { getWatchlist } from "@/lib/watchlist/persist";
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

  const entries = await getWatchlist();
  const entry = entries.find((item) => item.ticker === rawTicker);

  if (entry) {
    return NextResponse.json(getMoveEvent(entry.ticker, entry.companyName));
  }

  const resolved = await validateTicker(rawTicker);
  if (!resolved.valid) {
    return NextResponse.json(
      { error: "ticker is not supported", ticker: rawTicker },
      { status: 404 },
    );
  }

  return NextResponse.json(
    getMoveEvent(resolved.ticker, resolved.companyName ?? resolved.ticker),
  );
}
