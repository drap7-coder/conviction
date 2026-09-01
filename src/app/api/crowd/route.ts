import { NextRequest, NextResponse } from "next/server";
import { loadCrowdSnapshot } from "@/lib/crowd/load";
import { listActiveGroups } from "@/lib/groups/store";
import { listActiveCompetitionStandings } from "@/lib/groups/competitions";

export const dynamic = "force-dynamic";

/** Aggregate most-held / most-watched across member books (optional group scope). */
export async function GET(request: NextRequest) {
  try {
    const groupId = request.nextUrl.searchParams.get("group");
    const [snapshot, groups, competitions] = await Promise.all([
      loadCrowdSnapshot(groupId),
      listActiveGroups(),
      listActiveCompetitionStandings(),
    ]);
    return NextResponse.json(
      {
        ...snapshot,
        groups,
        competitions,
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
