import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import { adminEmailsConfigured, isAdminEmail } from "@/lib/api/admin-access";

export function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token || null;
}

export function cronSecretConfigured(): boolean {
  return Boolean(process.env.CRON_SECRET?.trim());
}

function secretsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function isValidCronBearer(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const token = getBearerToken(request);
  if (!token) return false;
  return secretsEqual(token, secret);
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
 * Admin / ops routes: cron bearer, or a signed-in user whose email is in
 * `ADMIN_EMAILS`. Guest-only deploys without secrets stay locked (503).
 * Any other signed-in user is denied (not an implicit admin).
 */
export async function requireAdminAccess(request: NextRequest): Promise<NextResponse | null> {
  if (isValidCronBearer(request)) return null;

  const session = await getOptionalSession();
  const email = session?.user?.email;
  if (email && isAdminEmail(email)) return null;

  if (!cronSecretConfigured() && !process.env.AUTH_SECRET && !adminEmailsConfigured()) {
    return NextResponse.json(
      { success: false, error: "Admin requires CRON_SECRET or ADMIN_EMAILS + AUTH_SECRET" },
      { status: 503 },
    );
  }

  if (session?.user && !isAdminEmail(email)) {
    return unauthorizedResponse("Forbidden — admin allowlist only");
  }

  return unauthorizedResponse("Unauthorized");
}
