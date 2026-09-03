import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { parseCrowdView } from "@/components/CrowdBoard";
import { computeReturnPct, computeSideScore } from "@/lib/competitions/scores";
import { weekWindowContaining } from "@/lib/competitions/schedule";
import {
  DEFAULT_H2H_PERF_RANGE,
  h2hPerfRangeLabel,
  parseH2HPerfRange,
  periodReturnPct,
  pickPeriodReturnPct,
  resolvePickPeriodStart,
  seedRangeScale,
} from "@/lib/competitions/perf-range";
import { canonicalCompetitionSlug, pickDefaultH2HPair, RIVALRY_PAIRS } from "@/lib/competitions/store";
import type { CompetitionPick, HeadToHeadSchoolOption } from "@/lib/competitions/types";

const H2H_SCHOOLS: HeadToHeadSchoolOption[] = [
  { groupId: "group-wm", name: "William & Mary", primaryColor: "#115740" },
  { groupId: "group-rpi", name: "RPI", primaryColor: "#D6001C" },
  { groupId: "group-kean", name: "Kean", primaryColor: "#000000" },
];

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

describe("h2h performance ranges", () => {
  it("defaults to YTD and parses known windows", () => {
    expect(DEFAULT_H2H_PERF_RANGE).toBe("ytd");
    expect(parseH2HPerfRange(null)).toBe("ytd");
    expect(parseH2HPerfRange("bogus")).toBe("ytd");
    expect(parseH2HPerfRange("1d")).toBe("1d");
    expect(parseH2HPerfRange("1W")).toBe("1w");
    expect(parseH2HPerfRange("1m")).toBe("1m");
    expect(parseH2HPerfRange("ytd")).toBe("ytd");
    expect(seedRangeScale("1d")).toBeLessThan(seedRangeScale("ytd"));
    expect(h2hPerfRangeLabel("1d")).toBe("Today");
  });

  it("scores mid-window picks from entry and earlier picks from period open", () => {
    expect(periodReturnPct(100, 110)).toBe(10);
    expect(
      resolvePickPeriodStart({
        periodStartPrice: 90,
        periodStartAt: "2026-01-02T14:30:00.000Z",
        entryPrice: 100,
        pickedAt: "2026-03-01T15:00:00.000Z",
      }),
    ).toBe(100);
    expect(
      resolvePickPeriodStart({
        periodStartPrice: 90,
        periodStartAt: "2026-01-02T14:30:00.000Z",
        entryPrice: 100,
        pickedAt: "2025-12-15T15:00:00.000Z",
      }),
    ).toBe(90);
  });

  it("scores Today as the ticker session %, never from pick entry", () => {
    expect(
      pickPeriodReturnPct({
        range: "1d",
        entryPrice: 50,
        pickedAt: new Date().toISOString(),
        baseline: {
          startPrice: 100,
          startAt: null,
          currentPrice: 102,
          sessionReturnPct: 2,
        },
      }),
    ).toBe(2);
    expect(
      pickPeriodReturnPct({
        range: "1d",
        entryPrice: 50,
        pickedAt: new Date().toISOString(),
        baseline: {
          startPrice: 100,
          startAt: null,
          currentPrice: 103,
          sessionReturnPct: null,
        },
      }),
    ).toBe(3);
  });

  it("scores Weekly/Monthly/YTD as ticker period return, not pick entry", () => {
    // Same-day seed picks still use history open → last, not fabricated entry.
    expect(
      pickPeriodReturnPct({
        range: "1w",
        entryPrice: 50,
        pickedAt: new Date().toISOString(),
        baseline: {
          startPrice: 100,
          startAt: "2026-02-24T14:30:00.000Z",
          currentPrice: 110,
        },
      }),
    ).toBe(10);
    expect(
      pickPeriodReturnPct({
        range: "ytd",
        entryPrice: 200,
        pickedAt: new Date().toISOString(),
        baseline: {
          startPrice: 100,
          startAt: "2026-01-02T14:30:00.000Z",
          currentPrice: 120,
        },
      }),
    ).toBe(20);
  });

  it("scores Crowd H2H and standings on the same $100k window (no Performance chrome)", () => {
    expect(read("src/components/CrowdBoard.tsx")).not.toContain("PerfRangeSelect");
    expect(read("src/components/CrowdBoard.tsx")).not.toContain("crowd-chrome-bar");
    expect(read("src/components/CrowdBoard.tsx")).toContain("$100,000");
    expect(read("src/lib/community-picks/store.ts")).toContain("pickPeriodReturnPct");
    expect(read("src/lib/community-picks/store.ts")).toContain("fetchPeriodBaselines");
    expect(read("src/lib/competitions/store.ts")).toContain("pickPeriodReturnPct");
    expect(read("src/lib/competitions/store.ts")).toContain("fetchPeriodBaselines");
    expect(read("src/lib/community-picks/notional.ts")).toContain("PLAYER_BANKROLL_USD");
  });
});

describe("community picks wiring", () => {
  it("splits Standings / My Pick / My Community via Crowd SurfaceSlicer", () => {
    expect(parseCrowdView(null)).toBe("standings");
    expect(parseCrowdView("standings")).toBe("standings");
    expect(parseCrowdView("community")).toBe("community");
    expect(parseCrowdView("pick")).toBe("pick");
    expect(parseCrowdView("held")).toBe("standings");
    expect(parseCrowdView("watched")).toBe("standings");
    expect(read("src/components/CrowdBoard.tsx")).toContain('"standings"');
    expect(read("src/components/CrowdBoard.tsx")).toContain("crowd-standings-panel");
    expect(read("src/components/CrowdBoard.tsx").indexOf('label: "Standings"')).toBeLessThan(
      read("src/components/CrowdBoard.tsx").indexOf('label: "My Pick"'),
    );
    expect(read("src/components/CrowdBoard.tsx")).toContain("HeadToHeadMatchCard");
    expect(read("src/components/Portfolio.tsx")).not.toContain("CrowdAggregateBoard");
  });

  it("keeps weekly competition foundations available for Standings rivalry", () => {
    expect(RIVALRY_PAIRS[0]?.groupAId).toBe("group-wm");
    expect(RIVALRY_PAIRS[0]?.groupBId).toBe("group-rpi");
    expect(read("migrations/008_weekly_picks.sql")).toContain("return_pct");
    expect(read("migrations/008_weekly_picks.sql")).toContain("competition_picks_one_per_user_idx");
    expect(read("src/components/CrowdBoard.tsx")).toContain("CommunityPickCard");
    expect(read("src/components/CrowdBoard.tsx")).toContain("HeadToHeadMatchCard");
    expect(existsSync(new URL("../src/app/api/cron/competitions/route.ts", import.meta.url))).toBe(false);
    expect(read("src/lib/competitions/lifecycle.ts")).toContain("lockDueCompetitions");
  });

  it("ships continuous accumulation picks with banked growth and swap endpoint", () => {
    expect(read("migrations/013_continuous_pick_accumulation.sql")).toContain("banked_growth_factor");
    expect(read("src/lib/community-picks/store.ts")).toContain("swapCommunityPick");
    expect(read("src/lib/community-picks/store.ts")).toContain("createInitialCommunityPick");
    expect(read("src/components/CommunityPickCard.tsx")).toContain("Community standings");
    expect(read("src/components/CommunityPickCard.tsx")).toContain("Lifetime score");
    expect(read("src/app/api/picks/swap/route.ts")).toContain("validateTicker");
    expect(read("src/app/api/community-picks/route.ts")).toContain("createInitialCommunityPick");
  });

  it("lets head-to-head pick schools from dropdowns defaulting to the viewer school", () => {
    expect(pickDefaultH2HPair(H2H_SCHOOLS, "group-wm")).toEqual({
      groupAId: "group-wm",
      groupBId: "group-rpi",
    });
    expect(pickDefaultH2HPair(H2H_SCHOOLS, "group-kean")).toEqual({
      groupAId: "group-kean",
      groupBId: "group-wm",
    });
    expect(pickDefaultH2HPair(H2H_SCHOOLS, null)).toEqual({
      groupAId: "group-wm",
      groupBId: "group-rpi",
    });
    expect(canonicalCompetitionSlug("group-wm", "group-rpi")).toBe("wm-rpi");
    expect(canonicalCompetitionSlug("group-rpi", "group-wm")).toBe("wm-rpi");
    expect(canonicalCompetitionSlug("group-duke", "group-virginia")).toBe(
      canonicalCompetitionSlug("group-virginia", "group-duke"),
    );
    expect(read("src/lib/competitions/store.ts")).toContain("listHeadToHeadSchools");
    expect(read("src/lib/competitions/store.ts")).toContain("scoreCampusSide");
    expect(read("src/lib/competitions/store.ts")).toContain('statusLabel: "Live"');
    expect(read("src/lib/competitions/store.ts")).not.toContain("refreshCompetitionScores");
    expect(read("src/lib/competitions/types.ts")).toContain('kind: "member"');
    expect(read("src/lib/competitions/types.ts")).not.toContain("can_submit");
    expect(read("src/components/HeadToHeadMatchCard.tsx")).toContain("SchoolSideSelect");
    expect(read("src/components/HeadToHeadMatchCard.tsx")).toContain("Your side");
    expect(read("src/components/HeadToHeadMatchCard.tsx")).toContain("Opponent");
    expect(read("src/components/HeadToHeadMatchCard.tsx")).toContain("Update your My Pick");
    expect(read("src/components/HeadToHeadMatchCard.tsx")).not.toContain("Submit Pick");
    expect(read("src/components/HeadToHeadMatchCard.tsx")).not.toContain("Submit weekly");
    expect(read("src/components/HeadToHeadMatchCard.tsx")).not.toContain("this week");
    expect(read("src/components/CrowdBoard.tsx")).toContain("$100,000 book");
    expect(read("src/components/CrowdBoard.tsx")).not.toContain("Weekly rivalry");
    expect(read("src/app/api/cron/daily-sync/route.ts")).not.toContain("runCompetitionLifecycleTick");
    expect(read("src/app/globals.css")).toContain("h2h-school-select");
  });
});
