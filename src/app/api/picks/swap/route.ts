import { NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import { parseCallSlot } from "@/lib/community-picks/call-slots";
import { pricingSymbolForStored } from "@/lib/community-picks/asset-maps";
import {
  loadCommunityPicks,
  normalizeStoredAsset,
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

  const body = (await request.json().catch(() => null)) as {
    ticker?: string;
    asset?: string;
    slot?: string;
    callSlot?: string;
  } | null;

  const callSlot = parseCallSlot(body?.callSlot ?? body?.slot) ?? "STOCK_1";
  const rawAsset = (body?.asset ?? body?.ticker)?.trim();
  if (!rawAsset) {
    return NextResponse.json({ error: "Choose a pick." }, { status: 400 });
  }

  try {
    await ensureCommunitySchema();
    const group = await getPrimaryGroupForUser(userId);
    if (!group) {
      return NextResponse.json({ error: "Join a community before swapping a pick." }, { status: 400 });
    }

    let asset = rawAsset;
    if (callSlot === "STOCK_1" || callSlot === "STOCK_2" || callSlot === "STOCK_3") {
      const validation = await validateTicker(rawAsset);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error ?? "Enter a valid ticker." }, { status: 400 });
      }
      if (validation.instrumentKind === "crypto") {
        return NextResponse.json({ error: "Choose a stock or ETF ticker." }, { status: 400 });
      }
      asset = validation.ticker;
    } else {
      asset = normalizeStoredAsset(callSlot, rawAsset);
      void pricingSymbolForStored(callSlot, asset);
    }

    const result = await swapCommunityPick({
      userId,
      groupId: group.id,
      callSlot,
      asset,
    });

    const payload = await loadCommunityPicks(userId);
    return NextResponse.json({
      ...payload,
      viewerPick: result.pick,
      viewerPicks: result.viewerPicks,
      filledCount: result.filledCount,
      boardComplete: result.boardComplete,
      iqbullsReturnPct: result.iqbullsReturnPct,
      leaderboardEligible: result.leaderboardEligible,
      pickHistory: result.pickHistory,
    });
  } catch (error) {
    return NextResponse.json({ error: formatCommunityDbError(error) }, { status: 400 });
  }
}
