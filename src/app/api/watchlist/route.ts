import { NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import { isAuthConfigured } from "@/lib/auth-readiness";
import { isSyncUniverseKvEnabled } from "@/lib/evidence/sync-universe";
import { SEED_WATCHLIST } from "@/lib/watchlist/types";
import { getUserWatchlist, isUserWatchlistAvailable } from "@/lib/user-watchlist";

/**
 * GET /api/watchlist
 *
 * Signed-in → private per-user list.
 * Guest → empty `entries` + `persistence: "browser"` (client SoT is localStorage).
 * `suggestions` is the ops seed list for compose hints — not the guest's list.
 * The KV/JSON sync universe is ops/cron only and is never returned as personal entries.
 *
 * Lightweight read only — no conviction-score warming and no long-running
 * Next.js after callbacks or other side effects. Watchlist UI does not display
 * conviction scores; company pages fetch `/api/conviction/score` on demand.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getOptionalSession();
    const userId = session?.user?.id;
    const kvEnabled = isSyncUniverseKvEnabled();

    if (userId) {
      const entries = await getUserWatchlist(userId);
      return NextResponse.json({
        entries,
        authenticated: true,
        user: {
          name: session.user?.name ?? null,
          email: session.user?.email ?? null,
        },
        authConfigured: isAuthConfigured(),
        count: entries.length,
        activeCount: entries.filter((e) => e.status === "active").length,
        persistence: isUserWatchlistAvailable() ? "neon" : "unconfigured",
        suggestions: SEED_WATCHLIST,
        warning: isUserWatchlistAvailable()
          ? undefined
          : "Private watchlist storage is temporarily unavailable.",
      });
    }

    return NextResponse.json({
      entries: [],
      suggestions: SEED_WATCHLIST,
      authenticated: false,
      authConfigured: isAuthConfigured(),
      kvEnabled,
      count: 0,
      activeCount: 0,
      persistence: "browser",
      warning: "Guest watchlists are saved in this browser only. Sign in to sync across devices.",
    });
  } catch (err) {
    console.error("[api/watchlist] GET error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve watchlist", entries: [], count: 0 },
      { status: 500 },
    );
  }
}
