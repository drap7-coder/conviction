import { isDatabaseConfigured, query } from "@/lib/db";
import {
  LEGACY_INVITE_ALIASES,
  SEED_GROUPS,
  findSeedGroupById,
  findSeedGroupByInviteCode,
  getCanonicalSeedGroupForInstitution,
  listSeedCanonicalCommunities,
} from "@/lib/groups/seed-groups";
import {
  findNcaaCatalogEntry,
  catalogGroupId,
  catalogInstitutionId,
  catalogSlug,
  getCatalogOverride,
} from "@/lib/groups/ncaa-catalog";
import {
  activateCommunityFromCatalog,
  ensureNcaaInstitutionDirectory,
} from "@/lib/groups/institution-directory";
import {
  SEED_INSTITUTIONS,
  findSeedInstitutionByDomain,
  findSeedInstitutionById,
  findSeedInstitutionBySlug,
} from "@/lib/groups/seed-institutions";
import type {
  AffiliationStatus,
  Community,
  Group,
  Institution,
  InstitutionType,
  UserCommunityMembership,
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
  ncaa_id: string | null;
  conference: string | null;
  community_enabled: boolean;
};

const INSTITUTION_COLUMNS = `
  id, name, slug, type, canonical_domain, affiliation_status, accent_color,
  ncaa_id, conference, community_enabled
`;

function mapInstitution(row: InstitutionRow): Institution {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    canonicalDomain: row.canonical_domain,
    affiliationStatus: row.affiliation_status,
    accentColor: row.accent_color,
    ncaaId: row.ncaa_id,
    conference: row.conference,
    communityEnabled: row.community_enabled,
  };
}

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

function mapGroup(row: GroupRow, isCanonical = false): Group {
  return {
    id: row.id,
    institutionId: row.institution_id,
    name: row.name,
    inviteCode: row.invite_code,
    primaryColor: row.primary_color,
    isCanonicalCommunity: isCanonical,
  };
}

function normalizeHex(color: string | null | undefined): string | null {
  if (!color) return null;
  const trimmed = color.trim();
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

function toCommunity(institution: Institution, group: Group): Community {
  return {
    institution,
    groupId: group.id,
    inviteCode: group.inviteCode,
    primaryColor: group.primaryColor ?? institution.accentColor,
  };
}

export async function ensureSeedInstitutions(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  for (const institution of SEED_INSTITUTIONS) {
    await query(
      `insert into institutions (
         id, name, slug, type, canonical_domain, affiliation_status, accent_color,
         ncaa_id, community_enabled
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (slug) do update set
         name = excluded.name,
         type = excluded.type,
         canonical_domain = excluded.canonical_domain,
         affiliation_status = excluded.affiliation_status,
         accent_color = excluded.accent_color,
         ncaa_id = coalesce(institutions.ncaa_id, excluded.ncaa_id),
         community_enabled = institutions.community_enabled or excluded.community_enabled`,
      [
        institution.id,
        institution.name,
        institution.slug,
        institution.type,
        institution.canonicalDomain,
        institution.affiliationStatus,
        institution.accentColor,
        institution.ncaaId,
        institution.communityEnabled,
      ],
    );
  }
}

/** Ensure the single canonical community group per institution exists. */
export async function ensureSeedGroups(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await ensureSeedInstitutions();
  for (const group of listSeedCanonicalCommunities()) {
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
      `select ${INSTITUTION_COLUMNS}
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
      `select ${INSTITUTION_COLUMNS}
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
      `select ${INSTITUTION_COLUMNS}
       from institutions where id = $1 limit 1`,
      [id],
    );
    if (result.rows[0]) return mapInstitution(result.rows[0]);
    return findSeedInstitutionById(id);
  } catch {
    return findSeedInstitutionById(id);
  }
}

export async function findInstitutionByEmail(
  email: string | null | undefined,
): Promise<Institution | null> {
  if (!email || !email.includes("@")) return null;
  const domain = email.split("@").pop()?.trim().toLowerCase() ?? "";
  if (!domain) return null;
  if (!isDatabaseConfigured()) return findSeedInstitutionByDomain(domain);
  try {
    const result = await query<InstitutionRow>(
      `select ${INSTITUTION_COLUMNS}
       from institutions where lower(canonical_domain) = $1 limit 1`,
      [domain],
    );
    if (result.rows[0]) return mapInstitution(result.rows[0]);
    return findSeedInstitutionByDomain(domain);
  } catch {
    return findSeedInstitutionByDomain(domain);
  }
}

export async function getCanonicalGroupForInstitution(
  institutionId: string,
): Promise<Group | null> {
  const seed = getCanonicalSeedGroupForInstitution(institutionId);
  if (!isDatabaseConfigured()) return seed;
  try {
    if (seed) {
      const byId = await query<GroupRow>(
        `select id, institution_id, name, invite_code, primary_color
         from groups where id = $1 limit 1`,
        [seed.id],
      );
      if (byId.rows[0]) return mapGroup(byId.rows[0], true);
    }
    // Prefer a group whose name matches the institution (one-community row).
    const institution = await getInstitutionById(institutionId);
    if (institution) {
      const byName = await query<GroupRow>(
        `select id, institution_id, name, invite_code, primary_color
         from groups
         where institution_id = $1 and name = $2
         order by created_at asc
         limit 1`,
        [institutionId, institution.name],
      );
      if (byName.rows[0]) return mapGroup(byName.rows[0], true);

      if (institutionId.startsWith("institution-")) {
        const derivedGroupId = `group-${institutionId.slice("institution-".length)}`;
        const byCatalogId = await query<GroupRow>(
          `select id, institution_id, name, invite_code, primary_color
           from groups where id = $1 limit 1`,
          [derivedGroupId],
        );
        if (byCatalogId.rows[0]) return mapGroup(byCatalogId.rows[0], true);
      }
    }
    return seed;
  } catch {
    return seed;
  }
}

export async function listCommunities(): Promise<Community[]> {
  const institutions = await listInstitutions();
  const communities: Community[] = [];
  for (const institution of institutions) {
    const group = await getCanonicalGroupForInstitution(institution.id);
    if (!group) continue;
    communities.push(toCommunity(institution, group));
  }
  return communities;
}

/** Active communities for Crowd filter (have ≥1 membership on the canonical group). */
export async function listActiveGroups(): Promise<Group[]> {
  const communities = await listCommunities();
  if (!isDatabaseConfigured()) {
    return communities.map((c) => ({
      id: c.groupId,
      institutionId: c.institution.id,
      name: c.institution.name,
      inviteCode: c.inviteCode,
      primaryColor: c.primaryColor,
      isCanonicalCommunity: true,
    }));
  }
  try {
    const ids = communities.map((c) => c.groupId);
    if (ids.length === 0) return [];
    const result = await query<{ group_id: string }>(
      `select distinct group_id from user_group_memberships where group_id = any($1::text[])`,
      [ids],
    );
    const live = new Set(result.rows.map((row) => row.group_id));
    // Surface all seed communities in guest/demo even before live memberships.
    const active = communities.filter((c) => live.has(c.groupId));
    const source = active.length > 0 ? active : communities;
    return source.map((c) => ({
      id: c.groupId,
      institutionId: c.institution.id,
      name: c.institution.name,
      inviteCode: c.inviteCode,
      primaryColor: c.primaryColor,
      isCanonicalCommunity: true,
    }));
  } catch {
    return SEED_GROUPS.slice();
  }
}

export async function findGroupById(id: string): Promise<Group | null> {
  if (!id) return null;
  const resolvedId = LEGACY_INVITE_ALIASES[id] ?? id;
  if (!isDatabaseConfigured()) return findSeedGroupById(resolvedId);
  try {
    const result = await query<GroupRow>(
      `select id, institution_id, name, invite_code, primary_color
       from groups where id = $1 limit 1`,
      [resolvedId],
    );
    if (result.rows[0]) {
      const seed = getCanonicalSeedGroupForInstitution(result.rows[0].institution_id);
      const isCanonical = seed?.id === result.rows[0].id;
      // Non-canonical subgroup rows are dormant — resolve to the community.
      if (!isCanonical && seed) return seed;
      return mapGroup(result.rows[0], Boolean(isCanonical));
    }
    return findSeedGroupById(resolvedId);
  } catch {
    return findSeedGroupById(resolvedId);
  }
}

export async function findGroupByInviteCode(code: string): Promise<Group | null> {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;
  const aliased = findSeedGroupByInviteCode(normalized);
  if (aliased) return aliased;

  if (!isDatabaseConfigured()) return null;
  try {
    const result = await query<GroupRow>(
      `select id, institution_id, name, invite_code, primary_color
       from groups where lower(invite_code) = $1 limit 1`,
      [normalized],
    );
    if (!result.rows[0]) return null;
    // Always return the canonical community for that institution.
    const canonical = await getCanonicalGroupForInstitution(result.rows[0].institution_id);
    return canonical ?? mapGroup(result.rows[0], false);
  } catch {
    return null;
  }
}

export async function listInstitutionMembershipsForUser(
  userId: string,
): Promise<UserInstitutionMembership[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  try {
    const result = await query<InstitutionMembershipRow>(
      `select m.id as membership_id, m.user_id,
              i.id, i.name, i.slug, i.type, i.canonical_domain,
              i.affiliation_status, i.accent_color, i.ncaa_id, i.conference, i.community_enabled
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
    throw new Error("Sign in with a connected database to save communities.");
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
    // Collapse any legacy subgroup memberships into the canonical community.
    const byInstitution = new Map<string, UserGroupMembership>();
    for (const row of result.rows) {
      const canonical = await getCanonicalGroupForInstitution(row.institution_id);
      const group = canonical ?? mapGroup(row, false);
      const existing = byInstitution.get(group.institutionId);
      const next: UserGroupMembership = {
        id: row.membership_id,
        userId: row.user_id,
        groupId: group.id,
        isPrimary: row.is_primary || Boolean(existing?.isPrimary),
        group,
      };
      if (!existing || next.isPrimary) byInstitution.set(group.institutionId, next);
    }
    return [...byInstitution.values()].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return a.group.name.localeCompare(b.group.name);
    });
  } catch {
    return [];
  }
}

export async function listCommunityMembershipsForUser(
  userId: string,
): Promise<UserCommunityMembership[]> {
  const [groupMemberships, institutionMemberships] = await Promise.all([
    listMembershipsForUser(userId),
    listInstitutionMembershipsForUser(userId),
  ]);

  const byInstitution = new Map<string, UserCommunityMembership>();

  for (const membership of institutionMemberships) {
    const group = await getCanonicalGroupForInstitution(membership.institutionId);
    if (!group) continue;
    byInstitution.set(membership.institutionId, {
      institutionId: membership.institutionId,
      groupId: group.id,
      institution: membership.institution,
      primaryColor: group.primaryColor ?? membership.institution.accentColor,
      isPrimary: false,
    });
  }

  for (const membership of groupMemberships) {
    const institution =
      byInstitution.get(membership.group.institutionId)?.institution ??
      (await getInstitutionById(membership.group.institutionId));
    if (!institution) continue;
    byInstitution.set(membership.group.institutionId, {
      institutionId: institution.id,
      groupId: membership.groupId,
      institution,
      primaryColor: membership.group.primaryColor ?? institution.accentColor,
      isPrimary: membership.isPrimary,
    });
  }

  const list = [...byInstitution.values()];
  if (list.length === 1) list[0].isPrimary = true;
  return list.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.institution.name.localeCompare(b.institution.name);
  });
}

export async function addMembership(input: {
  userId: string;
  groupId: string;
  isPrimary?: boolean;
}): Promise<UserGroupMembership[]> {
  if (!isDatabaseConfigured()) {
    throw new Error("Sign in with a connected database to save communities.");
  }

  const group = await findGroupById(input.groupId);
  if (!group?.institutionId) throw new Error("Community not found");
  const canonical = await getCanonicalGroupForInstitution(group.institutionId);
  if (!canonical) throw new Error("Community not found");

  await addInstitutionMembership({
    userId: input.userId,
    institutionId: canonical.institutionId,
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
    [input.userId, canonical.id, makePrimary],
  );

  const memberships = await listMembershipsForUser(input.userId);
  if (memberships.length === 1 && !memberships[0].isPrimary) {
    await query(
      `update user_group_memberships set is_primary = true
       where user_id = $1 and group_id = $2`,
      [input.userId, canonical.id],
    );
    return listMembershipsForUser(input.userId);
  }
  return memberships;
}

/** Invite / join: associate institution + canonical community membership. */
export async function joinByInviteCode(input: {
  userId: string;
  inviteCode: string;
  isPrimary?: boolean;
}): Promise<{
  community: Community;
  group: Group;
  institution: Institution;
  memberships: UserGroupMembership[];
}> {
  const group = await findGroupByInviteCode(input.inviteCode);
  if (!group) throw new Error("Invite link not found.");
  const institution = await getInstitutionById(group.institutionId);
  if (!institution) throw new Error("Community not found for this invite.");
  const memberships = await addMembership({
    userId: input.userId,
    groupId: group.id,
    isPrimary: input.isPrimary,
  });
  return {
    community: toCommunity(institution, group),
    group,
    institution,
    memberships,
  };
}

/** Activate directory school + ensure canonical group on join (no user-created schools). */
export async function provisionInstitutionFromCatalog(ncaaId: string): Promise<{
  institution: Institution;
  group: Group;
}> {
  const normalizedNcaaId = ncaaId.trim();
  const entry = findNcaaCatalogEntry(normalizedNcaaId);
  if (!entry) throw new Error("School not found in NCAA directory.");

  const override = getCatalogOverride(normalizedNcaaId);
  const institutionId = catalogInstitutionId(normalizedNcaaId);
  const groupId = catalogGroupId(normalizedNcaaId);
  const slug = catalogSlug(normalizedNcaaId);
  const seedInstitution = findSeedInstitutionById(institutionId);

  const institution: Institution = {
    id: institutionId,
    name: seedInstitution?.name ?? entry.name,
    slug,
    type: "university",
    canonicalDomain: override?.canonicalDomain ?? seedInstitution?.canonicalDomain ?? null,
    affiliationStatus: "unofficial",
    accentColor: override?.accentColor ?? seedInstitution?.accentColor ?? null,
    ncaaId: normalizedNcaaId,
    conference: null,
    communityEnabled: true,
  };

  const group: Group = {
    id: groupId,
    institutionId,
    name: institution.name,
    inviteCode: override?.inviteCode ?? normalizedNcaaId,
    primaryColor: institution.accentColor,
    isCanonicalCommunity: true,
  };

  if (!isDatabaseConfigured()) {
    return { institution, group };
  }

  await activateCommunityFromCatalog(normalizedNcaaId);
  const loadedInstitution = await getInstitutionById(institutionId);
  const loadedGroup = await findGroupById(groupId);
  if (!loadedInstitution || !loadedGroup) {
    throw new Error("Community not found after activation.");
  }
  return { institution: loadedInstitution, group: loadedGroup };
}

export async function joinCommunity(input: {
  userId: string;
  institutionId?: string;
  ncaaId?: string;
  isPrimary?: boolean;
}): Promise<UserGroupMembership[]> {
  let institutionId = input.institutionId?.trim() ?? "";

  if (!institutionId && input.ncaaId?.trim()) {
    const provisioned = await provisionInstitutionFromCatalog(input.ncaaId);
    institutionId = provisioned.institution.id;
  }

  if (!institutionId) throw new Error("School required.");

  const group = await getCanonicalGroupForInstitution(institutionId);
  if (!group) throw new Error("Community not found");
  return addMembership({
    userId: input.userId,
    groupId: group.id,
    isPrimary: input.isPrimary,
  });
}

export async function removeMembership(
  userId: string,
  groupId: string,
): Promise<UserGroupMembership[]> {
  if (!isDatabaseConfigured()) return [];
  const group = await findGroupById(groupId);
  const canonicalId = group?.id ?? groupId;

  await query(
    `delete from user_group_memberships where user_id = $1 and group_id = $2`,
    [userId, canonicalId],
  );

  // Also drop dormant subgroup memberships for the same institution.
  if (group?.institutionId) {
    await query(
      `delete from user_group_memberships m
       using groups g
       where m.group_id = g.id
         and m.user_id = $1
         and g.institution_id = $2`,
      [userId, group.institutionId],
    );
    await query(
      `delete from user_institution_memberships
       where user_id = $1 and institution_id = $2`,
      [userId, group.institutionId],
    );
  }

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
  const group = await findGroupById(groupId);
  const canonicalId = group?.id ?? groupId;
  await query(
    `update user_group_memberships set is_primary = false where user_id = $1`,
    [userId],
  );
  await query(
    `update user_group_memberships
     set is_primary = true
     where user_id = $1 and group_id = $2`,
    [userId, canonicalId],
  );
  return listMembershipsForUser(userId);
}

export async function updateCommunityTheme(input: {
  userId: string;
  institutionId: string;
  primaryColor: string | null;
}): Promise<Community> {
  const color = normalizeHex(input.primaryColor);
  const group = await getCanonicalGroupForInstitution(input.institutionId);
  const institution = await getInstitutionById(input.institutionId);
  if (!group || !institution) throw new Error("Community not found");

  if (!isDatabaseConfigured()) {
    return toCommunity(institution, { ...group, primaryColor: color });
  }

  const memberships = await listMembershipsForUser(input.userId);
  if (!memberships.some((m) => m.group.institutionId === input.institutionId)) {
    throw new Error("Join the community before setting a theme.");
  }

  await query(`update groups set primary_color = $1 where id = $2`, [color, group.id]);
  await query(`update institutions set accent_color = $1 where id = $2`, [
    color,
    institution.id,
  ]);

  return toCommunity(
    { ...institution, accentColor: color },
    { ...group, primaryColor: color },
  );
}

/** User ids belonging to a community group (for Crowd scoping). */
export async function listMemberUserIds(groupId: string): Promise<string[]> {
  const resolved = await findGroupById(groupId);
  const canonicalId = resolved?.id ?? groupId;

  if (!isDatabaseConfigured()) {
    const { SEED_BOOK_GROUP_IDS } = await import("@/lib/groups/seed-groups");
    return Object.entries(SEED_BOOK_GROUP_IDS)
      .filter(([, ids]) => ids.includes(canonicalId))
      .map(([bookId]) => bookId);
  }
  try {
    const result = await query<{ user_id: string }>(
      `select user_id from user_group_memberships where group_id = $1`,
      [canonicalId],
    );
    if (result.rows.length > 0) return result.rows.map((row) => row.user_id);
    const { SEED_BOOK_GROUP_IDS } = await import("@/lib/groups/seed-groups");
    return Object.entries(SEED_BOOK_GROUP_IDS)
      .filter(([, ids]) => ids.includes(canonicalId))
      .map(([bookId]) => bookId);
  } catch {
    return [];
  }
}

export async function getPrimaryGroupForUser(userId: string): Promise<Group | null> {
  const memberships = await listMembershipsForUser(userId);
  return memberships.find((m) => m.isPrimary)?.group ?? memberships[0]?.group ?? null;
}
