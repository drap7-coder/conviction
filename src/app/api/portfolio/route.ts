import { NextRequest, NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import { isAuthConfigured } from "@/lib/auth-readiness";
import { getUserPortfolio, replaceUserPortfolio } from "@/lib/user-portfolio";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getOptionalSession();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({
      positions: [],
      authenticated: false,
      authConfigured: isAuthConfigured(),
      persistence: "browser",
    });
  }

  const positions = await getUserPortfolio(userId);
  return NextResponse.json({
    positions,
    authenticated: true,
    authConfigured: isAuthConfigured(),
    persistence: "neon",
    user: {
      name: session.user?.name ?? null,
      email: session.user?.email ?? null,
    },
  });
}

export async function PUT(request: NextRequest) {
  const session = await getOptionalSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Sign in to save a synced portfolio" },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const positions = await replaceUserPortfolio(userId, body.positions);
  return NextResponse.json({ success: true, positions, persistence: "neon" });
}
