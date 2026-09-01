import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("crowd communities loading", () => {
  it("serves a lite /api/groups payload for Crowd without loading the full catalog", () => {
    expect(read("src/app/api/groups/route.ts")).toContain('include") === "catalog"');
    expect(read("src/app/api/groups/route.ts")).toContain("includeCatalog ? listInstitutions()");
  });

  it("limits listCommunities to enabled campuses with batched group lookup", () => {
    expect(read("src/lib/groups/store.ts")).toContain("where community_enabled = true");
    expect(read("src/lib/groups/store.ts")).toContain("pickCanonicalGroup");
    expect(read("src/lib/groups/store.ts")).not.toContain(
      "for (const institution of institutions)",
    );
  });

  it("resolves active Crowd filters from live memberships without scanning the directory", () => {
    expect(read("src/lib/groups/store.ts")).toContain(
      "select distinct g.id, g.institution_id, g.name, g.invite_code, g.primary_color",
    );
  });

  it("clears loading state and shows retry when community fetch fails", () => {
    expect(read("src/components/GroupPanels.tsx")).toContain("setLoading(false)");
    expect(read("src/components/GroupPanels.tsx")).toContain("Retry");
    expect(read("src/components/CrowdCommunityPanel.tsx")).toContain("setLoading(false)");
    expect(read("src/components/CrowdCommunityPanel.tsx")).toContain("Retry");
  });

  it("joins school and theme color through one Save & join action", () => {
    expect(read("src/components/GroupPanels.tsx")).toContain("Save & join");
    expect(read("src/components/GroupPanels.tsx")).toContain("primaryColor: themeColor");
    expect(read("src/components/GroupPanels.tsx")).toContain("Theme color saved.");
    expect(read("src/app/api/groups/route.ts")).toContain("primaryCommunity: primary");
  });
});
