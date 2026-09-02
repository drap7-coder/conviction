import { NextRequest, NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import {
  createInitialCommunityPick,
  loadCommunityPicks,
} from "@/lib/community-picks/store";
import { parseH2HPerfRange } from "@/lib/competitions/perf-range";
import { ensureCommunitySchema, formatCommunityDbError } from "@/lib/db/ensure-community-schema";
import { getPrimaryGroupForUser } from "@/lib/groups/store";
import { validateTicker } from "@/lib/watchlist/validate";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureCommunitySchema().catch(() => undefined);
    const session = await getOptionalSession();
    const range = parseH2HPerfRange(request.nextUrl.searchParams.get("range"));
    return NextResponse.json(await loadCommunityPicks(session?.user?.id, range));
  } catch (error) {
    const message = formatCommunityDbError(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
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

    await createInitialCommunityPick({
      userId,
      groupId: group.id,
      ticker: validation.ticker,
    });
    return NextResponse.json(await loadCommunityPicks(userId));
  } catch (error) {
    const message = formatCommunityDbError(error);
    const status = message.includes("already have an active pick") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
