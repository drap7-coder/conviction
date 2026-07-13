import { NextResponse } from "next/server";

/**
 * GET /api/cron/daily-sync
 * Daily scheduled synchronization endpoint for Vercel Cron Jobs.
 *
 * Vercel Hobby plan: native cron supports at most once per day.
 * Do not use cron expressions more frequent than "0 0 * * *" (daily at midnight)
 * or "0 12 * * *" (daily at noon) on Hobby.
 *
 * If using Vercel Pro, this can be configured for more frequent runs.
 * Alternatively, an external scheduler (e.g., cron-job.org, GitHub Actions)
 * can call this endpoint with a simple CRON_SECRET for authorization.
 *
 * The endpoint is idempotent: repeated calls within the same day
 * will only insert new transactions not previously seen.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    // Forward to the refresh endpoint with no ticker (syncs all watchlist)
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