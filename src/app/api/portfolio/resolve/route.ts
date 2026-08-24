import { NextRequest, NextResponse } from "next/server";
import { searchYahooSymbols } from "@/lib/market/yahoo-search";
import { validateTicker } from "@/lib/watchlist/validate";

export const dynamic = "force-dynamic";

function comparableTicker(value: string): string {
  return value.trim().toUpperCase().replace(/[.\-]/g, "");
}

/** Resolve watchlist-style company input while retaining ETF/fund support. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const input = typeof body.input === "string" ? body.input.trim() : "";

  if (!input) {
    return NextResponse.json(
      { success: false, error: "Enter a ticker or company name." },
      { status: 400 },
    );
  }

  if (input.length > 100) {
    return NextResponse.json(
      { success: false, error: "Ticker or company name is too long." },
      { status: 400 },
    );
  }

  const validation = await validateTicker(input);
  if (validation.valid) {
    return NextResponse.json({
      success: true,
      ticker: validation.ticker,
      companyName: validation.companyName ?? validation.ticker,
    });
  }

  const suggestions = await searchYahooSymbols(input, 8);
  const comparableInput = comparableTicker(input);
  const match =
    suggestions.find((suggestion) => comparableTicker(suggestion.ticker) === comparableInput) ??
    suggestions.find((suggestion) => suggestion.name.trim().toUpperCase() === input.toUpperCase()) ??
    suggestions[0];

  if (!match) {
    return NextResponse.json(
      { success: false, error: validation.error ?? `Could not find “${input}”.` },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    ticker: match.ticker.toUpperCase(),
    companyName: match.name,
  });
}
