import { NextRequest, NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import { isAuthConfigured } from "@/lib/auth-readiness";
import { getUserSandbox, saveUserSandbox } from "@/lib/user-sandbox";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getOptionalSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ authenticated: false, authConfigured: isAuthConfigured(), persistence: "browser", sandbox: null });
  return NextResponse.json({ authenticated: true, persistence: "neon", sandbox: await getUserSandbox(userId) });
}

export async function PUT(request: NextRequest) {
  const session = await getOptionalSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ success: false, error: "Sign in to sync Sandbox across devices" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const sandbox = await saveUserSandbox(userId, body.holdings);
  return NextResponse.json({ success: true, persistence: "neon", sandbox });
}
