import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { schoolInitials } from "@/components/crowd/SchoolLogo";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("schoolInitials", () => {
  it("keeps ampersand schools compact", () => {
    expect(schoolInitials("William & Mary")).toBe("W&M");
  });

  it("builds acronyms from significant words", () => {
    expect(schoolInitials("Rensselaer Polytechnic Institute")).toBe("RPI");
    expect(schoolInitials("University of Virginia")).toBe("UV");
    expect(schoolInitials("North Carolina State University")).toBe("NCS");
  });

  it("shortens single-token names", () => {
    expect(schoolInitials("NJIT")).toBe("NJI");
    expect(schoolInitials("")).toBe("?");
  });
});

describe("SchoolLogo Crowd wiring", () => {
  it("ships the reusable component with ESPN → favicon → badge fallback", () => {
    const source = read("src/components/crowd/SchoolLogo.tsx");
    expect(source).toContain("a.espncdn.com/i/teamlogos/ncaa/500/");
    expect(source).toContain("google.com/s2/favicons");
    expect(source).toContain("onError");
    expect(source).toContain("school-logo-badge");
  });

  it("renders logos on standings, community header, and school typeahead", () => {
    expect(read("src/components/CommunityPickCard.tsx")).toContain("SchoolLogo");
    expect(read("src/components/CrowdCommunityPanel.tsx")).toContain("SchoolLogo");
    expect(read("src/components/SchoolTypeahead.tsx")).toContain("SchoolLogo");
    expect(read("src/components/GroupPanels.tsx")).toContain("SchoolLogo");
  });

  it("exposes institution logo fields on community standings payloads", () => {
    const types = read("src/lib/community-picks/types.ts");
    expect(types).toContain("domain?:");
    expect(types).toContain("ncaaId?:");
    expect(types).toContain("accentColor?:");
    const store = read("src/lib/community-picks/store.ts");
    expect(store).toContain("canonical_domain");
    expect(store).toContain("ncaa_id");
  });
});
