import catalogJson from "@/lib/groups/data/ncaa-schools.json";
import {
  NCAA_CATALOG_OVERRIDES,
  type NcaaCatalogOverride,
} from "@/lib/groups/ncaa-catalog-overrides";

export type NcaaCatalogEntry = {
  ncaaId: string;
  name: string;
  shortName: string;
};

export type SchoolSuggestion = {
  ncaaId: string;
  name: string;
  slug: string;
  institutionId: string;
};

const CATALOG: NcaaCatalogEntry[] = catalogJson as NcaaCatalogEntry[];

const byNcaaId = new Map(CATALOG.map((entry) => [entry.ncaaId, entry]));

export function listNcaaCatalog(): NcaaCatalogEntry[] {
  return CATALOG;
}

export function findNcaaCatalogEntry(ncaaId: string): NcaaCatalogEntry | null {
  return byNcaaId.get(ncaaId.trim()) ?? null;
}

export function getCatalogOverride(ncaaId: string): NcaaCatalogOverride | null {
  return NCAA_CATALOG_OVERRIDES[ncaaId] ?? null;
}

export function catalogInstitutionId(ncaaId: string): string {
  return NCAA_CATALOG_OVERRIDES[ncaaId]?.institutionId ?? `institution-${ncaaId}`;
}

export function catalogGroupId(ncaaId: string): string {
  return NCAA_CATALOG_OVERRIDES[ncaaId]?.groupId ?? `group-${ncaaId}`;
}

export function catalogSlug(ncaaId: string): string {
  return NCAA_CATALOG_OVERRIDES[ncaaId]?.slug ?? ncaaId;
}

function haystack(entry: NcaaCatalogEntry): string {
  const override = NCAA_CATALOG_OVERRIDES[entry.ncaaId];
  return [
    entry.name,
    entry.shortName,
    entry.ncaaId,
    catalogSlug(entry.ncaaId),
    ...(override?.searchAliases ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

export function searchNcaaSchools(query: string, limit = 10): SchoolSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored = CATALOG.map((entry) => {
    const hay = haystack(entry);
    const short = entry.shortName.toLowerCase();
    const name = entry.name.toLowerCase();
    let score = 0;
    if (NCAA_CATALOG_OVERRIDES[entry.ncaaId]) score += 25;
    if (short === q) score += 200;
    if (name === q) score += 190;
    if (entry.name.toLowerCase().startsWith(q)) score += 100;
    if (short.startsWith(q)) score += 90;
    if (entry.ncaaId.startsWith(q)) score += 85;
    if (hay.includes(q)) score += 40;
    if (NCAA_CATALOG_OVERRIDES[entry.ncaaId] && score > 0) score += 150;
    return { entry, score };
  })
    .filter((row) => row.score > 0)
    .sort(
      (a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name),
    )
    .slice(0, limit);

  return scored.map(({ entry }) => ({
    ncaaId: entry.ncaaId,
    name: entry.name,
    slug: catalogSlug(entry.ncaaId),
    institutionId: catalogInstitutionId(entry.ncaaId),
  }));
}

export function findNcaaSchoolByInstitutionId(
  institutionId: string,
): SchoolSuggestion | null {
  for (const entry of CATALOG) {
    if (catalogInstitutionId(entry.ncaaId) === institutionId) {
      return {
        ncaaId: entry.ncaaId,
        name: entry.name,
        slug: catalogSlug(entry.ncaaId),
        institutionId,
      };
    }
  }
  return null;
}
