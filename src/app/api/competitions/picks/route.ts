import { NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import { ensureCommunitySchema, formatCommunityDbError } from "@/lib/db/ensure-community-schema";
import { submitPick } from "@/lib/competitions/store";

export const dynamic = "force-dynamic";

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
    return NextResponse.json({ error: "competitionId, groupId, and ticker required." }, { status: 400 });
  }

  try {
    await ensureCommunitySchema();
    const pick = await submitPick({
      competitionId: body.competitionId,
      userId,
      groupId: body.groupId,
      ticker: body.ticker,
    });
    return NextResponse.json({ pick });
  } catch (error) {
    return NextResponse.json({ error: formatCommunityDbError(error) }, { status: 400 });
  }
}
