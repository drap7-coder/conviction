import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("data management workspace", () => {
  it("provides one menu-backed page with a Watchlist | Portfolio SurfaceSlicer", () => {
    expect(existsSync(new URL("../src/app/manage/page.tsx", import.meta.url))).toBe(true);
    const page = read("src/app/manage/page.tsx");
    const workspace = read("src/components/ManageWorkspace.tsx");
    const nav = read("src/lib/nav-config.ts");

    expect(nav).toContain('href: "/manage"');
    expect(nav).toContain('label: "Manage"');
    expect(page).toContain("<ManageWorkspace");
    expect(page).toContain("getOptionalSession");
    expect(page).not.toContain('href="#watchlist"');
    expect(page).not.toContain('href="#portfolio"');
    expect(workspace).toContain("<GuestModeBanner");
    expect(workspace).toContain('<Watchlist mode="manage" />');
    expect(workspace).toContain("<PortfolioManager />");
    expect(workspace).toContain("SurfaceSlicer");
    expect(workspace).toContain('id: "watchlist"');
    expect(workspace).toContain('id: "portfolio"');
    expect(workspace).toContain('params.set("view", next)');
    expect(workspace).toContain("activeView === \"watchlist\"");
    expect(workspace).toContain("activeView === \"portfolio\"");
  });

  it("uses a quiet ProductStage hero with view-aware editor copy and compose CTA", () => {
    const workspace = read("src/components/ManageWorkspace.tsx");
    const stage = read("src/components/ProductStage.tsx");
    const css = read("src/app/manage/manage.css");
    const globals = read("src/app/globals.css");
    const watchlist = read("src/components/Watchlist.tsx");
    const manager = read("src/components/PortfolioManager.tsx");

    expect(stage).toContain('"manage"');
    expect(workspace).toContain('variant="manage"');
    expect(workspace).toContain("Watchlist editor");
    expect(workspace).toContain("Portfolio editor");
    expect(workspace).toContain("Edit what you follow.");
    expect(workspace).toContain("Edit what you own.");
    expect(workspace).toContain("Jump to add");
    expect(workspace).toContain("focusManageCompose");
    expect(workspace).toContain('typewriterHeadline={false}');
    expect(workspace).not.toContain("Your data");
    expect(css).toContain(".data-manage-hero-cta");
    expect(css).toContain(".data-manage-hero .product-stage");
    expect(globals).toContain(".product-stage--manage");
    expect(globals).toContain("--stage-glow: transparent");
    expect(watchlist).toContain('id="manage-compose"');
    expect(manager).toContain('id="manage-compose"');
  });

  it("keeps main Watchlist and Portfolio pages read-first with Manage deep links", () => {
    const watchlist = read("src/components/Watchlist.tsx");
    const portfolio = read("src/components/Portfolio.tsx");
    const holdingCard = read("src/components/PortfolioHoldingCard.tsx");

    expect(watchlist).toContain('href="/manage?view=watchlist"');
    expect(watchlist).toContain('if (mode === "manage")');
    expect(watchlist).toContain("LogoDisplay");
    expect(watchlist).toContain("data-manager-logo");
    expect(watchlist).not.toContain("wl-manage-row");
    expect(portfolio).toContain('href="/manage?view=portfolio"');
    expect(portfolio).toContain("pf-manage-handoff");
    expect(portfolio).toContain("Manage holdings");
    expect(portfolio).not.toContain("Where the value lives");
    expect(portfolio).not.toContain("composeBar");
    expect(portfolio).not.toContain("handleClearAll");
    expect(holdingCard).toContain("LogoDisplay");
    expect(holdingCard).toContain("fmtCompactCurrency");
    expect(holdingCard).toContain("fmtPercent");
    expect(holdingCard).toContain("pf-holding-actions");
    expect(holdingCard).toContain("onConfirmRemove");
    expect(holdingCard).not.toContain("pf-holding-badge");
    expect(watchlist).toContain("headerAction={(");
    expect(watchlist).not.toContain('className="data-page-actions"');
    expect(portfolio).not.toContain('className="pf-values-positions-header-actions"');
    expect(portfolio).not.toContain('className="data-page-actions"');
  });

  it("uses the shared portfolio sync client and confirms destructive bulk clearing", () => {
    const manager = read("src/components/PortfolioManager.tsx");

    expect(manager).toContain("usePortfolioData");
    expect(manager).toContain("savePortfolioForViewer");
    expect(manager).toContain("notifyPortfolioChanged");
    expect(manager).toContain("PortfolioHoldingCard");
    expect(manager).toContain("list-compose");
    expect(manager).toContain("surface-shell");
    expect(manager).toContain("surface-well");
    expect(manager).toContain("Clear every holding?");
    expect(manager).toContain("Portfolio holdings are stored in this browser.");
    expect(manager).toContain("Portfolio holdings are synced privately in Neon.");
    expect(manager).toContain('fetch("/api/portfolio/resolve"');
    expect(manager).toContain("Ticker or company");
  });

  it("shares a touch-safe company typeahead across both add flows", () => {
    const watchlist = read("src/components/Watchlist.tsx");
    const portfolio = read("src/components/PortfolioManager.tsx");
    const typeahead = read("src/components/CompanyTypeahead.tsx");

    expect(watchlist).toContain("<CompanyTypeahead");
    expect(portfolio).toContain("<CompanyTypeahead");
    expect(typeahead).toContain("/api/companies/search?q=");
    expect(typeahead).toContain("onPointerDown");
    expect(typeahead).toContain('role="combobox"');
    expect(portfolio).toContain("sharesInputRef.current?.focus()");
  });

  it("keeps the manager usable on narrow screens and matches site chrome", () => {
    const css = read("src/app/manage/manage.css");
    const watchlist = read("src/components/Watchlist.tsx");
    const manager = read("src/components/PortfolioManager.tsx");

    expect(css).toContain("@media (max-width: 720px)");
    expect(css).toContain("@media (max-width: 480px)");
    expect(css).toContain("grid-template-columns: 1fr;");
    expect(css).toContain(".data-manage-slicer");
    expect(css).toContain(".data-manager-holdings");
    expect(css).toContain(".data-manager-logo");
    expect(css).toContain(".pf-holding-logo");
    expect(css).toContain("min-width: 0");
    expect(css).toContain("var(--border-raised)");
    expect(css).toContain("var(--shadow-sm)");
    expect(css).toContain("var(--surface-well-highlight)");
    expect(css).toContain("var(--card-inset)");
    expect(css).not.toContain("--surface-shell-radius");
    expect(watchlist).toContain("data-manager-compose list-compose surface-well");
    expect(watchlist).not.toContain("list-compose ink-panel");
    expect(manager).toContain("data-manager-compose list-compose surface-well");
  });
});

describe("logo + position formatting consistency", () => {
  it("uses LogoDisplay on holdings, allocation ladder, company quote, movers, and crowd", () => {
    expect(read("src/components/PortfolioHoldingCard.tsx")).toContain("LogoDisplay");
    expect(read("src/components/PortfolioAllocationLadder.tsx")).toContain("LogoDisplay");
    expect(read("src/app/components/CompanyQuoteCard.tsx")).toContain("LogoDisplay");
    expect(read("src/components/market/MarketMoversBoard.tsx")).toContain("LogoDisplay");
    expect(read("src/components/CrowdBoard.tsx")).toContain("LogoDisplay");
    expect(read("src/app/components/InvestorMovesPanel.tsx")).toContain("LogoDisplay");
  });

  it("formats holding figures with shared display helpers", () => {
    const card = read("src/components/PortfolioHoldingCard.tsx");
    expect(card).toContain("fmtCompactCurrency");
    expect(card).toContain("fmtDollarPrice");
    expect(card).toContain("fmtPercent");
    expect(card).toContain("pf-holding-weight");
    expect(card).not.toContain("function formatPrice");
    expect(card).not.toContain("function compactCurrency");
  });
});
