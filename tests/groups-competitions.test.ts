import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildStandingFromReturns, buildSeedCompetition } from "@/lib/groups/competitions";
import { averagesTied, isCompetitionPickWindowOpen } from "@/lib/groups/pick-window";
import { SEED_GROUPS, SEED_BOOK_GROUP_IDS } from "@/lib/groups/seed-groups";
import { loadCrowdSnapshot } from "@/lib/crowd/load";
import { listCrowdSeedBooks } from "@/lib/crowd/seed-books";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("group pick window", () => {
  it("is open Saturday and closed mid-week afternoon ET", () => {
    // Saturday 12:00 ET ≈ 17:00 UTC in winter (EST) — use fixed ISO with offset.
    const saturday = new Date("2026-01-03T17:00:00Z"); // Sat noon ET (EST)
    const wednesday = new Date("2026-01-07T18:00:00Z"); // Wed 13:00 ET
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

describe("competition standing averages", () => {
  it("averages active picks only and never zero-fills missing members", () => {
    const competition = buildSeedCompetition();
    const groupA = SEED_GROUPS[0];
    const groupB = SEED_GROUPS[1];
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
      groupA: SEED_GROUPS[0],
      groupB: SEED_GROUPS[1],
      returnsA: [1, 1],
      returnsB: [2, 0],
    });
    expect(standing.isTie).toBe(true);
    expect(standing.leaderGroupId).toBeNull();
  });
});

describe("Crowd group scoping", () => {
  it("attaches seed group ids and scopes Most Held to one school", async () => {
    const books = listCrowdSeedBooks();
    expect(SEED_BOOK_GROUP_IDS["crowd-seed-01"]).toContain("group-seed-wm");
    const all = await loadCrowdSnapshot();
    const wm = await loadCrowdSnapshot("group-seed-wm");
    expect(wm.bookCount).toBeLessThan(all.bookCount);
    expect(wm.bookCount).toBeGreaterThan(0);
    expect(wm.held[0]?.holderCount).toBeLessThanOrEqual(wm.bookCount);
    void books;
  });
});

describe("groups schema + wiring", () => {
  it("ships migration and Manage Groups surface", () => {
    expect(read("migrations/004_groups_competitions.sql")).toContain("user_group_memberships");
    expect(read("migrations/004_groups_competitions.sql")).toContain("competition_picks");
    expect(read("migrations/004_groups_competitions.sql")).toContain("is_primary");
    expect(read("src/components/ManageWorkspace.tsx")).toContain('id: "groups"');
    expect(read("src/components/CrowdBoard.tsx")).toContain("crowd-group-filter");
    expect(read("src/components/CrowdBoard.tsx")).toContain("CompetitionCard");
    expect(read("src/app/layout.tsx")).toContain("GroupAccentProvider");
    expect(read("src/app/globals.css")).toContain("--group-accent");
    expect(read("src/lib/auth-readiness.ts")).toContain("user_group_memberships");
  });
});
