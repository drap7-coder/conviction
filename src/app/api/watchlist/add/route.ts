import { NextRequest, NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import { validateTicker } from "@/lib/watchlist/validate";
import { addUserWatchlistEntry } from "@/lib/user-watchlist";
import { sanitizeWatchlistInput } from "@/lib/watchlist/sanitize-ticker";

/**
 * POST /api/watchlist/add
 * Validate a ticker and persist it to the caller's personal list.
 *
 * Signed-in → Neon. Guest → browser-only response (client writes localStorage).
 * Never mutates the shared ops/cron evidence sync universe.
 *
 * Body: { ticker: string } | { company: string }
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const input = sanitizeWatchlistInput(body.ticker || body.company || "");

  if (!input) {
    return NextResponse.json(
      { success: false, error: "Enter a ticker or company name" },
      { status: 400 },
    );
  }

  const validation = await validateTicker(input);
  if (!validation.valid) {
    return NextResponse.json(
      { success: false, error: validation.error, ticker: validation.ticker },
      { status: 400 },
    );
  }

  const { ticker, companyName, cik, isForeignIssuer } = validation;
  if (!companyName) {
    return NextResponse.json(
      { success: false, error: "Could not resolve company name", ticker },
      { status: 400 },
    );
  }

  const status = isForeignIssuer ? "unsupported" : "active";
  const statusMessage = isForeignIssuer
    ? `${companyName} is a foreign issuer and does not file SEC Form 4. Added for reference only.`
    : undefined;

  const session = await getOptionalSession();
  const userId = session?.user?.id;
  if (userId) {
    const result = await addUserWatchlistEntry(userId, {
      ticker,
      companyName,
      cik,
      addedAt: new Date().toISOString(),
      status,
      statusMessage,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, entries: result.entries },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      added: { ticker, companyName, cik, status },
      entries: result.entries,
      persistence: "neon",
      initialSync: isForeignIssuer
        ? { skipped: true, reason: "Foreign issuer — does not file SEC Form 4" }
        : { skipped: true, reason: "Saved privately. Institutional data is loaded from the shared evidence engine." },
    });
  }

  // Guests (and any session without a user id) persist in the browser only.
  return NextResponse.json({
    success: true,
    added: {
      ticker,
      companyName,
      cik,
      addedAt: new Date().toISOString(),
      status,
      statusMessage,
    },
    entries: [],
    persistence: "browser",
    initialSync: isForeignIssuer
      ? { skipped: true, reason: "Foreign issuer — does not file SEC Form 4" }
      : { skipped: true, reason: "Saved in this browser. Sign in to sync across devices." },
  });
}
