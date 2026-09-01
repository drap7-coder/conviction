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
  it("seeds William & Mary as the only community (no club subgroups)", () => {
    expect(SEED_INSTITUTIONS).toHaveLength(1);
    const wm = SEED_INSTITUTIONS[0];
    expect(wm.slug).toBe("wm");
    expect(wm.canonicalDomain).toBe("wm.edu");
    expect(wm.affiliationStatus).toBe("unofficial");
    expect(SEED_GROUPS).toHaveLength(1);
    expect(SEED_GROUPS[0].id).toBe("group-wm");
    expect(SEED_GROUPS[0].name).toBe("William & Mary");
    expect(SEED_GROUPS[0].isCanonicalCommunity).toBe(true);
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
    expect(wm.bookCount).toBe(all.bookCount);
    expect(wm.bookCount).toBeGreaterThan(0);
  });
});

describe("communities schema + wiring", () => {
  it("ships one-community migrations and Manage Community surface", () => {
    expect(read("migrations/004_groups_competitions.sql")).toContain("user_group_memberships");
    expect(read("migrations/005_institutions.sql")).toContain("institutions");
    expect(read("migrations/005_institutions.sql")).toContain("group-wm");
    expect(read("migrations/006_one_community.sql")).toContain("group-wm");
    expect(read("migrations/006_one_community.sql")).toContain("Does NOT drop competitions");
    expect(read("src/app/api/groups/route.ts")).toContain("Communities are permanent");
    expect(read("src/app/api/groups/route.ts")).not.toContain('action === "create" &&');
    expect(read("src/components/ManageWorkspace.tsx")).toContain('label: "Community"');
    expect(read("src/components/CrowdBoard.tsx")).toContain("crowd-group-filter");
    expect(read("src/components/CrowdBoard.tsx")).not.toContain("CompetitionCard");
    expect(read("src/app/layout.tsx")).toContain("GroupAccentProvider");
    expect(read("src/app/globals.css")).toContain("--group-accent");
    expect(read("src/lib/auth-readiness.ts")).toContain("institutions");
    expect(read("src/app/join/[code]/page.tsx")).toContain("JoinInviteClient");
  });

  it("removes competition product modules while leaving schema dormant", () => {
    expect(() => read("src/lib/groups/competitions.ts")).toThrow();
    expect(() => read("src/lib/groups/pick-window.ts")).toThrow();
    expect(() => read("src/app/api/competitions/route.ts")).toThrow();
    expect(read("migrations/004_groups_competitions.sql")).toContain("competitions");
  });
});
