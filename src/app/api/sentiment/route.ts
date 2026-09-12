import { NextRequest, NextResponse } from "next/server";
import { clientIpFromRequest } from "@/lib/api/refresh-rate-limit";
import { validateTicker } from "@/lib/watchlist/validate";
import {
  checkSentimentRateLimit,
  easternPollDate,
  parseSentimentVote,
  saveSentimentVote,
  sentimentTotals,
  sentimentVoterHash,
} from "@/lib/sentiment";

export const dynamic = "force-dynamic";
async function validatedTicker(raw: string | null) {
  if (!raw) return null;
  const result = await validateTicker(raw.trim().toUpperCase());
  return result.valid ? result.ticker : null;
}
export async function GET(request: NextRequest) {
  const ticker = await validatedTicker(
    request.nextUrl.searchParams.get("ticker"),
  );
  if (!ticker)
    return NextResponse.json(
      { error: "Valid ticker required" },
      { status: 400 },
    );
  try {
    return NextResponse.json(await sentimentTotals(ticker), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Sentiment is temporarily unavailable" },
      { status: 503 },
    );
  }
}
export async function POST(request: NextRequest) {
  const ip = clientIpFromRequest(request.headers);
  if (!checkSentimentRateLimit(ip))
    return NextResponse.json(
      { error: "Too many votes. Try again later." },
      { status: 429 },
    );
  const body = (await request.json().catch(() => null)) as {
    ticker?: unknown;
    vote?: unknown;
  } | null;
  const ticker = await validatedTicker(
    typeof body?.ticker === "string" ? body.ticker : null,
  );
  const vote = parseSentimentVote(body?.vote);
  if (!ticker || !vote)
    return NextResponse.json(
      { error: "Valid ticker and vote required" },
      { status: 400 },
    );
  const date = easternPollDate();
  const voterHash = sentimentVoterHash(
    ip,
    request.headers.get("user-agent") ?? "unknown",
    date,
  );
  if (!voterHash)
    return NextResponse.json(
      { error: "Voting is not configured" },
      { status: 503 },
    );
  try {
    return NextResponse.json(
      await saveSentimentVote({ ticker, date, vote, voterHash }),
    );
  } catch {
    return NextResponse.json(
      { error: "Voting is temporarily unavailable" },
      { status: 503 },
    );
  }
}
