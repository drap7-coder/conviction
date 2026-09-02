import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { MIN_RANKED_MEMBERS } from "@/lib/community-picks/constants";
import {
  CAMPUS_SEED_STUDENTS_PER_SCHOOL,
  listCampusSeedStudents,
  seedCampusStandings,
} from "@/lib/community-picks/seed-students";
import {
  activeGrowthFactor,
  activeReturnPct,
  averageLifetimeReturnPct,
  lifetimeReturnPct,
  pickGrowthFactor,
  pickReturnPct,
  totalGrowthFactor,
} from "@/lib/community-picks/growth";
import { spotFromQuote } from "@/lib/community-picks/pricing";
import type { StockQuote } from "@/lib/market/quotes";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function quote(ticker: string, price: number): StockQuote {
  return {
    ticker,
    name: ticker,
    exchange: "NASDAQ",
    price,
    previousClose: price,
    change: 0,
    changePercent: 0,
    volume: null,
    dollarVolume: null,
    currency: "USD",
    marketState: "REGULAR",
    marketCap: null,
    dayHigh: null,
    dayLow: null,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    preMarketPrice: null,
    preMarketChange: null,
    preMarketChangePercent: null,
    postMarketPrice: null,
    postMarketChange: null,
    postMarketChangePercent: null,
    source: "yahoo-chart",
    asOf: null,
    sparkline: [],
  };
}

describe("community pick growth math", () => {
  it("computes active growth from start and current spot", () => {
    expect(activeGrowthFactor(100, 150)).toBe(1.5);
    expect(activeReturnPct(1.5)).toBe(50);
  });

  it("compounds banked and active legs into lifetime return", () => {
    const banked = 1.5;
    const active = activeGrowthFactor(100, 110);
    const total = totalGrowthFactor(banked, active);
    expect(lifetimeReturnPct(total)).toBe(65);
  });

  it("+50% followed by +10% equals +65% lifetime", () => {
    const afterFirst = pickGrowthFactor(100, 150);
    expect(lifetimeReturnPct(afterFirst)).toBe(50);

    const total = totalGrowthFactor(afterFirst, activeGrowthFactor(200, 220));
    expect(lifetimeReturnPct(total)).toBe(65);
  });

  it("-20% followed by +25% nets to 0% lifetime", () => {
    const afterLoss = pickGrowthFactor(100, 80);
    expect(lifetimeReturnPct(afterLoss)).toBe(-20);

    const total = totalGrowthFactor(afterLoss, activeGrowthFactor(100, 125));
    expect(lifetimeReturnPct(total)).toBe(0);
  });

  it("+100% followed by -50% nets to 0% lifetime", () => {
    const afterDouble = pickGrowthFactor(50, 100);
    const total = totalGrowthFactor(afterDouble, activeGrowthFactor(200, 100));
    expect(lifetimeReturnPct(total)).toBe(0);
  });

  it("records closed-leg return for history display", () => {
    expect(pickReturnPct(120.5, 171.95)).toBe(42.7);
    expect(pickReturnPct(50, 45.8)).toBe(-8.4);
  });

  it("averages member lifetime returns for campus score", () => {
    expect(averageLifetimeReturnPct([10, 20, 30])).toBe(20);
    expect(averageLifetimeReturnPct([])).toBeNull();
  });
});

describe("authoritative spot pricing", () => {
  it("accepts live or previous close as spot", () => {
    expect(spotFromQuote(quote("AAPL", 190.25), "AAPL")).toEqual({
      ok: true,
      spot: 190.25,
      quote: quote("AAPL", 190.25),
    });
  });

  it("rejects missing, zero, or negative prices", () => {
    expect(spotFromQuote(undefined, "FAKE").ok).toBe(false);
    expect(spotFromQuote({ ...quote("X", 0), price: 0 }, "X").ok).toBe(false);
    expect(spotFromQuote({ ...quote("X", -1), price: -1 }, "X").ok).toBe(false);
  });
});

describe("community ranking threshold", () => {
  it("defaults to five scored members before ranking", () => {
    expect(MIN_RANKED_MEMBERS).toBe(5);
  });

  it("seeds five students across fifteen schools for ranked standings", () => {
    const students = listCampusSeedStudents();
    const schools = new Set(students.map((row) => row.groupId));
    expect(schools.size).toBe(15);
    expect(students.length).toBe(15 * MIN_RANKED_MEMBERS);
    expect(CAMPUS_SEED_STUDENTS_PER_SCHOOL).toBe(MIN_RANKED_MEMBERS);
    for (const groupId of schools) {
      expect(students.filter((row) => row.groupId === groupId)).toHaveLength(5);
    }
    const standings = seedCampusStandings();
    expect(standings).toHaveLength(15);
    expect(standings.every((row) => row.ranked && row.pickCount === 5)).toBe(true);
    expect(standings.every((row) => typeof row.avgReturnPct === "number")).toBe(true);
    const daily = seedCampusStandings("1d");
    expect(daily[0]?.avgReturnPct).toBeLessThan(standings[0]?.avgReturnPct ?? 0);
    expect(read("src/lib/community-picks/store.ts")).toContain("ensureCampusPickSeedsIfNeeded");
    expect(read("src/lib/community-picks/ensure-seeds.ts")).toContain("community_picks");
    expect(read("package.json")).toContain("seed:campus");
  });
});

describe("continuous accumulation wiring", () => {
  it("stores banked growth factor and pick history in migration 013", () => {
    expect(read("migrations/013_continuous_pick_accumulation.sql")).toContain("banked_growth_factor");
    expect(read("migrations/013_continuous_pick_accumulation.sql")).toContain("community_pick_history");
    expect(read("migrations/013_continuous_pick_accumulation.sql")).toContain("user_id, group_id");
  });

  it("uses server-side swap endpoint and growth compounding in store", () => {
    expect(read("src/lib/community-picks/store.ts")).toContain("swapCommunityPick");
    expect(read("src/lib/community-picks/store.ts")).toContain("withTransaction");
    expect(read("src/lib/community-picks/store.ts")).toContain("fetchAuthoritativeSpot");
    expect(read("src/lib/community-picks/pricing.ts")).toContain("fetchFreshStockQuotes");
    expect(read("src/lib/community-picks/store.ts")).toContain("MIN_RANKED_MEMBERS");
  });

  it("exposes POST /api/picks/swap and explicit save/swap actions on crowd card", () => {
    expect(read("src/app/api/picks/swap/route.ts")).toContain("swapCommunityPick");
    expect(read("src/components/CommunityPickCard.tsx")).toContain("Confirm Swap");
    expect(read("src/components/CommunityPickCard.tsx")).toContain("Save Pick");
    expect(read("src/components/CommunityPickCard.tsx")).toContain("community-pick-action");
    expect(read("src/components/CommunityPickCard.tsx")).toContain("Swap confirmed.");
    expect(read("src/components/CommunityPickCard.tsx")).not.toContain("starts fresh");
  });

  it("keeps competition lifecycle available but off the daily sync path", () => {
    const vercel = JSON.parse(read("vercel.json"));
    const paths = vercel.crons.map((job: { path: string }) => job.path);
    expect(paths).toContain("/api/cron/daily-sync");
    expect(paths).not.toContain("/api/cron/competitions");
    expect(read("src/app/api/cron/daily-sync/route.ts")).not.toContain("runCompetitionLifecycleTick");
    expect(read("src/app/api/cron/competitions/route.ts")).toContain("runCompetitionLifecycleTick");
  });
});
