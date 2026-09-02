import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/api/cron-auth";
import { runFullEvidenceSync } from "@/lib/evidence/full-sync";

/**
 * GET /api/cron/daily-sync
 * Daily scheduled synchronization for all active watchlist companies.
 *
 * Runs the full evidence sync in-process (no self-HTTP to the refresh route)
 * so Hobby plans are not billed a second serverless invocation.
 *
 * Vercel Hobby plan: native cron supports at most once per day.
 * This endpoint is idempotent: repeated calls within the same day
 * will only insert new transactions not previously seen.
 *
 * Security: Fail-closed on `CRON_SECRET`. Requests without a valid
 * `Authorization: Bearer <CRON_SECRET>` header are rejected.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  try {
    const data = await runFullEvidenceSync();

    return NextResponse.json({
      success: true,
      cronJob: "daily-sync",
      note: "Vercel Hobby: max once per day. Upgrade to Pro for sub-daily schedules.",
      results: data.summary,
      lruOrder: data.summary?.lruOrder,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status =
      typeof err === "object" && err && "status" in err && typeof (err as { status: unknown }).status === "number"
        ? (err as { status: number }).status
        : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
