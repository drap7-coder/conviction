import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("data management workspace", () => {
  it("provides one menu-backed page for Watchlist and Portfolio editing", () => {
    expect(existsSync(new URL("../src/app/manage/page.tsx", import.meta.url))).toBe(true);
    const page = read("src/app/manage/page.tsx");
    const nav = read("src/lib/nav-config.ts");

    expect(nav).toContain('href: "/manage"');
    expect(nav).toContain('label: "Manage"');
    expect(page).toContain('<Watchlist mode="manage" />');
    expect(page).toContain("<PortfolioManager />");
    expect(page).toContain('href="#watchlist"');
    expect(page).toContain('href="#portfolio"');
  });

  it("keeps main Watchlist and Portfolio pages read-first", () => {
    const watchlist = read("src/components/Watchlist.tsx");
    const portfolio = read("src/components/Portfolio.tsx");
    const holdingCard = read("src/components/PortfolioHoldingCard.tsx");

    expect(watchlist).toContain('href="/manage#watchlist"');
    expect(watchlist).toContain('if (mode === "manage")');
    expect(watchlist).not.toContain("wl-manage-row");
    expect(portfolio).toContain('href="/manage#portfolio"');
    expect(portfolio).not.toContain("composeBar");
    expect(portfolio).not.toContain("handleClearAll");
    expect(holdingCard).not.toContain("pf-holding-actions");
    expect(holdingCard).not.toContain("onConfirmRemove");
  });

  it("uses the existing browser portfolio store and confirms destructive bulk clearing", () => {
    const manager = read("src/components/PortfolioManager.tsx");

    expect(manager).toContain("loadPositions");
    expect(manager).toContain("savePositions");
    expect(manager).toContain("notifyPortfolioChanged");
    expect(manager).toContain("Clear every holding?");
    expect(manager).toContain("Portfolio holdings are stored in this browser.");
  });

  it("keeps the manager usable on narrow screens", () => {
    const css = read("src/app/manage/manage.css");

    expect(css).toContain("@media (max-width: 720px)");
    expect(css).toContain("@media (max-width: 480px)");
    expect(css).toContain("grid-template-columns: 1fr;");
  });
});
