import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  personalOwnershipLabel,
  personalTrackingBadges,
} from "@/lib/personal-marker";
import { INSTITUTIONAL_MANAGERS } from "@/lib/sec/institutional-managers";
import { findInstitutionalManager } from "@/lib/sec/institutional";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("personalOwnershipLabel", () => {
  it("returns compact Owned / Watched pills for Crowd", () => {
    const book = new Set(["NVDA", "AAPL"]);
    const watch = new Set(["NVDA", "HOOD"]);
    expect(personalOwnershipLabel("nvda", book, watch)).toBe("Owned & Watched");
    expect(personalOwnershipLabel("AAPL", book, watch)).toBe("Owned");
    expect(personalOwnershipLabel("HOOD", book, watch)).toBe("Watched");
    expect(personalOwnershipLabel("MSFT", book, watch)).toBeNull();
  });
});

describe("personalTrackingBadges", () => {
  it("returns dual In your book / In your watchlist chips", () => {
    const book = new Set(["BRK.B", "AAPL"]);
    const watch = new Set(["AAPL", "TSLA"]);
    expect(personalTrackingBadges("aapl", book, watch)).toEqual([
      { id: "book", label: "In your book" },
      { id: "watch", label: "In your watchlist" },
    ]);
    expect(personalTrackingBadges("BRK.B", book, watch)).toEqual([
      { id: "book", label: "In your book" },
    ]);
    expect(personalTrackingBadges("tsla", book, watch)).toEqual([
      { id: "watch", label: "In your watchlist" },
    ]);
    expect(personalTrackingBadges("MSFT", book, watch)).toEqual([]);
  });
});

describe("institutional manager universe", () => {
  it("includes tier-1 activists and macro filers", () => {
    const names = INSTITUTIONAL_MANAGERS.map((manager) => manager.displayName);
    expect(names).toContain("Berkshire Hathaway");
    expect(names).toContain("Icahn Enterprises");
    expect(names).toContain("Greenlight Capital");
    expect(names).toContain("Point72");
    expect(names).toContain("Oaktree Capital");
    expect(names).toContain("ARK Invest");
  });

  it("resolves new managers by CIK and display name", () => {
    expect(findInstitutionalManager("0000921669")?.displayName).toBe("Icahn Enterprises");
    expect(findInstitutionalManager("greenlight capital")?.cik).toBe("0001079114");
    expect(findInstitutionalManager("Point72")?.cik).toBe("0001603466");
    expect(findInstitutionalManager("oaktree-capital")?.cik).toBe("0000949509");
    expect(findInstitutionalManager("ARK Invest")?.cik).toBe("0001697748");
  });

  it("wires Smart Money panels to personal badges and pill manager slicer", () => {
    const institutions = read("src/app/components/InvestorBookPanel.tsx");
    const politicians = read("src/app/components/PoliticiansMovesPanel.tsx");
    expect(institutions).toContain("personalTrackingBadges");
    expect(institutions).toContain("investor-manager-slicer");
    expect(institutions).toContain("SurfaceSlicer");
    expect(institutions).toContain("smart-money-stat-chip");
    expect(politicians).toContain("personalTrackingBadges");
    expect(politicians).toContain("SurfaceSlicer");
    expect(politicians).toContain("sm-you-chip");
  });
});
