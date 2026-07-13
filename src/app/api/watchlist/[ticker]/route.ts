import { NextRequest, NextResponse } from "next/server";
import { removeFromWatchlist } from "@/lib/watchlist/persist";

/**
 * DELETE /api/watchlist/[ticker]
 * Remove a ticker from the watchlist.
 *
 * Does NOT delete historical transaction data — the data remains
 * in the persistence store in case the user re-adds the ticker later.
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
    const result = await removeFromWatchlist(upperTicker);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      removed: upperTicker,
      entries: result.entries,
      note: "Historical transaction data was preserved and will be reused if the ticker is re-added.",
    });
  } catch (err) {
    console.error(`[api/watchlist/${upperTicker}] DELETE error:`, err);
    return NextResponse.json(
      { success: false, error: "Failed to remove from watchlist" },
      { status: 500 },
    );
  }
}