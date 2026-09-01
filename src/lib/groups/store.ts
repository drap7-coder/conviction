import { isDatabaseConfigured, query } from "@/lib/db";
import {
  SEED_GROUPS,
  findSeedGroupById,
  findSeedGroupByInviteCode,
  findSeedGroupByName,
  listSeedGroupsForInstitution,
} from "@/lib/groups/seed-groups";
import {
  SEED_INSTITUTIONS,
  findSeedInstitutionByDomain,
  findSeedInstitutionById,
  findSeedInstitutionBySlug,
} from "@/lib/groups/seed-institutions";
import type {
  AffiliationStatus,
  Group,
  Institution,
  InstitutionType,
  UserGroupMembership,
  UserInstitutionMembership,
} from "@/lib/groups/types";

type InstitutionRow = {
  id: string;
  name: string;
  slug: string;
  type: InstitutionType;
  canonical_domain: string | null;
  affiliation_status: AffiliationStatus;
  accent_color: string | null;
};

type GroupRow = {
  id: string;
  institution_id: string;
  name: string;
  invite_code: string | null;
  primary_color: string | null;
};

type MembershipRow = GroupRow & {
  membership_id: string;
  user_id: string;
  is_primary: boolean;
};

type InstitutionMembershipRow = InstitutionRow & {
  membership_id: string;
  user_id: string;
};

function mapInstitution(row: InstitutionRow): Institution {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    canonicalDomain: row.canonical_domain,
    affiliationStatus: row.affiliation_status,
    accentColor: row.accent_color,
  };
}

function mapGroup(row: GroupRow): Group {
  return {
    id: row.id,
    institutionId: row.institution_id,
    name: row.name,
    inviteCode: row.invite_code,
    primaryColor: row.primary_color,
  };
}

function normalizeHex(color: string | null | undefined): string | null {
  if (!color) return null;
  const trimmed = color.trim();
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

function slugifyInvite(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

export async function ensureSeedInstitutions(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  for (const institution of SEED_INSTITUTIONS) {
    await query(
      `insert into institutions (
         id, name, slug, type, canonical_domain, affiliation_status, accent_color
       ) values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (slug) do update set
         name = excluded.name,
         type = excluded.type,
         canonical_domain = excluded.canonical_domain,
         affiliation_status = excluded.affiliation_status,
         accent_color = excluded.accent_color`,
      [
        institution.id,
        institution.name,
        institution.slug,
        institution.type,
        institution.canonicalDomain,
        institution.affiliationStatus,
        institution.accentColor,
      ],
    );
  }
}

/** Ensure seed groups exist under their institutions (idempotent). */
export async function ensureSeedGroups(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await ensureSeedInstitutions();
  for (const group of SEED_GROUPS) {
    await query(
      `insert into groups (id, institution_id, name, type, primary_color, invite_code)
       values ($1, $2, $3, 'group', $4, $5)
       on conflict (id) do update set
         institution_id = excluded.institution_id,
         name = excluded.name,
         primary_color = excluded.primary_color,
         invite_code = coalesce(groups.invite_code, excluded.invite_code)`,
      [
        group.id,
        group.institutionId,
        group.name,
        group.primaryColor,
        group.inviteCode,
      ],
    );
  }
}

export async function listInstitutions(): Promise<Institution[]> {
  if (!isDatabaseConfigured()) return SEED_INSTITUTIONS.slice();
  try {
    const result = await query<InstitutionRow>(
      `select id, name, slug, type, canonical_domain, affiliation_status, accent_color
       from institutions
       order by name asc`,
    );
    const rows = result.rows.map(mapInstitution);
    const missing = SEED_INSTITUTIONS.filter(
      (seed) => !rows.some((row) => row.slug === seed.slug),
    );
    return [...rows, ...missing].sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return SEED_INSTITUTIONS.slice();
  }
}

export async function getInstitutionBySlug(slug: string): Promise<Institution | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  if (!isDatabaseConfigured()) return findSeedInstitutionBySlug(normalized);
  try {
    const result = await query<InstitutionRow>(
      `select id, name, slug, type, canonical_domain, affiliation_status, accent_color
       from institutions where slug = $1 limit 1`,
      [normalized],
    );
    if (result.rows[0]) return mapInstitution(result.rows[0]);
    return findSeedInstitutionBySlug(normalized);
  } catch {
    return findSeedInstitutionBySlug(normalized);
  }
}

export async function getInstitutionById(id: string): Promise<Institution | null> {
  if (!id) return null;
  if (!isDatabaseConfigured()) return findSeedInstitutionById(id);
  try {
    const result = await query<InstitutionRow>(
      `select id, name, slug, type, canonical_domain, affiliation_status, accent_color
       from institutions where id = $1 limit 1`,
      [id],
    );
    if (result.rows[0]) return mapInstitution(result.rows[0]);
    return findSeedInstitutionById(id);
  } catch {
    return findSeedInstitutionById(id);
  }
}

/** Resolve institution from an email domain (future .edu auto-associate). */
export async function findInstitutionByEmail(
  email: string | null | undefined,
): Promise<Institution | null> {
  if (!email || !email.includes("@")) return null;
  const domain = email.split("@").pop()?.trim().toLowerCase() ?? "";
  if (!domain) return null;
  if (!isDatabaseConfigured()) return findSeedInstitutionByDomain(domain);
  try {
    const result = await query<InstitutionRow>(
      `select id, name, slug, type, canonical_domain, affiliation_status, accent_color
       from institutions where lower(canonical_domain) = $1 limit 1`,
      [domain],
    );
    if (result.rows[0]) return mapInstitution(result.rows[0]);
    return findSeedInstitutionByDomain(domain);
  } catch {
    return findSeedInstitutionByDomain(domain);
  }
}

export async function listGroupsForInstitution(institutionId: string): Promise<Group[]> {
  if (!institutionId) return [];
  if (!isDatabaseConfigured()) return listSeedGroupsForInstitution(institutionId);
  try {
    const result = await query<GroupRow>(
      `select id, institution_id, name, invite_code, primary_color
       from groups
       where institution_id = $1
       order by name asc`,
      [institutionId],
    );
    const rows = result.rows.map(mapGroup);
    const missing = listSeedGroupsForInstitution(institutionId).filter(
      (seed) => !rows.some((row) => row.id === seed.id || row.name === seed.name),
    );
    return [...rows, ...missing].sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return listSeedGroupsForInstitution(institutionId);
  }
}

/** Groups that currently have ≥1 membership (active Crowd filter pool). */
export async function listActiveGroups(): Promise<Group[]> {
  if (!isDatabaseConfigured()) return SEED_GROUPS.slice();
  try {
    const result = await query<GroupRow>(
      `select g.id, g.institution_id, g.name, g.invite_code, g.primary_color
       from groups g
       where g.institution_id is not null
         and exists (
           select 1 from user_group_memberships m where m.group_id = g.id
         )
       order by g.name asc`,
    );
    if (result.rows.length > 0) return result.rows.map(mapGroup);
    return SEED_GROUPS.slice();
  } catch {
    return SEED_GROUPS.slice();
  }
}

export async function listAllGroups(): Promise<Group[]> {
  if (!isDatabaseConfigured()) return SEED_GROUPS.slice();
  try {
    const result = await query<GroupRow>(
      `select id, institution_id, name, invite_code, primary_color
       from groups
       where institution_id is not null
       order by name asc`,
    );
    const rows = result.rows.map(mapGroup);
    const missing = SEED_GROUPS.filter(
      (seed) => !rows.some((row) => row.id === seed.id || row.name === seed.name),
    );
    return [...rows, ...missing].sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return SEED_GROUPS.slice();
  }
}

export async function findGroupById(id: string): Promise<Group | null> {
  if (!id) return null;
  if (!isDatabaseConfigured()) return findSeedGroupById(id);
  try {
    const result = await query<GroupRow>(
      `select id, institution_id, name, invite_code, primary_color
       from groups where id = $1 limit 1`,
      [id],
    );
    if (result.rows[0]) return mapGroup(result.rows[0]);
    return findSeedGroupById(id);
  } catch {
    return findSeedGroupById(id);
  }
}

export async function findGroupByInviteCode(code: string): Promise<Group | null> {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;
  if (!isDatabaseConfigured()) return findSeedGroupByInviteCode(normalized);
  try {
    const result = await query<GroupRow>(
      `select id, institution_id, name, invite_code, primary_color
       from groups where lower(invite_code) = $1 limit 1`,
      [normalized],
    );
    if (result.rows[0]) return mapGroup(result.rows[0]);
    return findSeedGroupByInviteCode(normalized);
  } catch {
    return findSeedGroupByInviteCode(normalized);
  }
}

export async function createGroup(input: {
  institutionId: string;
  name: string;
  primaryColor?: string | null;
  createdBy?: string | null;
}): Promise<Group> {
  const name = input.name.trim();
  if (!name) throw new Error("Group name is required");
  const institution = await getInstitutionById(input.institutionId);
  if (!institution) throw new Error("Institution not found");
  const primaryColor = normalizeHex(input.primaryColor ?? null);

  if (!isDatabaseConfigured()) {
    const existing = findSeedGroupByName(name, institution.id);
    if (existing) return existing;
    return {
      id: `group-local-${Date.now()}`,
      institutionId: institution.id,
      name,
      inviteCode: `${institution.slug}-${slugifyInvite(name) || "group"}`,
      primaryColor,
    };
  }

  const existingRows = await query<GroupRow>(
    `select id, institution_id, name, invite_code, primary_color
     from groups
     where institution_id = $1 and name = $2
     limit 1`,
    [institution.id, name],
  );
  if (existingRows.rows[0]) return mapGroup(existingRows.rows[0]);

  let inviteCode = `${institution.slug}-${slugifyInvite(name) || "group"}`;
  const clash = await query<{ id: string }>(
    `select id from groups where lower(invite_code) = $1 limit 1`,
    [inviteCode],
  );
  if (clash.rows[0]) {
    inviteCode = `${inviteCode}-${Date.now().toString(36).slice(-4)}`;
  }

  const result = await query<GroupRow>(
    `insert into groups (institution_id, name, type, primary_color, invite_code, created_by)
     values ($1, $2, 'group', $3, $4, $5)
     returning id, institution_id, name, invite_code, primary_color`,
    [institution.id, name, primaryColor, inviteCode, input.createdBy ?? null],
  );
  return mapGroup(result.rows[0]);
}

export async function listInstitutionMembershipsForUser(
  userId: string,
): Promise<UserInstitutionMembership[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  try {
    const result = await query<InstitutionMembershipRow>(
      `select m.id as membership_id, m.user_id,
              i.id, i.name, i.slug, i.type, i.canonical_domain,
              i.affiliation_status, i.accent_color
       from user_institution_memberships m
       join institutions i on i.id = m.institution_id
       where m.user_id = $1
       order by i.name asc`,
      [userId],
    );
    return result.rows.map((row) => ({
      id: row.membership_id,
      userId: row.user_id,
      institutionId: row.id,
      institution: mapInstitution(row),
    }));
  } catch {
    return [];
  }
}

export async function addInstitutionMembership(input: {
  userId: string;
  institutionId: string;
}): Promise<UserInstitutionMembership[]> {
  if (!isDatabaseConfigured()) {
    throw new Error("Sign in with a connected database to save institutions.");
  }
  await query(
    `insert into user_institution_memberships (user_id, institution_id)
     values ($1, $2)
     on conflict (user_id, institution_id) do nothing`,
    [input.userId, input.institutionId],
  );
  return listInstitutionMembershipsForUser(input.userId);
}

export async function listMembershipsForUser(userId: string): Promise<UserGroupMembership[]> {
  if (!userId) return [];
  if (!isDatabaseConfigured()) return [];

  try {
    const result = await query<MembershipRow>(
      `select m.id as membership_id, m.user_id, m.is_primary,
              g.id, g.institution_id, g.name, g.invite_code, g.primary_color
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

  const group = await findGroupById(input.groupId);
  if (!group?.institutionId) throw new Error("Group not found");

  await addInstitutionMembership({
    userId: input.userId,
    institutionId: group.institutionId,
  });

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

/** Invite link path: associate institution + join group in one step. */
export async function joinByInviteCode(input: {
  userId: string;
  inviteCode: string;
  isPrimary?: boolean;
}): Promise<{ group: Group; institution: Institution; memberships: UserGroupMembership[] }> {
  const group = await findGroupByInviteCode(input.inviteCode);
  if (!group) throw new Error("Invite link not found.");
  const institution = await getInstitutionById(group.institutionId);
  if (!institution) throw new Error("Institution not found for this invite.");
  const memberships = await addMembership({
    userId: input.userId,
    groupId: group.id,
    isPrimary: input.isPrimary,
  });
  return { group, institution, memberships };
}

export async function removeMembership(
  userId: string,
  groupId: string,
): Promise<UserGroupMembership[]> {
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

export async function setPrimaryMembership(
  userId: string,
  groupId: string,
): Promise<UserGroupMembership[]> {
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

export async function updateGroupTheme(input: {
  userId: string;
  groupId: string;
  primaryColor: string | null;
}): Promise<Group> {
  const color = normalizeHex(input.primaryColor);
  if (!isDatabaseConfigured()) {
    const group = findSeedGroupById(input.groupId);
    if (!group) throw new Error("Group not found");
    return { ...group, primaryColor: color };
  }
  const memberships = await listMembershipsForUser(input.userId);
  if (!memberships.some((m) => m.groupId === input.groupId)) {
    throw new Error("Join the group before setting a theme.");
  }
  const result = await query<GroupRow>(
    `update groups set primary_color = $1
     where id = $2
     returning id, institution_id, name, invite_code, primary_color`,
    [color, input.groupId],
  );
  if (!result.rows[0]) throw new Error("Group not found");
  return mapGroup(result.rows[0]);
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
