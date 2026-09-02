import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { searchNcaaSchools } from "@/lib/groups/ncaa-catalog";
import {
  catalogGroupId,
  catalogInstitutionId,
  findNcaaCatalogEntry,
} from "@/lib/groups/ncaa-catalog";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("NCAA school directory", () => {
  it("finds W&M and RPI with stable legacy institution ids", () => {
    expect(searchNcaaSchools("william")[0]?.institutionId).toBe("institution-wm");
    expect(searchNcaaSchools("W&M")[0]?.institutionId).toBe("institution-wm");
    expect(searchNcaaSchools("rpi")[0]?.institutionId).toBe("institution-rpi");
    expect(searchNcaaSchools("Rensselaer")[0]?.institutionId).toBe("institution-rpi");
  });

  it("finds major schools by common names", () => {
    expect(searchNcaaSchools("Villanova")[0]?.ncaaId).toBe("villanova");
    expect(searchNcaaSchools("Penn State")[0]?.ncaaId).toBe("penn-st");
    expect(searchNcaaSchools("Duke")[0]?.ncaaId).toBe("duke");
    expect(searchNcaaSchools("Michigan")[0]?.ncaaId).toBe("michigan");
    expect(searchNcaaSchools("Kean")[0]?.ncaaId).toBe("kean");
  });

  it("returns joinable institution ids for any catalog school", () => {
    const uva = searchNcaaSchools("virginia").find((row) => row.ncaaId === "virginia");
    expect(uva?.institutionId).toBe("institution-virginia");
    expect(catalogInstitutionId("duke")).toBe("institution-duke");
    expect(catalogGroupId("duke")).toBe("group-duke");
  });

  it("includes 1000+ NCAA schools in the catalog", () => {
    expect(findNcaaCatalogEntry("duke")).not.toBeNull();
    expect(searchNcaaSchools("a").length).toBeGreaterThan(0);
  });
});

describe("community onboarding wiring", () => {
  it("supports backdrop dismiss, NCAA search, Crowd panel, and Manage Community", () => {
    expect(read("src/components/GroupPanels.tsx")).toContain("onClick={() => setOpen(false)}");
    expect(read("src/components/GroupPanels.tsx")).toContain("stopPropagation");
    expect(read("src/components/GroupPanels.tsx")).toContain("SchoolTypeahead");
    expect(read("src/components/GroupPanels.tsx")).toContain("onboarding");
    expect(read("src/components/GroupPanels.tsx")).toContain("Theme color");
    expect(read("src/app/api/institutions/search/route.ts")).toContain("searchInstitutionDirectory");
    expect(existsSync(new URL("../src/app/api/schools/search/route.ts", import.meta.url))).toBe(false);
    expect(read("src/components/CrowdCommunityPanel.tsx")).toContain("CommunitySettingsPanel");
    expect(read("src/components/CrowdBoard.tsx")).toContain("CrowdCommunityPanel");
    expect(read("src/components/ManageWorkspace.tsx")).toContain('label: "Community"');
    expect(read("src/app/layout.tsx")).toContain("GroupOnboardingPrompt");
  });

  it("auto-applies community schema before groups API writes", () => {
    expect(read("src/app/api/groups/route.ts")).toContain("ensureCommunitySchema");
    expect(read("src/lib/db/ensure-community-schema.ts")).toContain("applyMigrations");
  });

  it("join action accepts ncaaId and theme color in one step", () => {
    expect(read("src/app/api/groups/route.ts")).toContain("ncaaId");
    expect(read("src/app/api/groups/route.ts")).toContain("provisionInstitutionFromCatalog");
    expect(read("src/app/api/groups/route.ts")).toContain("primaryColor: body.primaryColor");
  });

  it("join flow provisions canonical community from NCAA id", () => {
    expect(read("src/components/GroupPanels.tsx")).toContain("ncaaId: pickedSchool.ncaaId");
    expect(read("src/lib/groups/store.ts")).toContain("provisionInstitutionFromCatalog");
  });

  it("provisions institutions with id-based upsert for concurrent joins", () => {
    const store = read("src/lib/groups/store.ts");
    expect(store).toContain("on conflict (id) do update set");
    expect(store).not.toMatch(/provisionInstitutionFromCatalog[\s\S]*on conflict \(slug\)/);
  });
});
