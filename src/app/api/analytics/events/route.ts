import { createHash } from "node:crypto";
import { PRODUCT_EVENTS, type ProductEvent } from "@/lib/product-analytics";
import { isDatabaseConfigured } from "@/lib/db";
import { countProductEvent } from "@/lib/product-event-store";
import { clientIpFromRequest } from "@/lib/api/refresh-rate-limit";

export const dynamic = "force-dynamic";
const buckets = new Map<string, { count: number; expires: number }>();

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return new Response(null, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 256)
    return new Response(null, { status: 413 });
  const raw = await request.text();
  if (raw.length > 256) return new Response(null, { status: 413 });
  let body: { event?: unknown } | null;
  try { body = JSON.parse(raw); } catch { return new Response(null, { status: 400 }); }
  if (!body || typeof body.event !== "string" || !PRODUCT_EVENTS.includes(body.event as ProductEvent))
    return new Response(null, { status: 400 });
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.expires <= now) buckets.delete(key);
  // Ephemeral abuse cap; only daily aggregate counts are persisted.
  const key = createHash("sha256").update(clientIpFromRequest(request.headers)).digest("hex");
  const bucket = buckets.get(key);
  if ((bucket?.count ?? 0) >= 60 || (!bucket && buckets.size >= 2000))
    return new Response(null, { status: 429 });
  buckets.set(key, { count: (bucket?.count ?? 0) + 1, expires: bucket?.expires ?? now + 60_000 });
  if (!isDatabaseConfigured()) return Response.json({ collected: false });
  try {
    await countProductEvent(body.event as ProductEvent);
    return new Response(null, { status: 204 });
  } catch { return new Response(null, { status: 503 }); }
}
