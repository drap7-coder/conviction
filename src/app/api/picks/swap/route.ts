import { NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import {
  loadCommunityPicks,
  swapCommunityPick,
} from "@/lib/community-picks/store";
import { ensureCommunitySchema, formatCommunityDbError } from "@/lib/db/ensure-community-schema";
import { getPrimaryGroupForUser } from "@/lib/groups/store";
import { validateTicker } from "@/lib/watchlist/validate";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getOptionalSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in to swap your pick." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { ticker?: string } | null;
  if (!body?.ticker?.trim()) {
    return NextResponse.json({ error: "Enter a ticker." }, { status: 400 });
  }

  try {
    await ensureCommunitySchema();
    const group = await getPrimaryGroupForUser(userId);
    if (!group) {
      return NextResponse.json({ error: "Join a community before swapping a pick." }, { status: 400 });
    }

    const validation = await validateTicker(body.ticker);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error ?? "Enter a valid ticker." }, { status: 400 });
    }
    if (validation.instrumentKind === "crypto") {
      return NextResponse.json({ error: "Choose a stock or ETF ticker." }, { status: 400 });
    }

    const result = await swapCommunityPick({
      userId,
      groupId: group.id,
      newTicker: validation.ticker,
    });

    const payload = await loadCommunityPicks(userId);
    return NextResponse.json({
      ...payload,
      viewerPick: result.pick,
      pickHistory: result.pickHistory,
    });
  } catch (error) {
    return NextResponse.json({ error: formatCommunityDbError(error) }, { status: 400 });
  }
}
