import { NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import {
  ensureCommunitySchema,
  formatCommunityDbError,
} from "@/lib/db/ensure-community-schema";
import {
  getInstitutionBySlug,
  joinByInviteCode,
  joinCommunity,
  listCommunities,
  listCommunityMembershipsForUser,
  listInstitutions,
  removeMembership,
  setPrimaryMembership,
  updateCommunityTheme,
} from "@/lib/groups/store";

export const dynamic = "force-dynamic";

/**
 * Communities API — one layer (school/company).
 * Subgroup create/join is intentionally unavailable.
 */
export async function GET(request: Request) {
  const session = await getOptionalSession();
  const userId = session?.user?.id ?? "";
  const { searchParams } = new URL(request.url);
  const institutionSlug = searchParams.get("institution")?.trim().toLowerCase() ?? "";

  await ensureCommunitySchema().catch(() => undefined);

  const [institutions, communities, memberships] = await Promise.all([
    listInstitutions(),
    listCommunities(),
    userId ? listCommunityMembershipsForUser(userId) : Promise.resolve([]),
  ]);

  const institution = institutionSlug
    ? await getInstitutionBySlug(institutionSlug)
    : null;

  const primary = memberships.find((m) => m.isPrimary) ?? memberships[0] ?? null;

  return NextResponse.json({
    authenticated: Boolean(userId),
    institutions,
    communities: institution
      ? communities.filter((c) => c.institution.id === institution.id)
      : communities,
    memberships,
    primaryCommunity: primary,
    // Compat aliases for GroupAccentProvider / older clients.
    groups: communities.map((c) => ({
      id: c.groupId,
      institutionId: c.institution.id,
      name: c.institution.name,
      inviteCode: c.inviteCode,
      primaryColor: c.primaryColor,
      isCanonicalCommunity: true,
    })),
    primaryGroup: primary
      ? {
          id: primary.groupId,
          institutionId: primary.institutionId,
          name: primary.institution.name,
          inviteCode: null,
          primaryColor: primary.primaryColor,
          isCanonicalCommunity: true,
        }
      : null,
  });
}

export async function POST(request: Request) {
  const session = await getOptionalSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in to join a community." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: "join" | "leave" | "primary" | "invite" | "theme" | "create";
    groupId?: string;
    institutionId?: string;
    institutionSlug?: string;
    inviteCode?: string;
    primaryColor?: string | null;
    isPrimary?: boolean;
    name?: string;
  } | null;

  if (!body?.action) {
    return NextResponse.json({ error: "Missing action." }, { status: 400 });
  }

  try {
    await ensureCommunitySchema();

    if (body.action === "create") {
      return NextResponse.json(
        {
          error:
            "Communities are permanent campus or company containers. You cannot create a new one here.",
        },
        { status: 400 },
      );
    }

    if (body.action === "invite") {
      if (!body.inviteCode) {
        return NextResponse.json({ error: "inviteCode required." }, { status: 400 });
      }
      const result = await joinByInviteCode({
        userId,
        inviteCode: body.inviteCode,
        isPrimary: body.isPrimary ?? true,
      });
      if (body.primaryColor && result.institution.id) {
        await updateCommunityTheme({
          userId,
          institutionId: result.institution.id,
          primaryColor: body.primaryColor,
        });
      }
      return NextResponse.json(result);
    }

    if (body.action === "join") {
      let institutionId = body.institutionId?.trim() ?? "";
      if (!institutionId && body.institutionSlug) {
        const institution = await getInstitutionBySlug(body.institutionSlug);
        institutionId = institution?.id ?? "";
      }
      if (!institutionId && body.groupId) {
        const communities = await listCommunities();
        institutionId =
          communities.find((c) => c.groupId === body.groupId)?.institution.id ?? "";
      }
      if (!institutionId) {
        return NextResponse.json({ error: "institutionId required." }, { status: 400 });
      }
      const memberships = await joinCommunity({
        userId,
        institutionId,
        isPrimary: body.isPrimary,
      });
      if (body.primaryColor) {
        await updateCommunityTheme({
          userId,
          institutionId,
          primaryColor: body.primaryColor,
        });
      }
      return NextResponse.json({
        memberships: await listCommunityMembershipsForUser(userId),
        groupMemberships: memberships,
      });
    }

    if (body.action === "leave") {
      const groupId =
        body.groupId ??
        (body.institutionId
          ? (await listCommunities()).find((c) => c.institution.id === body.institutionId)
              ?.groupId
          : undefined);
      if (!groupId) {
        return NextResponse.json({ error: "groupId required." }, { status: 400 });
      }
      await removeMembership(userId, groupId);
      return NextResponse.json({
        memberships: await listCommunityMembershipsForUser(userId),
      });
    }

    if (body.action === "primary") {
      const groupId =
        body.groupId ??
        (body.institutionId
          ? (await listCommunities()).find((c) => c.institution.id === body.institutionId)
              ?.groupId
          : undefined);
      if (!groupId) {
        return NextResponse.json({ error: "groupId required." }, { status: 400 });
      }
      await setPrimaryMembership(userId, groupId);
      return NextResponse.json({
        memberships: await listCommunityMembershipsForUser(userId),
      });
    }

    if (body.action === "theme") {
      const institutionId =
        body.institutionId ??
        (body.groupId
          ? (await listCommunities()).find((c) => c.groupId === body.groupId)?.institution.id
          : undefined);
      if (!institutionId) {
        return NextResponse.json({ error: "institutionId required." }, { status: 400 });
      }
      const community = await updateCommunityTheme({
        userId,
        institutionId,
        primaryColor: body.primaryColor ?? null,
      });
      return NextResponse.json({
        community,
        memberships: await listCommunityMembershipsForUser(userId),
      });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message = formatCommunityDbError(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
