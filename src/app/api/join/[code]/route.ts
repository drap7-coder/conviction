import { NextResponse } from "next/server";
import {
  ensureSeedGroups,
  ensureSeedInstitutions,
  findGroupByInviteCode,
  getInstitutionById,
} from "@/lib/groups/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

/** Resolve an invite code → community (pre-auth preview). Legacy club codes map to W&M. */
export async function GET(_request: Request, { params }: Params) {
  await ensureSeedInstitutions().catch(() => undefined);
  await ensureSeedGroups().catch(() => undefined);

  const { code } = await params;
  const group = await findGroupByInviteCode(code);
  if (!group) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }
  const institution = await getInstitutionById(group.institutionId);
  if (!institution) {
    return NextResponse.json({ error: "Community not found." }, { status: 404 });
  }

  return NextResponse.json({
    institution,
    group,
    community: {
      institution,
      groupId: group.id,
      inviteCode: group.inviteCode,
      primaryColor: group.primaryColor ?? institution.accentColor,
    },
    unofficial: institution.affiliationStatus === "unofficial",
  });
}
