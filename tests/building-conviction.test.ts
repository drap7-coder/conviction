import { describe, expect, it } from "vitest";
import { getBuildingConvictionItems } from "@/lib/evidence/building-conviction";
import { SOURCE_BADGE_LABEL } from "@/lib/display/vocabulary";

describe("getBuildingConvictionItems", () => {
  it("returns between 3 and 5 items", () => {
    const items = getBuildingConvictionItems();
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.length).toBeLessThanOrEqual(5);
  });

  it("respects an explicit limit within 3–5", () => {
    expect(getBuildingConvictionItems(3).length).toBe(3);
    expect(getBuildingConvictionItems(4).length).toBe(4);
    expect(getBuildingConvictionItems(10).length).toBeLessThanOrEqual(5);
  });

  it("uses the shared intelligence fields on every item", () => {
    for (const item of getBuildingConvictionItems()) {
      expect(item.conclusion.length).toBeGreaterThan(0);
      expect(item.evidence.length).toBeGreaterThan(0);
      expect(item.whyItMatters.length).toBeGreaterThan(0);
      expect(item.dateLabel.length).toBeGreaterThan(0);
      expect(item.sourceLabel.length).toBeGreaterThan(0);
      expect(item.href.startsWith("/")).toBe(true);
    }
  });

  it("leads with a sector rollup when ownership signals exist", () => {
    const items = getBuildingConvictionItems();
    expect(items[0]?.subjectKind).toBe("sector");
    expect(items[0]?.sourceLabel).toBe(SOURCE_BADGE_LABEL.sec_filing);
  });

  it("is deterministic across calls", () => {
    const a = getBuildingConvictionItems(5).map((item) => item.id);
    const b = getBuildingConvictionItems(5).map((item) => item.id);
    expect(a).toEqual(b);
  });

  it("includes company detail links for ticker items", () => {
    const companyItems = getBuildingConvictionItems().filter((item) => item.subjectKind === "company");
    expect(companyItems.length).toBeGreaterThan(0);
    for (const item of companyItems) {
      expect(item.href).toMatch(/^\/companies\/[A-Z0-9.-]+$/);
      expect(item.ticker).toBeTruthy();
    }
  });
});
