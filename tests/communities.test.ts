import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  LEGACY_INVITE_ALIASES,
  SEED_GROUPS,
  SEED_BOOK_GROUP_IDS,
  findSeedGroupByInviteCode,
} from "@/lib/groups/seed-groups";
import { SEED_INSTITUTIONS } from "@/lib/groups/seed-institutions";
import { loadCrowdSnapshot } from "@/lib/crowd/load";
import { listCrowdSeedBooks } from "@/lib/crowd/seed-books";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("one-community seeds", () => {
  it("seeds one group per school with no club subgroups", () => {
    expect(SEED_INSTITUTIONS).toHaveLength(15);
    const wm = SEED_INSTITUTIONS.find((row) => row.slug === "wm");
    const rpi = SEED_INSTITUTIONS.find((row) => row.slug === "rpi");
    expect(wm?.canonicalDomain).toBe("wm.edu");
    expect(rpi?.canonicalDomain).toBe("rpi.edu");
    expect(rpi?.affiliationStatus).toBe("unofficial");
    expect(SEED_GROUPS).toHaveLength(SEED_INSTITUTIONS.length);
    expect(SEED_GROUPS.find((g) => g.id === "group-wm")?.isCanonicalCommunity).toBe(true);
    expect(SEED_GROUPS.find((g) => g.id === "group-rpi")?.inviteCode).toBe("rpi");
    expect(SEED_GROUPS.map((g) => g.name).join(",")).not.toMatch(/Finance Club|Class of 2028/);
  });

  it("routes legacy club invite codes to the W&M community", () => {
    expect(findSeedGroupByInviteCode("wm-finance")?.id).toBe("group-wm");
    expect(findSeedGroupByInviteCode("wm-2028")?.id).toBe("group-wm");
    expect(findSeedGroupByInviteCode("wm")?.id).toBe("group-wm");
    expect(LEGACY_INVITE_ALIASES["wm-kkg"]).toBe("group-wm");
  });
});

describe("Crowd community scoping", () => {
  it("attaches seed community ids and can scope Most Held", async () => {
    void listCrowdSeedBooks();
    expect(SEED_BOOK_GROUP_IDS["crowd-seed-01"]).toContain("group-wm");
    const all = await loadCrowdSnapshot();
    const wm = await loadCrowdSnapshot("group-wm");
    const rpi = await loadCrowdSnapshot("group-rpi");
    expect(wm.bookCount).toBeLessThan(all.bookCount);
    expect(rpi.bookCount).toBeLessThan(all.bookCount);
    expect(wm.bookCount + rpi.bookCount).toBeGreaterThan(wm.bookCount);
  });
});

describe("communities schema + wiring", () => {
  it("ships one-community migrations and Manage Community surface", () => {
    expect(read("migrations/004_groups_competitions.sql")).toContain("user_group_memberships");
    expect(read("migrations/005_institutions.sql")).toContain("institutions");
    expect(read("migrations/005_institutions.sql")).toContain("group-wm");
    expect(read("migrations/006_one_community.sql")).toContain("group-wm");
    expect(read("migrations/006_one_community.sql")).toContain("Does NOT drop competitions");
    expect(read("migrations/007_seed_rpi.sql")).toContain("institution-rpi");
    expect(read("migrations/007_seed_rpi.sql")).toContain("group-rpi");
    expect(read("src/app/api/groups/route.ts")).toContain("Communities are permanent");
    expect(read("src/app/api/groups/route.ts")).not.toContain('action === "create" &&');
    expect(read("src/components/ManageWorkspace.tsx")).toContain('label: "Community"');
    expect(read("src/components/CrowdBoard.tsx")).toContain("CrowdCommunityPanel");
    expect(read("src/components/Portfolio.tsx")).toContain("CrowdAggregateBoard");
    expect(read("src/components/CrowdAggregateBoard.tsx")).toContain("crowd-group-filter");
    expect(read("src/components/CrowdBoard.tsx")).toContain("CommunityPickCard");
    expect(read("src/app/layout.tsx")).toContain("GroupAccentProvider");
    expect(read("src/app/globals.css")).toContain("--group-accent");
    expect(read("src/lib/auth-readiness.ts")).toContain("institutions");
    expect(read("src/app/join/[code]/page.tsx")).toContain("JoinInviteClient");
  });

  it("keeps weekly head-to-head foundations while Crowd uses continuous picks", () => {
    expect(read("src/lib/competitions/store.ts")).toContain("RIVALRY_PAIRS");
    expect(read("src/app/api/competitions/active/route.ts")).toContain("buildHeadToHeadPayload");
    expect(read("migrations/004_groups_competitions.sql")).toContain("competitions");
    expect(read("migrations/008_weekly_picks.sql")).toContain("locked_at");
    expect(read("migrations/010_community_picks.sql")).toContain("community_picks");
  });
});
