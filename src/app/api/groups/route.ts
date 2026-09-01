import { NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import {
  addMembership,
  createGroup,
  ensureSeedGroups,
  ensureSeedInstitutions,
  getInstitutionBySlug,
  joinByInviteCode,
  listAllGroups,
  listGroupsForInstitution,
  listInstitutionMembershipsForUser,
  listInstitutions,
  listMembershipsForUser,
  removeMembership,
  setPrimaryMembership,
  updateGroupTheme,
} from "@/lib/groups/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getOptionalSession();
  const userId = session?.user?.id ?? "";
  const { searchParams } = new URL(request.url);
  const institutionSlug = searchParams.get("institution")?.trim().toLowerCase() ?? "";

  await ensureSeedInstitutions().catch(() => undefined);
  await ensureSeedGroups().catch(() => undefined);

  const institutions = await listInstitutions();
  const institution = institutionSlug
    ? await getInstitutionBySlug(institutionSlug)
    : null;
  const groups = institution
    ? await listGroupsForInstitution(institution.id)
    : await listAllGroups();

  const [memberships, institutionMemberships] = await Promise.all([
    userId ? listMembershipsForUser(userId) : Promise.resolve([]),
    userId ? listInstitutionMembershipsForUser(userId) : Promise.resolve([]),
  ]);

  return NextResponse.json({
    authenticated: Boolean(userId),
    institutions,
    institution,
    groups,
    memberships,
    institutionMemberships,
    primaryGroup: memberships.find((m) => m.isPrimary)?.group ?? null,
  });
}

export async function POST(request: Request) {
  const session = await getOptionalSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in to save groups." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: "join" | "leave" | "primary" | "create" | "invite" | "theme";
    groupId?: string;
    institutionId?: string;
    institutionSlug?: string;
    inviteCode?: string;
    name?: string;
    primaryColor?: string | null;
    isPrimary?: boolean;
  } | null;

  if (!body?.action) {
    return NextResponse.json({ error: "Missing action." }, { status: 400 });
  }

  try {
    if (body.action === "invite") {
      if (!body.inviteCode) {
        return NextResponse.json({ error: "inviteCode required." }, { status: 400 });
      }
      const result = await joinByInviteCode({
        userId,
        inviteCode: body.inviteCode,
        isPrimary: body.isPrimary,
      });
      return NextResponse.json(result);
    }

    if (body.action === "create") {
      let institutionId = body.institutionId?.trim() ?? "";
      if (!institutionId && body.institutionSlug) {
        const institution = await getInstitutionBySlug(body.institutionSlug);
        institutionId = institution?.id ?? "";
      }
      if (!institutionId) {
        return NextResponse.json(
          { error: "Pick an institution — you cannot create a new one." },
          { status: 400 },
        );
      }
      const group = await createGroup({
        institutionId,
        name: body.name ?? "",
        primaryColor: body.primaryColor,
        createdBy: userId,
      });
      const memberships = await addMembership({
        userId,
        groupId: group.id,
        isPrimary: body.isPrimary ?? false,
      });
      return NextResponse.json({ group, memberships });
    }

    if (body.action === "join") {
      if (!body.groupId) {
        return NextResponse.json({ error: "groupId required." }, { status: 400 });
      }
      const memberships = await addMembership({
        userId,
        groupId: body.groupId,
        isPrimary: body.isPrimary,
      });
      return NextResponse.json({ memberships });
    }

    if (body.action === "leave") {
      if (!body.groupId) {
        return NextResponse.json({ error: "groupId required." }, { status: 400 });
      }
      const memberships = await removeMembership(userId, body.groupId);
      return NextResponse.json({ memberships });
    }

    if (body.action === "primary") {
      if (!body.groupId) {
        return NextResponse.json({ error: "groupId required." }, { status: 400 });
      }
      const memberships = await setPrimaryMembership(userId, body.groupId);
      return NextResponse.json({ memberships });
    }

    if (body.action === "theme") {
      if (!body.groupId) {
        return NextResponse.json({ error: "groupId required." }, { status: 400 });
      }
      const group = await updateGroupTheme({
        userId,
        groupId: body.groupId,
        primaryColor: body.primaryColor ?? null,
      });
      const memberships = await listMembershipsForUser(userId);
      return NextResponse.json({ group, memberships });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Group update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
