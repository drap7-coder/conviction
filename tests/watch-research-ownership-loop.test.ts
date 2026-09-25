import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("watch → research → ownership loop", () => {
  it("turns Watchlist into a clear research queue without replacing the movers board", () => {
    const watchlist = read("src/components/Watchlist.tsx");

    expect(watchlist).toContain("Your daily research queue");
    expect(watchlist).toContain("01 · Watch");
    expect(watchlist).toContain("02 · Research");
    expect(watchlist).toContain("03 · Own");
    expect(watchlist).toContain("Private sync on");
    expect(watchlist).toContain("MarketMoversBoard");
    expect(watchlist).not.toContain("<WatchlistDailyBrief");
  });

  it("carries a researched ticker into the portfolio holding composer", () => {
    const quote = read("src/app/components/CompanyQuoteCard.tsx");
    const manager = read("src/components/PortfolioManager.tsx");

    expect(quote).toContain("Add holding");
    expect(quote).toContain("/manage?view=portfolio&ticker=");
    expect(manager).toContain('searchParams.get("ticker")');
    expect(manager).toContain("prefilledTicker");
    expect(manager).toContain("sharesInputRef.current?.focus()");
  });

  it("keeps the workflow responsive and motion-safe", () => {
    const watchCss = read("src/app/watchlist.css");
    const companyCss = read("src/app/dashboard.css");

    expect(watchCss).toContain(".watchlist-research-path");
    expect(watchCss).toContain("grid-template-columns: 1fr;");
    expect(watchCss).toContain("prefers-reduced-motion: reduce");
    expect(companyCss).toContain(".company-own-link");
  });
});
