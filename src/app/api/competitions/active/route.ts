import { NextRequest, NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import { ensureCommunitySchema } from "@/lib/db/ensure-community-schema";
import { parseH2HPerfRange } from "@/lib/competitions/perf-range";
import { buildHeadToHeadPayload } from "@/lib/competitions/store";

export const dynamic = "force-dynamic";

/** Active head-to-head rivalry card payload for Crowd.
 * Optional `a` / `b` query params select the two school group ids.
 * Optional `range` is 1d | 1w | 1m | ytd (default ytd).
 */
export async function GET(request: NextRequest) {
  await ensureCommunitySchema().catch(() => undefined);
  const session = await getOptionalSession();
  const groupAId = request.nextUrl.searchParams.get("a");
  const groupBId = request.nextUrl.searchParams.get("b");
  const range = parseH2HPerfRange(request.nextUrl.searchParams.get("range"));
  const payload = await buildHeadToHeadPayload({
    userId: session?.user?.id,
    groupAId,
    groupBId,
    range,
  });
  return NextResponse.json(payload);
}
