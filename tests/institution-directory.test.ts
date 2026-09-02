import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  enrichInstitutionSuggestions,
  institutionSearchStatusLabel,
  LIVE_COMMUNITY_INSTITUTION_IDS,
} from "@/lib/groups/institution-directory";
import { searchNcaaSchools } from "@/lib/groups/ncaa-catalog";
import { listNcaaCatalog } from "@/lib/groups/ncaa-catalog";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("institution directory", () => {
  it("labels active campuses by member count and unactivated schools as first to represent", () => {
    expect(institutionSearchStatusLabel(14)).toBe("14 Members");
    expect(institutionSearchStatusLabel(1)).toBe("1 Member");
    expect(institutionSearchStatusLabel(0)).toBe("Be the first to represent");
  });

  it("enriches catalog search hits with directory metadata", () => {
    const hits = searchNcaaSchools("duke", 1);
    const enriched = enrichInstitutionSuggestions(hits, new Map());
    expect(enriched[0]?.statusLabel).toBe("Be the first to represent");
    expect(enriched[0]?.memberCount).toBe(0);
  });

  it("preloads the full NCAA catalog for directory seeding", () => {
    expect(listNcaaCatalog().length).toBeGreaterThan(1000);
    expect(LIVE_COMMUNITY_INSTITUTION_IDS.has("institution-wm")).toBe(true);
    expect(LIVE_COMMUNITY_INSTITUTION_IDS.has("institution-rpi")).toBe(true);
    expect(LIVE_COMMUNITY_INSTITUTION_IDS.size).toBe(15);
  });

  it("ships institutions search API and decoupled community_enabled migration", () => {
    expect(read("src/app/api/institutions/search/route.ts")).toContain("searchInstitutionDirectory");
    expect(read("migrations/012_institution_directory.sql")).toContain("community_enabled");
    expect(read("src/lib/groups/institution-directory.ts")).toContain("ensureNcaaInstitutionDirectory");
    expect(read("src/lib/groups/institution-directory.ts")).toContain("activateCommunityFromCatalog");
    expect(read("src/components/SchoolTypeahead.tsx")).toContain("school-suggestion-meta");
    expect(read("src/components/SchoolTypeahead.tsx")).toContain("/api/institutions/search");
    expect(read("src/lib/groups/types.ts")).toContain("communityEnabled");
  });
});
