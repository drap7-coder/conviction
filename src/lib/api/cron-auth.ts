import { NextRequest, NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";

export function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token || null;
}

export function cronSecretConfigured(): boolean {
  return Boolean(process.env.CRON_SECRET?.trim());
}

export function isValidCronBearer(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return getBearerToken(request) === secret;
}

export function unauthorizedResponse(message = "Unauthorized") {
  return NextResponse.json({ success: false, error: message }, { status: 401 });
}

export function missingCronSecretResponse() {
  return NextResponse.json(
    { success: false, error: "CRON_SECRET is not configured" },
    { status: 503 },
  );
}

/** Fail closed: CRON_SECRET must be set and match the Bearer token. */
export function requireCronSecret(request: NextRequest): NextResponse | null {
  if (!cronSecretConfigured()) return missingCronSecretResponse();
  if (!isValidCronBearer(request)) {
    return unauthorizedResponse("Unauthorized — provide Authorization: Bearer <CRON_SECRET>");
  }
  return null;
}

/**
 * Admin / ops routes: cron bearer, or a signed-in user when auth is configured.
 * Guest-only deploys without secrets stay locked (503).
 */
export async function requireAdminAccess(request: NextRequest): Promise<NextResponse | null> {
  if (isValidCronBearer(request)) return null;

  const session = await getOptionalSession();
  if (session?.user) return null;

  if (!cronSecretConfigured() && !process.env.AUTH_SECRET) {
    return NextResponse.json(
      { success: false, error: "Admin requires CRON_SECRET or AUTH_SECRET" },
      { status: 503 },
    );
  }

  return unauthorizedResponse("Unauthorized");
}
