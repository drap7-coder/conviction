import { NextRequest, NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import { migrateUserWatchlist } from "@/lib/user-watchlist";
import type { WatchlistEntry } from "@/lib/watchlist/types";
import { validateTicker } from "@/lib/watchlist/validate";

export const dynamic = "force-dynamic";

function isCandidate(entry: unknown): entry is Partial<WatchlistEntry> & { ticker: string } {
  return Boolean(
    entry &&
      typeof entry === "object" &&
      "ticker" in entry &&
      typeof entry.ticker === "string",
  );
}

export async function POST(request: NextRequest) {
  const session = await getOptionalSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Sign in to migrate a browser watchlist" },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const rawEntries = Array.isArray(body.entries) ? body.entries : [];
  const normalized: WatchlistEntry[] = [];

  for (const rawEntry of rawEntries) {
    if (!isCandidate(rawEntry)) continue;
    const ticker = rawEntry.ticker;
    const resolved = await validateTicker(ticker);
    if (!resolved.valid || !resolved.companyName) continue;

    normalized.push({
      ticker: resolved.ticker,
      companyName: resolved.companyName,
      cik: resolved.cik,
      addedAt: typeof rawEntry.addedAt === "string" ? rawEntry.addedAt : new Date().toISOString(),
      status: resolved.isForeignIssuer ? "unsupported" : "active",
      statusMessage: resolved.isForeignIssuer
        ? `${resolved.companyName} is a foreign issuer and does not file SEC Form 4. Added for reference only.`
        : undefined,
    });
  }

  const result = await migrateUserWatchlist(userId, normalized);
  return NextResponse.json({
    success: true,
    imported: result.imported,
    entries: result.entries,
  });
}
