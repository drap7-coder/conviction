import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/api/cron-auth";
import { ensureCommunitySchema } from "@/lib/db/ensure-community-schema";
import { runCompetitionLifecycleTick } from "@/lib/competitions/lifecycle";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/competitions
 * Weekly pick lifecycle: lock (Mon 9:30 ET), sync prices, settle (Fri 4 PM ET).
 * Idempotent — safe to call from Vercel cron or an external scheduler.
 */
export async function GET(request: NextRequest) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  try {
    await ensureCommunitySchema();
    const result = await runCompetitionLifecycleTick();
    return NextResponse.json({
      success: true,
      cronJob: "competitions",
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
