import { NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import { listActiveCompetitionStandings, submitCompetitionPick } from "@/lib/groups/competitions";

export const dynamic = "force-dynamic";

export async function GET() {
  const competitions = await listActiveCompetitionStandings();
  return NextResponse.json({ competitions });
}

export async function POST(request: Request) {
  const session = await getOptionalSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in to submit a pick." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    competitionId?: string;
    groupId?: string;
    ticker?: string;
  } | null;

  if (!body?.competitionId || !body.groupId || !body.ticker) {
    return NextResponse.json({ error: "competitionId, groupId, and ticker are required." }, { status: 400 });
  }

  try {
    const pick = await submitCompetitionPick({
      userId,
      competitionId: body.competitionId,
      groupId: body.groupId,
      ticker: body.ticker,
    });
    return NextResponse.json({ pick });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pick failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
