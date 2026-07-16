import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../auth";
import {
  getUserActivityFeed,
  markEventAsRead,
  markAllEventsAsRead,
  dismissEvent,
  getUnreadEventCount,
} from "@/lib/conviction/event-store";

/**
 * GET /api/activity
 * Returns the activity feed for the authenticated user,
 * filtered to their active watchlist tickers.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { authenticated: false, entries: [], unreadCount: 0 },
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

  const [entries, unreadCount] = await Promise.all([
    getUserActivityFeed(session.user.id, limit, offset),
    getUnreadEventCount(session.user.id),
  ]);

  return NextResponse.json({
    authenticated: true,
    entries,
    unreadCount,
  });
}

/**
 * POST /api/activity
 * Actions: markRead, markAllRead, dismiss
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { action, eventId } = body;

  switch (action) {
    case "markRead":
      if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });
      await markEventAsRead(session.user.id, eventId);
      return NextResponse.json({ success: true });

    case "markAllRead":
      await markAllEventsAsRead(session.user.id);
      return NextResponse.json({ success: true });

    case "dismiss":
      if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });
      await dismissEvent(session.user.id, eventId);
      return NextResponse.json({ success: true });

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}