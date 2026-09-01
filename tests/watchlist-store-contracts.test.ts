import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("watchlist store contracts", () => {
  it("does not expose the ops sync universe as guest personal entries", () => {
    const route = read("src/app/api/watchlist/route.ts");
    const add = read("src/app/api/watchlist/add/route.ts");
    const watchlist = read("src/components/Watchlist.tsx");
    const tracking = read("src/app/components/use-watchlist-tracking.ts");
    const news = read("src/components/market/PulseNewsFeed.tsx");
    const universe = read("src/lib/evidence/sync-universe.ts");
    const admin = read("src/app/api/admin/resources/route.ts");
    const agents = read("AGENTS.md");

    expect(route).not.toContain("guestEntries");
    expect(route).not.toContain("getWatchlist()");
    expect(route).toContain('persistence: "browser"');
    expect(route).toContain("suggestions: SEED_WATCHLIST");
    expect(route).toContain("ops/cron");
    expect(route).toContain("isSyncUniverseKvEnabled");

    expect(add).not.toContain("addToWatchlist");
    expect(add).not.toContain("updateWatchlistSync");
    expect(add).not.toContain("addToSyncUniverse");
    expect(add).toContain('persistence: "browser"');
    expect(add).toContain("Never mutates the shared ops/cron");

    expect(watchlist).not.toContain("guestEntries");
    expect(watchlist).toContain("browserEntries ?? []");
    expect(watchlist).toContain('inputAriaLabel="Ticker or company name"');
    expect(watchlist).toContain("<label className=\"data-manager-compose-ticker\"");

    expect(tracking).not.toContain("guestEntries");
    expect(tracking).toContain("readBrowserWatchlist()");
    expect(news).not.toContain("guestEntries");

    expect(universe).toContain("Evidence sync universe");
    expect(universe).toContain("conviction:sync-universe");
    expect(universe).toContain("buildDailySyncQueue");
    expect(universe).toContain("listPopularMemberWatchlistTickers");
    expect(existsSync(resolve("src/lib/watchlist/persist.ts"))).toBe(false);
    expect(admin).toContain("syncUniverse");
    expect(admin).toContain("popular Neon member tickers");
    expect(agents).toContain("sync-universe");
    expect(agents).toContain("buildDailySyncQueue");
  });

  it("labels the Watchlist compose combobox for accessibility", () => {
    const typeahead = read("src/components/CompanyTypeahead.tsx");
    expect(typeahead).toContain("inputAriaLabel");
    expect(typeahead).toContain("aria-label={inputAriaLabel ?? placeholder}");
  });
});

describe("daily sync queue wiring", () => {
  it("full evidence refresh uses buildDailySyncQueue", () => {
    const refresh = read("src/app/api/evidence/refresh/route.ts");
    expect(refresh).toContain("buildDailySyncQueue");
    expect(refresh).toContain("updateSyncUniverseStatus");
    expect(refresh).not.toContain("getWatchlistSortedBySyncPriority");
    expect(refresh).not.toContain("updateWatchlistSync");
  });
});
