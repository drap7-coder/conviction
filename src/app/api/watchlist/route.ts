import { NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import { getWatchlist, isKvEnabled } from "@/lib/watchlist/persist";
import { SEED_WATCHLIST } from "@/lib/watchlist/types";
import { getUserWatchlist, isUserWatchlistAvailable } from "@/lib/user-watchlist";

/**
 * GET /api/watchlist
 * Returns the current watchlist with sync status and conviction context.
 */
export const dynamic = "force-dynamic";

function isAuthConfigured() {
  return Boolean(
    process.env.AUTH_SECRET &&
      process.env.AUTH_GITHUB_ID &&
      process.env.AUTH_GITHUB_SECRET &&
      process.env.DATABASE_URL,
  );
}

export async function GET() {
  try {
    const session = await getOptionalSession();
    const userId = session?.user?.id;
    const kvEnabled = isKvEnabled();

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
          : "DATABASE_URL is not configured — signed-in watchlists are unavailable.",
      });
    }

    const entries = await getWatchlist();

    return NextResponse.json({
      entries: [],
      guestEntries: entries,
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
