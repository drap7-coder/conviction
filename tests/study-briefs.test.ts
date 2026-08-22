import { describe, expect, it } from "vitest";
import { SAMPLE_PORTFOLIO_BOOKS } from "@/lib/portfolio/sample-books";
import { getStudyBrief } from "@/lib/portfolio/study-briefs";

describe("study briefs", () => {
  it("keeps a design brief for every sample book", () => {
    for (const book of SAMPLE_PORTFOLIO_BOOKS) {
      const brief = getStudyBrief(book);
      expect(brief, book.id).toBeTruthy();
      expect(brief!.principle.length).toBeGreaterThan(20);
      expect(brief!.design.length).toBeGreaterThan(20);
      expect(brief!.stress.length).toBeGreaterThan(20);
      expect(brief!.performance.periodLabel.toLowerCase()).toContain("illustrative");
      expect(brief!.sleeves.map((sleeve) => sleeve.ticker)).toEqual(book.tickers);
      expect(brief!.sleeves.every((sleeve) => sleeve.role && sleeve.role !== "Sleeve")).toBe(true);
    }
  });

  it("teaches All-Weather as risk balance, not a concentration failure", () => {
    const book = SAMPLE_PORTFOLIO_BOOKS.find((item) => item.id === "all-weather")!;
    const brief = getStudyBrief(book)!;
    expect(brief.principle.toLowerCase()).toContain("inflation");
    expect(brief.design.toLowerCase()).toContain("bonds");
    expect(brief.sleeves.find((sleeve) => sleeve.ticker === "TLT")?.role.toLowerCase()).toContain("ballast");
    expect(brief.performance.annualizedPct).toBe(7.8);
  });
});
