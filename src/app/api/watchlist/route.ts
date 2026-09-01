import { after, NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import { isAuthConfigured } from "@/lib/auth-readiness";
import { getConvictionScoresForTickers } from "@/lib/conviction/score";
import { isKvEnabled } from "@/lib/watchlist/persist";
import { SEED_WATCHLIST } from "@/lib/watchlist/types";
import { getUserWatchlist, isUserWatchlistAvailable } from "@/lib/user-watchlist";

/** Warm the shared score cache so Watchlist rings can resolve quickly. */
function warmScores(tickers: string[]) {
  const unique = [...new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return;
  after(async () => {
    try {
      await getConvictionScoresForTickers(unique);
    } catch {
      // Warming is best-effort — Watchlist still fetches directly.
    }
  });
}

/**
 * GET /api/watchlist
 *
 * Signed-in → private per-user list.
 * Guest → empty `entries` + `persistence: "browser"` (client SoT is localStorage).
 * `suggestions` is the ops seed list for compose hints — not the guest's list.
 * The KV/JSON sync universe is ops/cron only and is never returned as personal entries.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getOptionalSession();
    const userId = session?.user?.id;
    const kvEnabled = isKvEnabled();

    if (userId) {
      const entries = await getUserWatchlist(userId);
      warmScores(entries.map((entry) => entry.ticker));
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
