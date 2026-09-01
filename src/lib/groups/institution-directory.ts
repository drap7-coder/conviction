import { isDatabaseConfigured, query } from "@/lib/db";
import {
  catalogGroupId,
  catalogInstitutionId,
  catalogSlug,
  findNcaaCatalogEntry,
  getCatalogOverride,
  listNcaaCatalog,
  searchNcaaSchools,
  type SchoolSuggestion,
} from "@/lib/groups/ncaa-catalog";
import { findSeedInstitutionById } from "@/lib/groups/seed-institutions";

/** Pre-live canonical schools — always seeded as active communities. */
export const LIVE_COMMUNITY_INSTITUTION_IDS = new Set([
  "institution-wm",
  "institution-rpi",
]);

export type InstitutionSearchSuggestion = SchoolSuggestion & {
  canonicalDomain: string | null;
  conference: string | null;
  communityEnabled: boolean;
  memberCount: number;
  statusLabel: string;
};

type DirectoryRow = {
  id: string;
  ncaa_id: string | null;
  community_enabled: boolean;
  conference: string | null;
  canonical_domain: string | null;
  member_count: string;
};

let directoryReady: Promise<void> | null = null;

function defaultDomain(ncaaId: string): string | null {
  return getCatalogOverride(ncaaId)?.canonicalDomain ?? null;
}

function defaultAccent(ncaaId: string): string | null {
  const override = getCatalogOverride(ncaaId);
  const seed = findSeedInstitutionById(catalogInstitutionId(ncaaId));
  return override?.accentColor ?? seed?.accentColor ?? null;
}

function isLiveCommunityInstitution(institutionId: string, ncaaId: string): boolean {
  return LIVE_COMMUNITY_INSTITUTION_IDS.has(institutionId);
}

export function institutionSearchStatusLabel(memberCount: number): string {
  if (memberCount === 1) return "1 Member";
  if (memberCount > 1) return `${memberCount} Members`;
  return "Be the first to represent";
}

export function enrichInstitutionSuggestions(
  suggestions: SchoolSuggestion[],
  rows: Map<string, DirectoryRow>,
): InstitutionSearchSuggestion[] {
  return suggestions.map((suggestion) => {
    const row = rows.get(suggestion.institutionId);
    const memberCount = row ? Number(row.member_count) : 0;
    const communityEnabled =
      row?.community_enabled ??
      isLiveCommunityInstitution(suggestion.institutionId, suggestion.ncaaId);
    return {
      ...suggestion,
      canonicalDomain: row?.canonical_domain ?? defaultDomain(suggestion.ncaaId),
      conference: row?.conference ?? null,
      communityEnabled,
      memberCount,
      statusLabel: institutionSearchStatusLabel(memberCount),
    };
  });
}

async function fetchDirectoryMeta(
  institutionIds: string[],
): Promise<Map<string, DirectoryRow>> {
  const map = new Map<string, DirectoryRow>();
  if (!isDatabaseConfigured() || institutionIds.length === 0) return map;

  const result = await query<DirectoryRow>(
    `select
       i.id,
       i.ncaa_id,
       i.community_enabled,
       i.conference,
       i.canonical_domain,
       coalesce(count(distinct m.user_id), 0)::text as member_count
     from institutions i
     left join groups g on g.institution_id = i.id
     left join user_group_memberships m on m.group_id = g.id
     where i.id = any($1::text[])
     group by i.id, i.ncaa_id, i.community_enabled, i.conference, i.canonical_domain`,
    [institutionIds],
  );

  for (const row of result.rows) {
    map.set(row.id, row);
  }
  return map;
}

/** Search the full canonical directory regardless of community activation state. */
export async function searchInstitutionDirectory(
  queryText: string,
  limit = 10,
): Promise<InstitutionSearchSuggestion[]> {
  const suggestions = searchNcaaSchools(queryText, limit);
  if (suggestions.length === 0) return [];

  await ensureNcaaInstitutionDirectory();

  const institutionIds = suggestions.map((row) => row.institutionId);
  const rows = await fetchDirectoryMeta(institutionIds);
  return enrichInstitutionSuggestions(suggestions, rows);
}

async function directoryRowCount(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const result = await query<{ count: string }>(
    `select count(*)::text as count from institutions where ncaa_id is not null`,
  );
  return Number(result.rows[0]?.count ?? 0);
}

/** Preload all NCAA catalog institutions — presence does not imply an active community. */
export async function ensureNcaaInstitutionDirectory(): Promise<void> {
  if (!isDatabaseConfigured()) return;

  if (!directoryReady) {
    directoryReady = (async () => {
      const existing = await directoryRowCount();
      if (existing >= listNcaaCatalog().length - 5) return;

      const catalog = listNcaaCatalog();
      const batchSize = 40;

      for (let offset = 0; offset < catalog.length; offset += batchSize) {
        const batch = catalog.slice(offset, offset + batchSize);
        const ids: string[] = [];
        const names: string[] = [];
        const slugs: string[] = [];
        const domains: (string | null)[] = [];
        const accents: (string | null)[] = [];
        const ncaaIds: string[] = [];
        const enabledFlags: boolean[] = [];

        for (const entry of batch) {
          const institutionId = catalogInstitutionId(entry.ncaaId);
          const slug = catalogSlug(entry.ncaaId);
          const seed = findSeedInstitutionById(institutionId);
          ids.push(institutionId);
          names.push(seed?.name ?? entry.name);
          slugs.push(slug);
          domains.push(defaultDomain(entry.ncaaId));
          accents.push(defaultAccent(entry.ncaaId));
          ncaaIds.push(entry.ncaaId);
          enabledFlags.push(isLiveCommunityInstitution(institutionId, entry.ncaaId));
        }

        await query(
          `insert into institutions (
             id, name, slug, type, canonical_domain, affiliation_status, accent_color,
             ncaa_id, conference, community_enabled
           )
           select *
           from unnest(
             $1::text[],
             $2::text[],
             $3::text[],
             $4::text[],
             $5::text[],
             $6::text[],
             $7::text[],
             $8::text[],
             $9::text[],
             $10::boolean[]
           ) as t(
             id, name, slug, type, canonical_domain, affiliation_status, accent_color,
             ncaa_id, conference, community_enabled
           )
           on conflict (id) do update set
             name = excluded.name,
             slug = excluded.slug,
             ncaa_id = coalesce(institutions.ncaa_id, excluded.ncaa_id),
             canonical_domain = coalesce(institutions.canonical_domain, excluded.canonical_domain),
             accent_color = coalesce(institutions.accent_color, excluded.accent_color),
             conference = coalesce(institutions.conference, excluded.conference)`,
          [
            ids,
            names,
            slugs,
            batch.map(() => "university"),
            domains,
            batch.map(() => "unofficial"),
            accents,
            ncaaIds,
            batch.map(() => null),
            enabledFlags,
          ],
        );
      }
    })().catch((error) => {
      directoryReady = null;
      throw error;
    });
  }

  await directoryReady;
}

/** Flip a directory school into an active community and ensure its canonical group row. */
export async function activateCommunityFromCatalog(ncaaId: string): Promise<{
  institutionId: string;
  groupId: string;
}> {
  const normalizedNcaaId = ncaaId.trim();
  const entry = findNcaaCatalogEntry(normalizedNcaaId);
  if (!entry) throw new Error("School not found in NCAA directory.");

  const override = getCatalogOverride(normalizedNcaaId);
  const institutionId = catalogInstitutionId(normalizedNcaaId);
  const groupId = catalogGroupId(normalizedNcaaId);
  const slug = catalogSlug(normalizedNcaaId);
  const seedInstitution = findSeedInstitutionById(institutionId);
  const name = seedInstitution?.name ?? entry.name;
  const domain = override?.canonicalDomain ?? seedInstitution?.canonicalDomain ?? null;
  const accent = override?.accentColor ?? seedInstitution?.accentColor ?? null;
  const inviteCode = override?.inviteCode ?? normalizedNcaaId;

  if (!isDatabaseConfigured()) {
    return { institutionId, groupId };
  }

  await ensureNcaaInstitutionDirectory();

  await query(
    `update institutions
     set community_enabled = true
     where id = $1`,
    [institutionId],
  );

  await query(
    `insert into institutions (
       id, name, slug, type, canonical_domain, affiliation_status, accent_color,
       ncaa_id, community_enabled
     ) values ($1, $2, $3, 'university', $4, 'unofficial', $5, $6, true)
     on conflict (id) do update set
       community_enabled = true,
       name = excluded.name,
       slug = excluded.slug,
       ncaa_id = coalesce(institutions.ncaa_id, excluded.ncaa_id),
       canonical_domain = coalesce(institutions.canonical_domain, excluded.canonical_domain),
       accent_color = coalesce(institutions.accent_color, excluded.accent_color)`,
    [institutionId, name, slug, domain, accent, normalizedNcaaId],
  );

  await query(
    `insert into groups (id, institution_id, name, type, primary_color, invite_code)
     values ($1, $2, $3, 'group', $4, $5)
     on conflict (id) do update set
       institution_id = excluded.institution_id,
       name = excluded.name,
       primary_color = coalesce(groups.primary_color, excluded.primary_color),
       invite_code = coalesce(groups.invite_code, excluded.invite_code)`,
    [groupId, institutionId, name, accent, inviteCode],
  );

  return { institutionId, groupId };
}
