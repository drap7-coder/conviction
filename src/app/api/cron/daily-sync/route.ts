import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/cron/daily-sync
 * Daily scheduled synchronization for all active watchlist companies.
 *
 * Reads from the persisted watchlist and syncs least-recently-synced
 * active companies first, respecting all sync-config limits.
 *
 * Vercel Hobby plan: native cron supports at most once per day.
 * This endpoint is idempotent: repeated calls within the same day
 * will only insert new transactions not previously seen.
 *
 * Security: Protected by CRON_SECRET environment variable.
 * Requests without a valid `Authorization: Bearer <CRON_SECRET>` header
 * are rejected. This prevents unauthorized triggering of full syncs.
 *
 * For external schedulers (e.g., cron-job.org, GitHub Actions):
 * Send header: Authorization: Bearer ${CRON_SECRET}
 * to this endpoint URL.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // CRON_SECRET verification
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized — provide a valid CRON_SECRET" },
        { status: 401 },
      );
    }
  }

  try {
    const origin = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    const response = await fetch(`${origin}/api/evidence/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { success: false, error: `Refresh returned ${response.status}`, detail: text },
        { status: 502 },
      );
    }

    const data = await response.json();

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
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}