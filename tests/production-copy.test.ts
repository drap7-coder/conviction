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

    expect(portfolio).toContain("parsePortfolioView");
    expect(portfolio).toContain('id: "live"');
    expect(portfolio).toContain('id: "watchlist"');
    expect(portfolio).toContain('id: "study"');
    expect(portfolio).toContain("SurfaceSlicer");
    expect(portfolio).toContain("<Watchlist");
    expect(portfolio).not.toContain("PortfolioCheckPanel");
    expect(portfolio).toContain("getStudyBrief");
    expect(portfolio).toContain("How it’s built");
    expect(portfolio).toContain("pf-study-ladder");
    expect(portfolio).toContain("pf-study-board");
    expect(portfolio).toContain("pf-study-chip-emoji");
    expect(portfolio).toContain("PortfolioAllocationLadder");
    expect(portfolio).toContain("is-avg");
    expect(portfolio).toContain("is-best");
    expect(portfolio).toContain("is-worst");
    expect(portfolio).toContain('id="portfolio-panel-holdings"');
    expect(portfolio).toContain("pf-manage-handoff");
    expect(portfolio).not.toContain("COMPARE_AGAINST_LABEL");
    expect(portfolio).not.toContain("pf-risk");
    expect(portfolio).not.toContain("pf-moves-block");
    expect(portfolio).not.toContain("FIT_HEDGE");
    // Study-only Moves vs your book (never Live advice chrome).
    expect(portfolio).toContain("generateSleeveMoves");
    expect(portfolio).toContain("visibleCompareMoves");
    expect(portfolio).toContain("pf-study-moves");
    expect(portfolio).toContain("Moves vs your book");
    expect(portfolio).toContain("hasLiveBook");
    expect(portfolio.indexOf("pf-study-ladder")).toBeLessThan(portfolio.indexOf("pf-study-moves"));
    const liveStart = portfolio.lastIndexOf("<ProductStage");
    const liveRender = portfolio.slice(liveStart);
    expect(liveRender).not.toContain("pf-study-moves");
    expect(liveRender).not.toContain("Moves vs your book");
    expect(liveRender).not.toContain("generateSleeveMoves");
    expect(portfolio).not.toContain("pf-live-machine");
    expect(portfolio).not.toContain("What has to go right");
    expect(portfolio).not.toContain("Capital Map");
    expect(portfolio).toContain("Sector Mix");
    expect(portfolio).not.toContain("Where the equity exposure sits");
    expect(portfolio).toContain("SectorDonut");
    expect(portfolio).toContain("pf-sector-mix-donut");
    expect(portfolio).not.toContain("SectorMixBars");
    expect(portfolio).toContain("Concentration");
    expect(portfolio).toContain("Largest positions");
    expect(portfolio).not.toContain("Position weight vs. risk thresholds");
    expect(portfolio).toContain("pf-hero-diagnosis");
    expect(portfolio).toContain("PROFILE_BENCHMARK");
    expect(liveRender.indexOf("{sectorMixCard}")).toBeLessThan(liveRender.indexOf("{allocationPanel}"));
    expect(liveRender.indexOf("{allocationPanel}")).toBeLessThan(liveRender.indexOf("<PortfolioBenchmarkChart"));
    expect(liveRender.indexOf("<PortfolioBenchmarkChart")).toBeLessThan(liveRender.indexOf('id="portfolio-panel-holdings"'));
    expect(portfolio).toContain("benchmarkTicker={benchmark.ticker}");
    expect(portfolio).not.toContain("pf-compare-board");
    expect(portfolio).not.toContain("Also close to");
    expect(portfolio).toContain("typewriterHeadline={false}");
    expect(portfolio).not.toContain("headline={stageHeadline}");
    expect(portfolio).not.toContain("investorFitLabel");
    expect(portfolio).not.toContain("riskProfileDeltaLead");
    expect(portfolio).not.toContain("RISK_PROFILE_MOVES_SUBHEAD");
    expect(portfolio).not.toContain("namedTicker");
    expect(portfolio).not.toContain("moveVerb");
    expect(portfolio).not.toContain("moveFocus");
    expect(portfolio).toContain('metricsPlacement="above"');
    expect(portfolio).toContain("formatPortfolioDollars");
    expect(portfolio).not.toContain("compactCurrency");
    expect(portfolio).not.toContain('toFixed(1) + "K"');
    expect(portfolio).toContain("pf-day-strip");
    expect(portfolio).toContain("pf-day-strip-pct");
    expect(portfolio).toContain("dayChangeParts");
    expect(portfolio).toContain("({dayMove.percent})");
    expect(portfolio).toContain("pf-live-meta");
    expect(portfolio).toContain("DaySpark");
    expect(portfolio).not.toContain("pf-day-gauge");
    expect(portfolio).not.toContain("DayChangeGauge");
    expect(portfolio).toContain(">Today<");
    expect(portfolio).not.toContain(">Largest<");
    expect(portfolio).not.toContain("summary={stageSummary}");
    expect(read("src/components/PortfolioAllocationLadder.tsx")).toContain("pf-allocation-today");
    expect(read("src/components/ProductStage.tsx")).toContain('metricsPlacement');
    expect(read("src/app/globals.css")).toContain("product-stage--metrics-above");
    expect(read("src/app/globals.css")).toContain("--pf-hero-pad");
    expect(read("src/app/globals.css")).toContain("pf-day-strip");
    expect(read("src/app/globals.css")).toContain("pf-donut-wrap--3d");
    expect(read("src/app/globals.css")).toContain(".product-stage-metrics > .is-lead");
    expect(read("src/components/DonutChart.tsx")).toContain("pf-donut-3d");
    expect(read("src/app/portfolio.css")).toContain("pf-day-strip");
    expect(read("src/app/portfolio.css")).toContain("pf-day-strip-pct");
    expect(read("src/app/portfolio.css")).toContain("pf-live-meta");
    expect(read("src/app/portfolio.css")).toContain("pf-sector-mix");
    expect(read("src/app/portfolio.css")).toContain("pf-sector-mix-donut");
    expect(read("src/app/portfolio.css")).toContain("pf-study-board");
    expect(read("src/app/portfolio.css")).toContain("pf-study-chip-emoji");
    expect(read("src/app/portfolio.css")).not.toContain("pf-day-gauge");
    expect(portfolio).not.toContain("riskProfileMovesLead");
    expect(portfolio).not.toContain("If you mean");
    expect(portfolio).not.toContain("RISK_PROFILE_BLURBS");
    expect(portfolio).not.toContain("Then here are the moves");
    expect(portfolio).not.toContain("What’s your risk profile");
    expect(portfolio).not.toContain("Compare against");
    expect(portfolio).not.toContain("pf-move-verb");
    expect(portfolio).not.toContain("RISK_PROFILE_STORAGE_KEY");
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
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(css).toContain("min-width: 0");
    expect(css).toContain(".pf-study-board");
    expect(css).toContain(".pf-study-chip-emoji");
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
    expect(tape).toContain("subscribeMarketData");
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
    expect(watchlist).not.toContain("StockHeatmap");
    expect(watchlist).toContain("MarketMoversBoard");
    expect(watchlist).toContain("splitMarketMovers");
    expect(watchlist).toContain("SurfaceSlicer");
    expect(watchlist).toContain("All Assets");
    expect(watchlist).toContain("Leaders");
    expect(watchlist).toContain("Laggards");
    expect(watchlist).not.toContain("MarketScoreboard");
    expect(watchlist).toContain("No gainers yet.");
    expect(watchlist).toContain("No losers yet.");
    expect(watchlist).toContain("getExtendedSessionQuote");
    expect(watchlist).toContain("extendedNoTrades");
    expect(watchlist).toContain("showWhenEmpty");
    expect(watchlist).toContain("topEmptyLabel");
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
    expect(feed).toContain("is-featured");
    expect(feed).toContain("featured={index === 0}");
    expect(feed).toContain("orderNewsBriefThemes");
    expect(feed).toContain("pickHeroHeadline");
    expect(feed).toContain("pulse-news-lead-chip");
    expect(feed).toContain("headline.imageUrl");
    expect(feed).toContain("next/image");
    expect(feed).not.toContain("TypewriterText");
    expect(feed).toContain("HeadlineCard");
    expect(feed).not.toContain("pulse-news-row");
    expect(feed).not.toContain(">Headlines<");
    expect(feed).toContain("SurfaceSlicer");
    expect(feed).toContain("pulse-news-filters");
    const newsCss = read("src/app/globals.css");
    expect(newsCss).toContain(".surface-slicer");
    expect(newsCss).toContain(".surface-slicer-pill.is-active");
    expect(newsCss).toContain("overflow-x: auto");
    expect(newsCss).toContain(".pulse-news-narrative.is-featured");
    expect(newsCss).toContain("grid-column: 1 / -1");
    expect(newsCss).toContain(".pulse-news-hero-media");
    expect(newsCss).toContain("aspect-ratio: 16 / 9");
    expect(newsCss).toContain("@media (min-width: 768px)");
    const narratives = read("src/lib/market/market-narratives.ts");
    expect(narratives).toContain("imageUrl?: string | null");
    expect(narratives).toContain("imageUrl: item.metadata?.imageUrl ?? null");
    const pulse = read("src/app/pulse/page.tsx");
    expect(pulse).not.toContain("ProductStage");
  });

  it("keeps Pulse Trending as Market Movers, not a watchlist chip editor", () => {
    const panel = read("src/components/market/MarketMovesPanel.tsx");
    const pulse = read("src/app/pulse/page.tsx");

    expect(pulse).toContain("MarketMovesPanel");
    expect(panel).toContain("MarketMoversBoard");
    expect(panel).toContain("splitMarketMovers");
    expect(panel).not.toContain("StockHeatmap");
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
