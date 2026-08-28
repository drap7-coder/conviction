import { NextResponse } from "next/server";
import { loadCrowdSnapshot } from "@/lib/crowd/load";

export const dynamic = "force-dynamic";

/** Aggregate most-held / most-watched across member books (seeds + signed-in). */
export async function GET() {
  try {
    const snapshot = await loadCrowdSnapshot();
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Crowd snapshot failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
