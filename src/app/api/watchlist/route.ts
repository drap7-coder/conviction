import { NextResponse } from "next/server";
import { getWatchlist, isKvEnabled } from "@/lib/watchlist/persist";

/**
 * GET /api/watchlist
 * Returns the current watchlist with sync status and conviction context.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entries = await getWatchlist();
    const kvEnabled = isKvEnabled();

    return NextResponse.json({
      entries,
      kvEnabled,
      count: entries.length,
      activeCount: entries.filter((e) => e.status === "active").length,
      persistence: kvEnabled ? "kv" : "local-json",
      warning: kvEnabled
        ? undefined
        : "KV not configured — watchlist is stored in local JSON. Set KV_URL and KV_REST_API_URL for production durability.",
    });
  } catch (err) {
    console.error("[api/watchlist] GET error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve watchlist", entries: [], count: 0 },
      { status: 500 },
    );
  }
}