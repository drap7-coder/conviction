import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { schoolInitials } from "@/components/crowd/SchoolLogo";
import { ESPN_TEAM_IDS, resolveEspnTeamId } from "@/lib/groups/espn-team-ids";
import { resolveNcaaDomain } from "@/lib/groups/ncaa-domains";

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

describe("ESPN + domain coverage", () => {
  it("resolves Kean and Rutgers to ESPN logo ids", () => {
    expect(resolveEspnTeamId("kean")).toBe("2871");
    expect(resolveEspnTeamId("rutgers")).toBe("164");
    expect(ESPN_TEAM_IDS.kean).toBe("2871");
  });

  it("passes numeric espn ids through and maps seeded schools", () => {
    expect(resolveEspnTeamId(164)).toBe("164");
    expect(resolveEspnTeamId("william-mary")).toBe("2729");
    expect(resolveEspnTeamId("rensselaer")).toBe("2528");
  });

  it("provides favicon domains for NJ schools without ESPN-only reliance", () => {
    expect(resolveNcaaDomain("kean")).toBe("kean.edu");
    expect(resolveNcaaDomain("rutgers")).toBe("rutgers.edu");
    expect(resolveNcaaDomain("stevens")).toBe("stevens.edu");
  });
});

describe("SchoolLogo Crowd wiring", () => {
  it("ships the reusable component with ESPN → favicon → badge fallback", () => {
    const source = read("src/components/crowd/SchoolLogo.tsx");
    expect(source).toContain("a.espncdn.com/i/teamlogos/ncaa/500/");
    expect(source).toContain("google.com/s2/favicons");
    expect(source).toContain("onError");
    expect(source).toContain("school-logo-badge");
    expect(source).toContain("resolveEspnTeamId");
  });

  it("renders school logos across Crowd and invite surfaces", () => {
    expect(read("src/components/CommunityPickCard.tsx")).toContain("SchoolLogo");
    expect(read("src/components/CrowdCommunityPanel.tsx")).toContain("SchoolLogo");
    expect(read("src/components/SchoolTypeahead.tsx")).toContain("SchoolLogo");
    expect(read("src/components/GroupPanels.tsx")).toContain("SchoolLogo");
    expect(read("src/components/HeadToHeadMatchCard.tsx")).toContain("SchoolLogo");
    expect(read("src/components/JoinInviteClient.tsx")).toContain("SchoolLogo");
  });

  it("uses LogoDisplay for community pick tickers like other boards", () => {
    const pickCard = read("src/components/CommunityPickCard.tsx");
    expect(pickCard).toContain('from "@/app/components/LogoDisplay"');
    expect(pickCard).toContain("<LogoDisplay");
    expect(pickCard).toContain("crowd-logo");
    expect(read("src/components/HeadToHeadMatchCard.tsx")).toContain("LogoDisplay");
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
