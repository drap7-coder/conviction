import { NextRequest, NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import { loadCommunityPicks } from "@/lib/community-picks/store";
import { parseH2HPerfRange } from "@/lib/competitions/perf-range";
import { buildHeadToHeadPayload } from "@/lib/competitions/store";
import { ensureCommunitySchema, formatCommunityDbError } from "@/lib/db/ensure-community-schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/crowd/standings
 * One payload for Standings tab: head-to-head + community board.
 * Shares one serverless invocation (Yahoo baselines still cache across both).
 * Optional `range` is 1d | 1w | 1m | ytd (default 1w).
 * Optional `a` / `b` select H2H school group ids.
 */
export async function GET(request: NextRequest) {
  try {
    await ensureCommunitySchema().catch(() => undefined);
    const session = await getOptionalSession();
    const userId = session?.user?.id;
    const groupAId = request.nextUrl.searchParams.get("a");
    const groupBId = request.nextUrl.searchParams.get("b");
    // Game-theory default: avoid "winner snowball" from YTD-only scoring.
    const rawRange = request.nextUrl.searchParams.get("range");
    const range = parseH2HPerfRange(rawRange ?? "1w");

    const [headToHead, community] = await Promise.all([
      buildHeadToHeadPayload({
        userId,
        groupAId,
        groupBId,
        range,
      }),
      loadCommunityPicks(userId, range),
    ]);

    return NextResponse.json({
      range,
      headToHead,
      community,
    });
  } catch (error) {
    const message = formatCommunityDbError(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
