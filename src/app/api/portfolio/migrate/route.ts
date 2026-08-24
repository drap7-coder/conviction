import { NextRequest, NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import { migrateUserPortfolio } from "@/lib/user-portfolio";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getOptionalSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Sign in to migrate a browser portfolio" },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const result = await migrateUserPortfolio(userId, body.positions);
  return NextResponse.json({
    success: true,
    imported: result.imported,
    positions: result.positions,
    persistence: "neon",
  });
}
