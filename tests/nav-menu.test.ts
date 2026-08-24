import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  isOverflowNavPath,
  menuGroups,
  menuNavPages,
  navPages,
  navTabs,
  primaryNavTabs,
} from "@/lib/nav-config";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("site menu nav", () => {
  it("keeps daily tabs to Pulse, Watchlist, Portfolio, and News", () => {
    expect(primaryNavTabs.map((tab) => tab.href)).toEqual([
      "/pulse",
      "/watchlist",
      "/portfolio",
      "/news",
    ]);
    expect(navTabs).toEqual(primaryNavTabs);
    expect(primaryNavTabs.some((tab) => tab.href === "/smart-money")).toBe(false);
  });

  it("demotes Smart Money into Menu → More", () => {
    expect(menuNavPages.map((page) => page.href)).toEqual(["/smart-money"]);
    expect(navPages.some((page) => page.href === "/smart-money" && page.group === "more")).toBe(true);
    expect(menuGroups.map((group) => group.id)).toEqual(["daily", "more"]);
    expect(isOverflowNavPath("/smart-money")).toBe(true);
    expect(isOverflowNavPath("/pulse")).toBe(false);
  });

  it("renders Menu as the fifth chrome item, not a Smart Money tab", () => {
    const bar = read("src/components/BottomTabBar.tsx");
    expect(bar).toContain('aria-label="Menu"');
    expect(bar).toContain(">Menu</span>");
    expect(bar).toContain("primaryNavTabs");
    expect(bar).toContain("menuGroups");
    expect(bar).toContain("isOverflowNavPath");
    expect(bar).not.toMatch(/href=\{href\}[\s\S]*Smart Money/);
    expect(bar).not.toContain('href: "/smart-money"');
    expect(read("src/app/globals.css")).toContain(".site-menu");
  });
});
