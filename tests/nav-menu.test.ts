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

  it("puts Smart Money, About, Q&A, data management, and authentication in Menu — not Sectors/International", () => {
    expect(menuNavPages.map((page) => page.href)).toEqual([
      "/smart-money",
      "/about",
      "/faq",
      "/manage",
      "/signin",
    ]);
    expect(navPages.some((page) => page.href === "/smart-money" && page.group === "more")).toBe(true);
    expect(navPages.some((page) => page.href === "/sectors")).toBe(false);
    expect(navPages.some((page) => page.href === "/international")).toBe(false);
    expect(navPages.some((page) => page.href === "/about" && page.group === "about")).toBe(true);
    expect(navPages.some((page) => page.href === "/faq" && page.group === "about")).toBe(true);
    expect(navPages.some((page) => page.href === "/manage" && page.group === "account")).toBe(true);
    expect(navPages.some((page) => page.href === "/signin" && page.group === "account")).toBe(true);
    expect(menuGroups.map((group) => group.id)).toEqual(["account", "daily", "more", "about"]);
    expect(read("src/app/globals.css")).toContain(".site-menu-root--sheet .site-menu");
    expect(read("src/app/globals.css")).toContain("inset: 0");
    expect(read("src/app/globals.css")).not.toContain("max-height: min(72vh, 560px)");
    expect(isOverflowNavPath("/smart-money")).toBe(true);
    expect(isOverflowNavPath("/sectors")).toBe(false);
    expect(isOverflowNavPath("/international")).toBe(false);
    expect(isOverflowNavPath("/about")).toBe(true);
    expect(isOverflowNavPath("/faq")).toBe(true);
    expect(isOverflowNavPath("/manage")).toBe(true);
    expect(isOverflowNavPath("/signin")).toBe(true);
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
