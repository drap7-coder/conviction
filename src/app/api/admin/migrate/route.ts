import { NextRequest, NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/api/cron-auth";
import { applyMigrations } from "@/lib/db/migrate";
import { ensureCommunitySchema } from "@/lib/db/ensure-community-schema";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/migrate
 * Apply pending SQL migrations + seed institutions/groups.
 * Auth: Bearer CRON_SECRET or ADMIN_EMAILS session.
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdminAccess(request);
  if (denied) return denied;

  try {
    const migrations = await applyMigrations();
    await ensureCommunitySchema({ includeDirectory: true });
    return NextResponse.json({
      success: true,
      migrations,
      seeds: { institutions: true, groups: true },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Migration failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
