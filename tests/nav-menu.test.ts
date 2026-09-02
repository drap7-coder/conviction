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
  it("keeps daily tabs to Pulse, Crowd, Portfolio, and News", () => {
    expect(primaryNavTabs.map((tab) => tab.href)).toEqual([
      "/pulse",
      "/crowd",
      "/portfolio",
      "/news",
    ]);
    expect(navTabs).toEqual(primaryNavTabs);
    expect(primaryNavTabs.some((tab) => tab.href === "/smart-money")).toBe(false);
    expect(primaryNavTabs.some((tab) => tab.href === "/watchlist")).toBe(false);
    expect(primaryNavTabs.some((tab) => tab.href === "/crowd")).toBe(true);
  });

  it("puts About, Q&A, and account pages in Menu — Smart Money is retired", () => {
    expect(menuNavPages.map((page) => page.href)).toEqual([
      "/about",
      "/faq",
      "/manage",
      "/signin",
    ]);
    expect(navPages.some((page) => page.href === "/smart-money")).toBe(false);
    expect(navPages.some((page) => page.href === "/crowd" && page.group === "daily")).toBe(true);
    expect(navPages.some((page) => page.href === "/watchlist")).toBe(false);
    expect(navPages.some((page) => page.href === "/sectors")).toBe(false);
    expect(navPages.some((page) => page.href === "/international")).toBe(false);
    expect(navPages.some((page) => page.href === "/about" && page.group === "about")).toBe(true);
    expect(navPages.some((page) => page.href === "/faq" && page.group === "about")).toBe(true);
    expect(navPages.some((page) => page.href === "/manage" && page.group === "account")).toBe(true);
    expect(navPages.some((page) => page.href === "/signin" && page.group === "account")).toBe(true);
    expect(menuGroups.map((group) => group.id)).toEqual(["account", "daily", "about"]);
    expect(read("src/app/globals.css")).toContain(".site-menu-root--sheet .site-menu");
    expect(read("src/app/globals.css")).toContain("inset: 0");
    expect(read("src/app/globals.css")).not.toContain("max-height: min(72vh, 560px)");
    expect(isOverflowNavPath("/smart-money")).toBe(false);
    expect(isOverflowNavPath("/crowd")).toBe(false);
    expect(isOverflowNavPath("/watchlist")).toBe(false);
    expect(isOverflowNavPath("/sectors")).toBe(false);
    expect(isOverflowNavPath("/international")).toBe(false);
    expect(isOverflowNavPath("/about")).toBe(true);
    expect(isOverflowNavPath("/faq")).toBe(true);
    expect(isOverflowNavPath("/manage")).toBe(true);
    expect(isOverflowNavPath("/signin")).toBe(true);
    expect(isOverflowNavPath("/pulse")).toBe(false);
  });

  it("renders Menu after daily tabs without Smart Money or Watchlist tabs", () => {
    const bar = read("src/components/BottomTabBar.tsx");
    expect(bar).toContain('aria-label="Menu"');
    expect(bar).toContain(">Menu</span>");
    expect(bar).toContain("primaryNavTabs");
    expect(bar).toContain("menuGroups");
    expect(bar).toContain("isOverflowNavPath");
    expect(bar).not.toContain('href: "/watchlist"');
    expect(bar).not.toContain('href: "/smart-money"');
    expect(read("src/components/Portfolio.tsx")).toContain('id: "watchlist"');
    expect(read("src/components/Portfolio.tsx")).toContain("SurfaceSlicer");
    expect(read("src/components/Portfolio.tsx")).not.toContain('label: "Most held"');
    expect(read("src/app/watchlist/page.tsx")).toContain("permanentRedirect");
    expect(read("src/app/globals.css")).toContain(".site-menu");
  });
});
