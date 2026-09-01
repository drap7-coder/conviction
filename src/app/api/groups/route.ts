import { NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth-session";
import {
  addMembership,
  createGroup,
  listAllGroups,
  listMembershipsForUser,
  removeMembership,
  setPrimaryMembership,
  ensureSeedGroups,
} from "@/lib/groups/store";
import type { GroupType } from "@/lib/groups/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getOptionalSession();
  const userId = session?.user?.id ?? "";
  await ensureSeedGroups().catch(() => undefined);
  const [groups, memberships] = await Promise.all([
    listAllGroups(),
    userId ? listMembershipsForUser(userId) : Promise.resolve([]),
  ]);
  return NextResponse.json({
    authenticated: Boolean(userId),
    groups,
    memberships,
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
    action?: "join" | "leave" | "primary" | "create";
    groupId?: string;
    name?: string;
    type?: GroupType;
    primaryColor?: string | null;
    isPrimary?: boolean;
  } | null;

  if (!body?.action) {
    return NextResponse.json({ error: "Missing action." }, { status: 400 });
  }

  try {
    if (body.action === "create") {
      const type = body.type === "org" ? "org" : "school";
      const group = await createGroup({
        name: body.name ?? "",
        type,
        primaryColor: body.primaryColor,
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

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Group update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
