import { NextRequest } from "next/server";
import { requireAdminAccess } from "@/lib/api/cron-auth";
import { isDatabaseConfigured, query } from "@/lib/db";
import { ensureProductEventTable } from "@/lib/product-event-store";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const denied = await requireAdminAccess(request);
  if (denied) return denied;
  if (!isDatabaseConfigured()) return Response.json({ available: false, counts: [] });
  try {
    await ensureProductEventTable();
    const result = await query(`select event_date::text as date,event_name as event,event_count::text as count
      from product_event_counts where event_date >= (now() at time zone 'UTC')::date - 29
      order by event_date desc,event_name`);
    return Response.json({ available: true, counts: result.rows }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Analytics unavailable" }, { status: 503 }); }
}
