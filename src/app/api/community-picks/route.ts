import { NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import { loadCommunityPicks, setCommunityPick } from "@/lib/community-picks/store";
import { ensureCommunitySchema, formatCommunityDbError } from "@/lib/db/ensure-community-schema";
import { getPrimaryGroupForUser } from "@/lib/groups/store";
import { fetchStockQuotes } from "@/lib/market/quotes";
import { validateTicker } from "@/lib/watchlist/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureCommunitySchema();
  const session = await getOptionalSession();
  return NextResponse.json(await loadCommunityPicks(session?.user?.id));
}

export async function POST(request: Request) {
  const session = await getOptionalSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in to set a community pick." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { ticker?: string } | null;
  if (!body?.ticker?.trim()) {
    return NextResponse.json({ error: "Enter a ticker." }, { status: 400 });
  }

  try {
    await ensureCommunitySchema();
    const group = await getPrimaryGroupForUser(userId);
    if (!group) {
      return NextResponse.json({ error: "Join a community before setting a pick." }, { status: 400 });
    }

    const validation = await validateTicker(body.ticker);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error ?? "Enter a valid ticker." }, { status: 400 });
    }
    if (validation.instrumentKind === "crypto") {
      return NextResponse.json({ error: "Choose a stock or ETF ticker." }, { status: 400 });
    }

    const ticker = validation.ticker.toUpperCase();
    const [quote] = await fetchStockQuotes([ticker]);
    const entryPrice = quote?.price ?? quote?.previousClose ?? null;
    if (entryPrice === null || entryPrice <= 0) {
      return NextResponse.json({ error: `Could not get a market price for ${ticker}.` }, { status: 400 });
    }

    await setCommunityPick({ userId, groupId: group.id, ticker, entryPrice });
    return NextResponse.json(await loadCommunityPicks(userId));
  } catch (error) {
    return NextResponse.json({ error: formatCommunityDbError(error) }, { status: 400 });
  }
}
