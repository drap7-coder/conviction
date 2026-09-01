import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildStandingFromReturns, buildSeedCompetition } from "@/lib/groups/competitions";
import { averagesTied, isCompetitionPickWindowOpen } from "@/lib/groups/pick-window";
import { SEED_GROUPS, SEED_BOOK_GROUP_IDS } from "@/lib/groups/seed-groups";
import { SEED_INSTITUTIONS } from "@/lib/groups/seed-institutions";
import { loadCrowdSnapshot } from "@/lib/crowd/load";
import { listCrowdSeedBooks } from "@/lib/crowd/seed-books";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("group pick window", () => {
  it("is open Saturday and closed mid-week afternoon ET", () => {
    const saturday = new Date("2026-01-03T17:00:00Z");
    const wednesday = new Date("2026-01-07T18:00:00Z");
    expect(isCompetitionPickWindowOpen(saturday)).toBe(true);
    expect(isCompetitionPickWindowOpen(wednesday)).toBe(false);
  });

  it("detects tied averages within epsilon", () => {
    expect(averagesTied(1.2, 1.2)).toBe(true);
    expect(averagesTied(1.2, 1.204)).toBe(true);
    expect(averagesTied(1.2, 1.3)).toBe(false);
    expect(averagesTied(null, 1)).toBe(false);
  });
});

describe("institution hierarchy seeds", () => {
  it("seeds William & Mary as the canonical university institution", () => {
    expect(SEED_INSTITUTIONS).toHaveLength(1);
    const wm = SEED_INSTITUTIONS[0];
    expect(wm.slug).toBe("wm");
    expect(wm.canonicalDomain).toBe("wm.edu");
    expect(wm.affiliationStatus).toBe("unofficial");
    expect(SEED_GROUPS.every((group) => group.institutionId === wm.id)).toBe(true);
    expect(SEED_GROUPS.map((g) => g.name)).toEqual(
      expect.arrayContaining([
        "Class of 2028",
        "Finance Club",
        "Charlotte's Friends",
        "September Stock Challenge",
        "KKG Investment Competition",
      ]),
    );
  });
});

describe("competition standing averages", () => {
  it("averages active picks only and never zero-fills missing members", () => {
    const competition = buildSeedCompetition();
    const groupA = SEED_GROUPS.find((g) => g.id === "group-wm-finance")!;
    const groupB = SEED_GROUPS.find((g) => g.id === "group-wm-kkg")!;
    const standing = buildStandingFromReturns({
      competition,
      groupA,
      groupB,
      returnsA: [2, 1],
      returnsB: [],
    });
    expect(standing.groupA.pickCount).toBe(2);
    expect(standing.groupA.avgPctReturn).toBe(1.5);
    expect(standing.groupB.pickCount).toBe(0);
    expect(standing.groupB.avgPctReturn).toBeNull();
    expect(standing.leaderGroupId).toBe(groupA.id);
    expect(standing.isTie).toBe(false);
  });

  it("renders an explicit tie when averages match", () => {
    const competition = buildSeedCompetition();
    const standing = buildStandingFromReturns({
      competition,
      groupA: SEED_GROUPS.find((g) => g.id === "group-wm-finance")!,
      groupB: SEED_GROUPS.find((g) => g.id === "group-wm-kkg")!,
      returnsA: [1, 1],
      returnsB: [2, 0],
    });
    expect(standing.isTie).toBe(true);
    expect(standing.leaderGroupId).toBeNull();
  });
});

describe("Crowd group scoping", () => {
  it("attaches seed group ids and scopes Most Held to one W&M group", async () => {
    const books = listCrowdSeedBooks();
    expect(SEED_BOOK_GROUP_IDS["crowd-seed-01"]).toContain("group-wm-class-2028");
    const all = await loadCrowdSnapshot();
    const finance = await loadCrowdSnapshot("group-wm-finance");
    expect(finance.bookCount).toBeLessThan(all.bookCount);
    expect(finance.bookCount).toBeGreaterThan(0);
    expect(finance.held[0]?.holderCount).toBeLessThanOrEqual(finance.bookCount);
    void books;
  });
});

describe("groups schema + wiring", () => {
  it("ships institution migration, invite join, and Manage Groups surface", () => {
    expect(read("migrations/004_groups_competitions.sql")).toContain("user_group_memberships");
    expect(read("migrations/005_institutions.sql")).toContain("institutions");
    expect(read("migrations/005_institutions.sql")).toContain("wm.edu");
    expect(read("migrations/005_institutions.sql")).toContain("user_institution_memberships");
    expect(read("src/lib/db/migrate.ts")).toContain("schema_migrations");
    expect(read("src/app/api/admin/migrate/route.ts")).toContain("applyMigrations");
    expect(read("src/app/api/institutions/route.ts")).toContain("listInstitutions");
    expect(read("src/app/join/[code]/page.tsx")).toContain("JoinInviteClient");
    expect(read("src/components/ManageWorkspace.tsx")).toContain('id: "groups"');
    expect(read("src/components/CrowdBoard.tsx")).toContain("crowd-group-filter");
    expect(read("src/components/CrowdBoard.tsx")).toContain("CompetitionCard");
    expect(read("src/app/layout.tsx")).toContain("GroupAccentProvider");
    expect(read("src/app/globals.css")).toContain("--group-accent");
    expect(read("src/lib/auth-readiness.ts")).toContain("institutions");
    expect(read("src/lib/auth-readiness.ts")).toContain("user_institution_memberships");
  });
});
