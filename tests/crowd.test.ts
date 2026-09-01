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
    expect(nvda!.seedHolderCount).toBe(nvda!.holderCount);
    expect(nvda!.liveHolderCount).toBe(0);
  });

  it("sorts by raw count descending, then live participation, then ticker", () => {
    const books: CrowdBook[] = [
      {
        id: "seed-a",
        label: "Seed A",
        source: "seed",
        positions: [{ ticker: "AAA", shares: 1, averageCost: 10 }],
        watchlist: ["AAA"],
      },
      {
        id: "seed-b",
        label: "Seed B",
        source: "seed",
        positions: [{ ticker: "AAA", shares: 1, averageCost: 10 }],
        watchlist: ["BBB"],
      },
      {
        id: "live-1",
        label: "Live",
        source: "live",
        positions: [{ ticker: "BBB", shares: 1, averageCost: 10 }],
        watchlist: ["BBB"],
      },
    ];

    const held = rankCrowdHoldings(books);
    expect(held.map((row) => row.ticker)).toEqual(["AAA", "BBB"]);
    expect(held[0].holderCount).toBe(2);
    expect(held[1].holderCount).toBe(1);
    expect(held[1].liveHolderCount).toBe(1);

    const watched = rankCrowdWatched(books);
    expect(watched[0].ticker).toBe("BBB");
    expect(watched[0].watcherCount).toBe(2);
    expect(watched[0].liveWatcherCount).toBe(1);
    expect(watched[0].seedWatcherCount).toBe(1);
  });

  it("breaks held ties with live participation before alphabetical order", () => {
    const books: CrowdBook[] = [
      {
        id: "seed-a",
        label: "Seed A",
        source: "seed",
        positions: [{ ticker: "ZZZ", shares: 1, averageCost: 10 }],
        watchlist: [],
      },
      {
        id: "live-1",
        label: "Live",
        source: "live",
        positions: [{ ticker: "AAA", shares: 1, averageCost: 10 }],
        watchlist: [],
      },
      {
        id: "seed-b",
        label: "Seed B",
        source: "seed",
        positions: [{ ticker: "BBB", shares: 1, averageCost: 10 }],
        watchlist: [],
      },
    ];

    const held = rankCrowdHoldings(books);
    expect(held.every((row) => row.holderCount === 1)).toBe(true);
    expect(held[0].ticker).toBe("AAA");
    expect(held[0].liveHolderCount).toBe(1);
    expect(held[1].ticker).toBe("BBB");
    expect(held[2].ticker).toBe("ZZZ");
  });

  it("does not produce false ties when raw counts differ", () => {
    const held = rankCrowdHoldings(listCrowdSeedBooks());
    const counts = held.map((row) => row.holderCount);
    for (let i = 0; i < counts.length; i += 1) {
      for (let j = i + 1; j < counts.length; j += 1) {
        if (counts[i] !== counts[j]) {
          expect(counts[i]).not.toBe(counts[j]);
        }
      }
    }
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
    expect(zzzz?.liveHolderCount).toBe(1);
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
    expect(read("src/components/CrowdBoard.tsx")).not.toContain("crowd-count");
    expect(read("src/components/CrowdBoard.tsx")).not.toContain("holderPct");
    expect(read("src/components/CrowdBoard.tsx")).not.toContain("watcherPct");
    expect(read("src/components/CrowdBoard.tsx")).not.toContain("of books");
    expect(read("src/components/CrowdBoard.tsx")).not.toContain("of lists");
    expect(read("src/components/CrowdBoard.tsx")).not.toContain("crowdBoardMetaLine");
    expect(read("src/components/CrowdBoard.tsx")).not.toContain("crowd-board-meta");
    expect(read("src/components/CrowdBoard.tsx")).toContain("CrowdPersonalGlyphs");
    expect(read("src/components/CrowdBoard.tsx")).toContain("CircleCheck");
    expect(read("src/components/CrowdBoard.tsx")).toContain("Eye");
    expect(read("src/components/CrowdBoard.tsx")).not.toContain("crowd-you-chip");
    expect(read("src/components/CrowdBoard.tsx")).not.toContain("crowdPersonalLabel");
    expect(read("src/components/CrowdBoard.tsx")).toContain("loadPortfolioForViewer");
    expect(read("src/components/CrowdBoard.tsx")).not.toContain("sync-universe");
    expect(read("src/components/CrowdBoard.tsx")).toContain("not a recommendation");
    expect(read("src/app/api/crowd/route.ts")).not.toContain("Owned");
    expect(read("src/components/market/MarketMoversBoard.tsx")).toContain("LogoDisplay");
    expect(read("src/app/globals.css")).toContain(".crowd-glyphs");
    expect(read("src/app/globals.css")).not.toContain(".crowd-count");
    expect(read("src/app/globals.css")).not.toContain(".crowd-board-meta");
    expect(read("src/lib/nav-config.ts")).toContain('href: "/crowd"');
    expect(read("src/lib/nav-config.ts")).toContain('group: "daily"');
    expect(read("src/app/api/crowd/route.ts")).toContain("loadCrowdSnapshot");
    expect(read("AGENTS.md")).toContain("Crowd");
    expect(read("AGENTS.md")).toContain("rank order is the UI");
    expect(read("AGENTS.md")).toContain("crowd-glyphs");
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
