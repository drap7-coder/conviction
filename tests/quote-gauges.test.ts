import { describe, expect, it } from "vitest";
import {
  rangePosition,
  scoreInstitutionalConviction,
  volumeVsAverage,
} from "@/lib/market/quote-gauges";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";

function row(
  status: InstitutionalAccumulation["status"],
  shareChange = 0,
): InstitutionalAccumulation {
  return {
    manager: "Test",
    displayName: "Test Manager",
    cik: "0001",
    issuer: "Apple",
    classTitle: "COM",
    cusip: "037833100",
    shares: 1000,
    previousShares: 1000 - shareChange,
    shareChange,
    percentageChange: null,
    reportedValue: 1_000_000,
    filingQuarter: "2025Q2",
    filingDate: "2025-08-14",
    status,
  };
}

describe("quote-gauges", () => {
  it("positions price within a range", () => {
    expect(rangePosition(75, 50, 100)).toBe(50);
    expect(rangePosition(100, 50, 100)).toBe(100);
    expect(rangePosition(null, 50, 100)).toBeNull();
  });

  it("scores volume as percent of average", () => {
    expect(volumeVsAverage(87, 100)).toBe(87);
    expect(volumeVsAverage(200, 100)).toBe(200);
    expect(volumeVsAverage(10, 0)).toBeNull();
  });

  it("scores institutional accumulation as green", () => {
    const conviction = scoreInstitutionalConviction([
      row("New", 500_000),
      row("Increased", 250_000),
      row("Increased", 100_000),
    ]);
    expect(conviction.score).toBeGreaterThanOrEqual(60);
    expect(conviction.tone).toBe("green");
    expect(conviction.label).toBe("Accumulating");
    expect(conviction.newPositions).toBe(1);
    expect(conviction.added).toBe(2);
  });

  it("scores institutional distribution as red", () => {
    const conviction = scoreInstitutionalConviction([
      row("Reduced", -400_000),
      row("Exited", -800_000),
    ]);
    expect(conviction.score).toBeLessThanOrEqual(40);
    expect(conviction.tone).toBe("red");
    expect(conviction.label).toBe("Distribution");
  });
});
