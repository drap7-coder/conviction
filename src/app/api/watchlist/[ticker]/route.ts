import { NextRequest, NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import { removeUserWatchlistEntry, updateUserWatchlistNote } from "@/lib/user-watchlist";

/**
 * DELETE /api/watchlist/[ticker]
 * Remove a ticker from the watchlist.
 *
 * Does NOT delete shared institutional data.
 */
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const upperTicker = ticker.toUpperCase();

  // Validate ticker format
  if (!/^[A-Z]{1,5}$/.test(upperTicker)) {
    return NextResponse.json(
      { success: false, error: `Invalid ticker: "${ticker}"` },
      { status: 400 },
    );
  }

  try {
    const session = await getOptionalSession();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Sign in to remove server-saved watchlist entries" },
        { status: 401 },
      );
    }

    const userResult = await removeUserWatchlistEntry(userId, upperTicker);

    if (!userResult.success) {
      return NextResponse.json(
        { success: false, error: userResult.error },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      removed: upperTicker,
      entries: userResult.entries,
      note: "Historical institutional data is shared and was preserved.",
    });
  } catch (err) {
    console.error(`[api/watchlist/${upperTicker}] DELETE error:`, err);
    return NextResponse.json(
      { success: false, error: "Failed to remove from watchlist" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const upperTicker = ticker.toUpperCase();

  if (!/^[A-Z]{1,5}$/.test(upperTicker)) {
    return NextResponse.json(
      { success: false, error: `Invalid ticker: "${ticker}"` },
      { status: 400 },
    );
  }

  const session = await getOptionalSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Sign in to save private notes" },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note : "";

  try {
    const result = await updateUserWatchlistNote(userId, upperTicker, note);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, entries: result.entries });
  } catch (err) {
    console.error(`[api/watchlist/${upperTicker}] PATCH error:`, err);
    return NextResponse.json(
      { success: false, error: "Failed to update note" },
      { status: 500 },
    );
  }
}
