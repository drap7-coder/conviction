import { NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import { ensureCommunitySchema } from "@/lib/db/ensure-community-schema";
import { buildHeadToHeadPayload } from "@/lib/competitions/store";

export const dynamic = "force-dynamic";

/** Active head-to-head rivalry card payload for Crowd. */
export async function GET() {
  await ensureCommunitySchema().catch(() => undefined);
  const session = await getOptionalSession();
  const payload = await buildHeadToHeadPayload({
    userId: session?.user?.id,
  });
  return NextResponse.json(payload);
}
