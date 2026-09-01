import { NextRequest, NextResponse } from "next/server";
import { loadCrowdSnapshot } from "@/lib/crowd/load";
import { listActiveGroups } from "@/lib/groups/store";

export const dynamic = "force-dynamic";

/** Aggregate most-held / most-watched across member books (optional community scope). */
export async function GET(request: NextRequest) {
  try {
    const groupId = request.nextUrl.searchParams.get("group");
    const [snapshot, groups] = await Promise.all([
      loadCrowdSnapshot(groupId),
      listActiveGroups(),
    ]);
    return NextResponse.json(
      {
        ...snapshot,
        groups,
        communities: groups,
        activeGroupId: groupId,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Crowd snapshot failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
