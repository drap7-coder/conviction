import { NextResponse } from "next/server";
import { getRecentConvictionTransitions } from "@/lib/conviction/transition-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const transitions = await getRecentConvictionTransitions(6);
  return NextResponse.json({
    transitions,
    count: transitions.length,
    fetchedAt: new Date().toISOString(),
  });
}
