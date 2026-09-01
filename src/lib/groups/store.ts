import { isDatabaseConfigured, query } from "@/lib/db";
import { SEED_GROUPS, findSeedGroupByName } from "@/lib/groups/seed-groups";
import type { Group, GroupType, UserGroupMembership } from "@/lib/groups/types";

type GroupRow = {
  id: string;
  name: string;
  type: GroupType;
  primary_color: string | null;
};

type MembershipRow = GroupRow & {
  membership_id: string;
  user_id: string;
  is_primary: boolean;
};

function mapGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    primaryColor: row.primary_color,
  };
}

function normalizeHex(color: string | null | undefined): string | null {
  if (!color) return null;
  const trimmed = color.trim();
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

/** Groups that currently have ≥1 membership (active Crowd filter pool). */
export async function listActiveGroups(): Promise<Group[]> {
  if (!isDatabaseConfigured()) {
    return SEED_GROUPS.slice();
  }

  try {
    const result = await query<GroupRow>(
      `select g.id, g.name, g.type, g.primary_color
       from groups g
       where exists (
         select 1 from user_group_memberships m where m.group_id = g.id
       )
       order by g.name asc`,
    );
    if (result.rows.length > 0) return result.rows.map(mapGroup);
    // Fresh DB — surface seeds until members join.
    return SEED_GROUPS.slice();
  } catch {
    return SEED_GROUPS.slice();
  }
}

export async function listAllGroups(): Promise<Group[]> {
  if (!isDatabaseConfigured()) return SEED_GROUPS.slice();
  try {
    const result = await query<GroupRow>(
      `select id, name, type, primary_color from groups order by name asc`,
    );
    const rows = result.rows.map(mapGroup);
    const missing = SEED_GROUPS.filter((seed) => !rows.some((row) => row.name === seed.name));
    return [...rows, ...missing].sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return SEED_GROUPS.slice();
  }
}

export async function findGroupByName(name: string): Promise<Group | null> {
  if (!isDatabaseConfigured()) return findSeedGroupByName(name);
  try {
    const result = await query<GroupRow>(
      `select id, name, type, primary_color from groups where name = $1 limit 1`,
      [name],
    );
    if (result.rows[0]) return mapGroup(result.rows[0]);
    return findSeedGroupByName(name);
  } catch {
    return findSeedGroupByName(name);
  }
}

export async function createGroup(input: {
  name: string;
  type: GroupType;
  primaryColor?: string | null;
}): Promise<Group> {
  const name = input.name.trim();
  if (!name) throw new Error("Group name is required");
  const primaryColor = normalizeHex(input.primaryColor ?? null);

  if (!isDatabaseConfigured()) {
    const existing = findSeedGroupByName(name);
    if (existing) return existing;
    return {
      id: `group-local-${Date.now()}`,
      name,
      type: input.type,
      primaryColor,
    };
  }

  const existing = await findGroupByName(name);
  if (existing) return existing;

  const result = await query<GroupRow>(
    `insert into groups (name, type, primary_color)
     values ($1, $2, $3)
     on conflict (name) do update set name = excluded.name
     returning id, name, type, primary_color`,
    [name, input.type, primaryColor],
  );
  return mapGroup(result.rows[0]);
}

export async function listMembershipsForUser(userId: string): Promise<UserGroupMembership[]> {
  if (!userId) return [];
  if (!isDatabaseConfigured()) return [];

  try {
    const result = await query<MembershipRow>(
      `select m.id as membership_id, m.user_id, m.is_primary,
              g.id, g.name, g.type, g.primary_color
       from user_group_memberships m
       join groups g on g.id = m.group_id
       where m.user_id = $1
       order by m.is_primary desc, g.name asc`,
      [userId],
    );
    return result.rows.map((row) => ({
      id: row.membership_id,
      userId: row.user_id,
      groupId: row.id,
      isPrimary: row.is_primary,
      group: mapGroup(row),
    }));
  } catch {
    return [];
  }
}

export async function addMembership(input: {
  userId: string;
  groupId: string;
  isPrimary?: boolean;
}): Promise<UserGroupMembership[]> {
  if (!isDatabaseConfigured()) {
    throw new Error("Sign in with a connected database to save groups.");
  }

  const makePrimary = Boolean(input.isPrimary);
  if (makePrimary) {
    await query(
      `update user_group_memberships set is_primary = false where user_id = $1`,
      [input.userId],
    );
  }

  await query(
    `insert into user_group_memberships (user_id, group_id, is_primary)
     values ($1, $2, $3)
     on conflict (user_id, group_id) do update set is_primary = excluded.is_primary`,
    [input.userId, input.groupId, makePrimary],
  );

  // If this is the only membership, force primary.
  const memberships = await listMembershipsForUser(input.userId);
  if (memberships.length === 1 && !memberships[0].isPrimary) {
    await query(
      `update user_group_memberships set is_primary = true where id = $1`,
      [memberships[0].id],
    );
    return listMembershipsForUser(input.userId);
  }
  return memberships;
}

export async function removeMembership(userId: string, groupId: string): Promise<UserGroupMembership[]> {
  if (!isDatabaseConfigured()) return [];
  await query(
    `delete from user_group_memberships where user_id = $1 and group_id = $2`,
    [userId, groupId],
  );
  const remaining = await listMembershipsForUser(userId);
  if (remaining.length > 0 && !remaining.some((m) => m.isPrimary)) {
    await query(
      `update user_group_memberships set is_primary = true where id = $1`,
      [remaining[0].id],
    );
    return listMembershipsForUser(userId);
  }
  return remaining;
}

export async function setPrimaryMembership(userId: string, groupId: string): Promise<UserGroupMembership[]> {
  if (!isDatabaseConfigured()) return [];
  await query(
    `update user_group_memberships set is_primary = false where user_id = $1`,
    [userId],
  );
  await query(
    `update user_group_memberships
     set is_primary = true
     where user_id = $1 and group_id = $2`,
    [userId, groupId],
  );
  return listMembershipsForUser(userId);
}

/** User ids belonging to a group (for Crowd scoping). */
export async function listMemberUserIds(groupId: string): Promise<string[]> {
  if (!isDatabaseConfigured()) {
    const { SEED_BOOK_GROUP_IDS } = await import("@/lib/groups/seed-groups");
    return Object.entries(SEED_BOOK_GROUP_IDS)
      .filter(([, ids]) => ids.includes(groupId))
      .map(([bookId]) => bookId);
  }
  try {
    const result = await query<{ user_id: string }>(
      `select user_id from user_group_memberships where group_id = $1`,
      [groupId],
    );
    if (result.rows.length > 0) return result.rows.map((row) => row.user_id);
    // Fallback to seed book map when Neon has groups but no memberships yet.
    const { SEED_BOOK_GROUP_IDS } = await import("@/lib/groups/seed-groups");
    return Object.entries(SEED_BOOK_GROUP_IDS)
      .filter(([, ids]) => ids.includes(groupId))
      .map(([bookId]) => bookId);
  } catch {
    return [];
  }
}

export async function getPrimaryGroupForUser(userId: string): Promise<Group | null> {
  const memberships = await listMembershipsForUser(userId);
  return memberships.find((m) => m.isPrimary)?.group ?? memberships[0]?.group ?? null;
}

/** Ensure seed groups exist in Neon (idempotent). */
export async function ensureSeedGroups(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  for (const group of SEED_GROUPS) {
    await query(
      `insert into groups (id, name, type, primary_color)
       values ($1, $2, $3, $4)
       on conflict (name) do nothing`,
      [group.id, group.name, group.type, group.primaryColor],
    );
  }
}
