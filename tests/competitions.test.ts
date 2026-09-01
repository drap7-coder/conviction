import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseCrowdView } from "@/components/CrowdBoard";
import { computeReturnPct, computeSideScore } from "@/lib/competitions/scores";
import { weekWindowContaining } from "@/lib/competitions/schedule";
import { RIVALRY_PAIRS } from "@/lib/competitions/store";
import type { CompetitionPick } from "@/lib/competitions/types";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("competition scores", () => {
  it("computes percent return from start to current", () => {
    expect(computeReturnPct(100, 103.4)).toBe(3.4);
    expect(computeReturnPct(50, 47.5)).toBe(-5);
  });

  it("averages locked pick returns per group side", () => {
    const picks: CompetitionPick[] = [
      {
        id: "1",
        competitionId: "c1",
        userId: "u1",
        groupId: "group-wm",
        ticker: "NVDA",
        startPrice: 100,
        currentPrice: 110,
        finalPrice: null,
        returnPct: 10,
        submittedAt: "",
        lockedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "2",
        competitionId: "c1",
        userId: "u2",
        groupId: "group-wm",
        ticker: "AAPL",
        startPrice: 100,
        currentPrice: 105,
        finalPrice: null,
        returnPct: 5,
        submittedAt: "",
        lockedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "3",
        competitionId: "c1",
        userId: "u3",
        groupId: "group-rpi",
        ticker: "MSFT",
        startPrice: null,
        currentPrice: null,
        finalPrice: null,
        returnPct: null,
        submittedAt: "",
        lockedAt: null,
      },
    ];
    expect(computeSideScore(picks, "group-wm").avgReturnPct).toBe(7.5);
    expect(computeSideScore(picks, "group-rpi").avgReturnPct).toBeNull();
  });
});

describe("competition schedule", () => {
  it("builds Sun–Fri ET windows with Monday lock", () => {
    const window = weekWindowContaining(new Date("2026-09-01T16:00:00Z"));
    expect(window.weekKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(window.lockAt.getTime()).toBeGreaterThan(window.periodStart.getTime());
    expect(window.periodEnd.getTime()).toBeGreaterThan(window.lockAt.getTime());
  });
});

describe("community picks wiring", () => {
  it("splits Picks from held/watched via Crowd SurfaceSlicer", () => {
    expect(parseCrowdView(null)).toBe("rivalry");
    expect(parseCrowdView("held")).toBe("held");
    expect(parseCrowdView("watched")).toBe("watched");
    expect(read("src/components/CrowdBoard.tsx")).toContain('"rivalry"');
    expect(read("src/components/CrowdBoard.tsx")).toContain("crowd-rivalry-panel");
    expect(read("src/components/CrowdBoard.tsx")).toContain('label: "Picks"');
  });

  it("keeps weekly competition foundations dormant for a future mode", () => {
    expect(RIVALRY_PAIRS[0]?.groupAId).toBe("group-wm");
    expect(RIVALRY_PAIRS[0]?.groupBId).toBe("group-rpi");
    expect(read("migrations/008_weekly_picks.sql")).toContain("return_pct");
    expect(read("migrations/008_weekly_picks.sql")).toContain("competition_picks_one_per_user_idx");
    expect(read("src/components/CrowdBoard.tsx")).toContain("CommunityPickCard");
    expect(read("src/components/CrowdBoard.tsx")).not.toContain("HeadToHeadMatchCard");
    expect(read("src/app/api/cron/competitions/route.ts")).toContain("runCompetitionLifecycleTick");
    expect(read("src/lib/competitions/lifecycle.ts")).toContain("lockDueCompetitions");
  });

  it("ships one continuous pick per member and organization standings", () => {
    expect(read("migrations/010_community_picks.sql")).toContain("user_id text primary key");
    expect(read("src/lib/community-picks/store.ts")).toContain("on conflict (user_id) do update");
    expect(read("src/components/CommunityPickCard.tsx")).toContain("Community standings");
    expect(read("src/app/api/community-picks/route.ts")).toContain("validateTicker");
  });
});
