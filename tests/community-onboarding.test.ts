import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { searchNcaaSchools } from "@/lib/groups/ncaa-schools";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("NCAA school search", () => {
  it("finds live W&M and RPI by name or alias", () => {
    expect(searchNcaaSchools("william")[0]?.institutionId).toBe("institution-wm");
    expect(searchNcaaSchools("W&M")[0]?.institutionId).toBe("institution-wm");
    expect(searchNcaaSchools("rpi")[0]?.institutionId).toBe("institution-rpi");
    expect(searchNcaaSchools("Rensselaer")[0]?.institutionId).toBe("institution-rpi");
  });

  it("returns UVA as coming soon without institution id", () => {
    const uva = searchNcaaSchools("virginia").find((row) => row.ncaaId === "virginia");
    expect(uva?.live).toBe(false);
    expect(uva?.institutionId).toBeNull();
  });
});

describe("community onboarding wiring", () => {
  it("supports backdrop dismiss, NCAA search, and Manage Community panel", () => {
    expect(read("src/components/GroupPanels.tsx")).toContain("onClick={() => setOpen(false)}");
    expect(read("src/components/GroupPanels.tsx")).toContain("stopPropagation");
    expect(read("src/components/GroupPanels.tsx")).toContain("SchoolTypeahead");
    expect(read("src/components/GroupPanels.tsx")).toContain("onboarding");
    expect(read("src/components/GroupPanels.tsx")).toContain("Theme color");
    expect(read("src/app/api/schools/search/route.ts")).toContain("searchNcaaSchools");
    expect(read("src/components/ManageWorkspace.tsx")).toContain('label: "Community"');
    expect(read("src/app/layout.tsx")).toContain("GroupOnboardingPrompt");
  });

  it("join action accepts theme color in one step", () => {
    expect(read("src/app/api/groups/route.ts")).toContain("primaryColor: body.primaryColor");
  });
});
