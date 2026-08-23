import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("production copy and fixture isolation", () => {
  it("keeps real company pages detached from fixture/demo evidence", () => {
    const companyPage = read("src/app/companies/[ticker]/page.tsx");

    expect(companyPage).not.toContain("FIXTURE_COMPANIES");
    expect(companyPage).not.toContain("FIXTURE_JOURNAL_ENTRIES");
    expect(companyPage).not.toContain("DEMO_LABEL");
    expect(companyPage).not.toContain("legacy-context");
  });

  it("keeps retired utility routes out of the product", () => {
    expect(existsSync(new URL("../src/app/activity/page.tsx", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../src/app/api/activity/route.ts", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../src/app/journal/page.tsx", import.meta.url))).toBe(false);
  });

  it("keeps Live Portfolio as the default, and Study Mode on design briefs", () => {
    const portfolio = read("src/components/Portfolio.tsx");

    expect(portfolio).toContain('searchParams.get("mode") === "study" ? "study" : "live"');
    expect(portfolio).toContain("Live Portfolio");
    expect(portfolio).not.toContain("PortfolioCheckPanel");
    expect(portfolio).toContain("getStudyBrief");
    expect(portfolio).toContain("How it’s built");
    expect(portfolio).toContain("pf-study-ladder");
    expect(portfolio).toContain("PortfolioAllocationLadder");
    expect(portfolio).toContain("is-avg");
    expect(portfolio).toContain("is-best");
    expect(portfolio).toContain("is-worst");
    expect(portfolio).toContain('id="portfolio-panel-holdings"');
  });

  it("does not render setup instructions in the guest watchlist experience", () => {
    const homePage = read("src/app/page.tsx");
    const watchlistRoute = read("src/app/api/watchlist/route.ts");

    for (const source of [homePage, watchlistRoute]) {
      expect(source).not.toContain("Sign-in setup needed");
      expect(source).not.toContain("DATABASE_URL is not configured");
      expect(source).not.toContain("GitHub");
      expect(source).not.toContain("Neon");
    }
  });

  it("keeps Study performance ticks on annualized, best, and worst", () => {
    const css = read("src/app/portfolio.css");

    expect(css).toContain(".pf-study-history-metrics > div::before");
    expect(css).toContain(".pf-study-history-metrics .is-avg::before");
    expect(css).toContain(".pf-study-history-metrics .is-best::before");
    expect(css).toContain(".pf-study-history-metrics .is-worst::before");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) auto");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(css).toContain("min-width: 0");
    expect(css).not.toContain("overflow-wrap: anywhere");
  });

  it("keeps the workspace tape as a scrolling symbol-and-percent strip", () => {
    const tape = read("src/components/MarketTape.tsx");
    const css = read("src/app/globals.css");

    expect(tape).toContain('ticker: "DIA"');
    expect(tape).toContain('ticker: "SPY"');
    expect(tape).toContain('ticker: "QQQ"');
    expect(tape).toContain('ticker: "GLD"');
    expect(tape).toContain('ticker: "BTC-USD"');
    expect(tape).toContain('symbol: "BTC"');
    expect(tape).toContain("TRENDING_LIMIT");
    expect(tape).toContain("/api/market/trending");
    expect(tape).toContain('aria-label="Market tape"');
    expect(tape).toContain("inert={hidden || undefined}");
    expect(tape).not.toContain("formatValue");
    expect(tape).not.toContain("market-tape-name");
    expect(tape).not.toContain("Markets");
    expect(tape).not.toContain("Trending now");
    expect(tape).not.toContain("^VIX");
    expect(tape).not.toContain("^TNX");
    expect(css).toContain("animation: market-tape-scroll 20s linear infinite");
    expect(css).toContain(".market-tape:hover .market-tape-track");
    expect(css).toContain("animation-play-state: paused");
    expect(css).not.toContain(".market-tape:focus-within .market-tape-track");
    expect(css).toContain("@media (prefers-reduced-motion: no-preference)");
    expect(css).toContain("animation-iteration-count: infinite !important");
  });

  it("moves watchlist evidence into the company dashboard catalyst slot", () => {
    const companyPage = read("src/app/companies/[ticker]/page.tsx");
    const watchlist = read("src/components/Watchlist.tsx");
    const sectorPage = read("src/app/industries/[ticker]/page.tsx");

    expect(companyPage).toContain("CompanyEvidenceCard");
    expect(companyPage).not.toContain("MaterialNewsCard");
    expect(watchlist).not.toContain("<WatchlistDailyBrief");
    expect(watchlist).not.toContain("Fresh on your watchlist");
    expect(watchlist).not.toContain("buildWatchlistBriefItems");
    expect(watchlist).not.toContain("ProductStage");
    expect(watchlist).not.toContain(">Updates<");
    expect(watchlist).not.toContain(">Higher<");
    expect(watchlist).not.toContain(">Lower<");
    expect(sectorPage).toContain("MaterialNewsCard");
  });

  it("drops the News ProductStage count strip", () => {
    const news = read("src/app/news/page.tsx");

    expect(news).not.toContain("ProductStage");
    expect(news).not.toContain("buildNewsPageBrief");
    expect(news).not.toContain("Recent stories");
    expect(news).not.toContain("Active narratives");
    expect(news).not.toContain("Feed status");
    expect(news).toContain("PulseNewsFeed");
    const feed = read("src/components/market/PulseNewsFeed.tsx");
    expect(feed).not.toContain("is-featured");
    expect(feed).not.toContain("featured=");
    expect(feed).not.toContain("TypewriterText");
    expect(feed).toContain("HeadlineCard");
    expect(feed).not.toContain("pulse-news-row");
    expect(feed).not.toContain(">Headlines<");
    const pulse = read("src/app/pulse/page.tsx");
    expect(pulse).not.toContain("ProductStage");
  });

  it("keeps Pulse Trending as a heatmap, not a watchlist chip editor", () => {
    const panel = read("src/components/market/MarketMovesPanel.tsx");
    const pulse = read("src/app/pulse/page.tsx");

    expect(pulse).toContain("MarketMovesPanel");
    expect(panel).toContain("StockHeatmap");
    expect(panel).toContain('title="Active names"');
    expect(panel).not.toContain("TrendingManageChips");
    expect(panel).not.toContain("wl-manage-row");
    expect(panel).not.toContain("handleAddTrending");
    expect(panel).not.toContain("handleRemoveTrending");
    expect(panel).not.toContain("/api/watchlist");
  });

  it("keeps the mobile add-company composer from forcing horizontal overflow", () => {
    const css = read("src/app/globals.css");

    expect(css).toContain(".watchlist-add");
    expect(css).toContain(".watchlist-input-wrap");
    expect(css).toContain("min-width: 0");
    expect(css).toContain("text-overflow: ellipsis");
  });
});
