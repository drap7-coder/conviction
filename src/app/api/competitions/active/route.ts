import { NextRequest, NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import { ensureCommunitySchema } from "@/lib/db/ensure-community-schema";
import { buildHeadToHeadPayload } from "@/lib/competitions/store";

export const dynamic = "force-dynamic";

/** Active head-to-head rivalry card payload for Crowd.
 * Optional `a` / `b` query params select the two school group ids.
 */
export async function GET(request: NextRequest) {
  await ensureCommunitySchema().catch(() => undefined);
  const session = await getOptionalSession();
  const groupAId = request.nextUrl.searchParams.get("a");
  const groupBId = request.nextUrl.searchParams.get("b");
  const payload = await buildHeadToHeadPayload({
    userId: session?.user?.id,
    groupAId,
    groupBId,
  });
  return NextResponse.json(payload);
}
