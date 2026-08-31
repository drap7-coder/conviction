import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildCrowdSnapshot, rankCrowdHoldings, rankCrowdWatched } from "@/lib/crowd/aggregate";
import { CROWD_SEED_BOOKS, isCrowdSeedUserId, listCrowdSeedBooks } from "@/lib/crowd/seed-books";
import { getSectorColors, hasDomainLogo } from "@/lib/market/logos";
import type { CrowdBook } from "@/lib/crowd/types";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("Crowd seed books", () => {
  it("ships exactly ten starter member books with stable ids", () => {
    expect(CROWD_SEED_BOOKS).toHaveLength(10);
    expect(listCrowdSeedBooks()).toHaveLength(10);
    for (let i = 1; i <= 10; i += 1) {
      const id = `crowd-seed-${String(i).padStart(2, "0")}`;
      expect(CROWD_SEED_BOOKS.some((book) => book.id === id)).toBe(true);
      expect(isCrowdSeedUserId(id)).toBe(true);
    }
    expect(isCrowdSeedUserId("google-user-123")).toBe(false);
  });

  it("gives every seed book holdings and a watchlist", () => {
    for (const book of CROWD_SEED_BOOKS) {
      expect(book.positions.length).toBeGreaterThanOrEqual(3);
      expect(book.watchlist.length).toBeGreaterThanOrEqual(2);
      expect(book.source).toBe("seed");
    }
  });
});

describe("Crowd aggregation", () => {
  it("ranks NVDA near the top of most-held across seed books", () => {
    const held = rankCrowdHoldings(listCrowdSeedBooks());
    expect(held.length).toBeGreaterThan(5);
    const nvda = held.find((row) => row.ticker === "NVDA");
    expect(nvda).toBeDefined();
    expect(nvda!.holderCount).toBeGreaterThanOrEqual(4);
    expect(held[0].holderCount).toBeGreaterThanOrEqual(nvda!.holderCount);
    // Top of the board should be a name held in multiple books.
    expect(held[0].holderPct).toBeGreaterThan(20);
  });

  it("builds a snapshot with demo flag and watched ranks", () => {
    const snapshot = buildCrowdSnapshot(listCrowdSeedBooks());
    expect(snapshot.bookCount).toBe(10);
    expect(snapshot.seedBookCount).toBe(10);
    expect(snapshot.liveBookCount).toBe(0);
    expect(snapshot.includesDemoBooks).toBe(true);
    expect(snapshot.held.length).toBeGreaterThan(0);
    expect(snapshot.watched.length).toBeGreaterThan(0);
    expect(rankCrowdWatched(listCrowdSeedBooks())[0].watcherCount).toBeGreaterThanOrEqual(1);
  });

  it("merges a live book into the aggregate without leaking identity", () => {
    const live: CrowdBook = {
      id: "live-user-1",
      label: "Member",
      source: "live",
      positions: [
        { ticker: "NVDA", shares: 10, averageCost: 100 },
        { ticker: "ZZZZ", shares: 5, averageCost: 20 },
      ],
      watchlist: ["HOOD"],
    };
    const snapshot = buildCrowdSnapshot([...listCrowdSeedBooks(), live]);
    expect(snapshot.liveBookCount).toBe(1);
    expect(snapshot.bookCount).toBe(11);
    const zzzz = snapshot.held.find((row) => row.ticker === "ZZZZ");
    expect(zzzz?.holderCount).toBe(1);
    expect(JSON.stringify(snapshot)).not.toContain("live-user-1");
    expect(JSON.stringify(snapshot)).not.toContain("@");
  });
});

describe("Crowd surface wiring", () => {
  it("keeps Crowd on the daily tab bar with sr-only page title", () => {
    expect(read("src/app/crowd/page.tsx")).toContain('sr-only');
    expect(read("src/app/crowd/page.tsx")).toContain("CrowdBoard");
    expect(read("src/components/CrowdBoard.tsx")).toContain("Most held");
    expect(read("src/components/CrowdBoard.tsx")).toContain("Most watched");
    expect(read("src/components/CrowdBoard.tsx")).toContain("LogoDisplay");
    expect(read("src/components/CrowdBoard.tsx")).toContain("crowd-share");
    expect(read("src/components/CrowdBoard.tsx")).toContain("holderPct");
    expect(read("src/components/CrowdBoard.tsx")).toContain("watcherPct");
    expect(read("src/components/CrowdBoard.tsx")).toContain("of books");
    expect(read("src/components/CrowdBoard.tsx")).toContain("of lists");
    expect(read("src/components/CrowdBoard.tsx")).not.toContain("bookMetaLine");
    expect(read("src/components/CrowdBoard.tsx")).toContain("not a recommendation");
    expect(read("src/components/market/MarketMoversBoard.tsx")).toContain("LogoDisplay");
    expect(read("src/components/market/MarketMoversBoard.tsx")).toContain("pulse-movers-logo");
    expect(read("src/app/globals.css")).toContain(".pulse-movers-logo");
    expect(read("src/app/globals.css")).toContain(".crowd-share");
    expect(read("src/lib/nav-config.ts")).toContain('href: "/crowd"');
    expect(read("src/lib/nav-config.ts")).toContain('group: "daily"');
    expect(read("src/app/api/crowd/route.ts")).toContain("loadCrowdSnapshot");
    expect(read("AGENTS.md")).toContain("Crowd");
    expect(read("AGENTS.md")).toContain("holderPct");
  });

  it("covers Crowd seed tickers with logo domains or sector badges", () => {
    const tickers = new Set<string>();
    for (const book of CROWD_SEED_BOOKS) {
      for (const p of book.positions) tickers.add(p.ticker);
      for (const t of book.watchlist) tickers.add(t);
    }
    const missing = [...tickers].filter((t) => !hasDomainLogo(t) && !getSectorColors(t));
    expect(missing).toEqual([]);
  });
});
