import { NextRequest, NextResponse } from "next/server";
import { fetchOpenAttentionPulse } from "@/lib/market/open-attention";
import { fetchStockQuotes } from "@/lib/market/quotes";
import { validateTicker } from "@/lib/watchlist/validate";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestedTicker = new URL(request.url).searchParams.get("ticker")?.trim() ?? "";
  if (!requestedTicker) {
    return NextResponse.json(
      { error: "ticker query parameter is required" },
      { status: 400 },
    );
  }

  const resolved = await validateTicker(requestedTicker);
  if (!resolved.valid) {
    return NextResponse.json(
      { error: resolved.error ?? "Ticker is not supported" },
      { status: 400 },
    );
  }

  const ticker = resolved.ticker.toUpperCase();
  const [quote] = await fetchStockQuotes([ticker]);
  const pulse = await fetchOpenAttentionPulse([{
    ticker,
    label: resolved.companyName ?? ticker,
    priceChangePercent: quote?.changePercent ?? null,
    scope: "company",
  }]);

  return NextResponse.json(pulse);
}
