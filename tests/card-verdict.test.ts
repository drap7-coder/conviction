import { describe, expect, it } from "vitest";
import { getCardVerdict } from "@/lib/evidence/card-verdict";

const baseEntry = {
  companyName: "Test Company",
  addedAt: "2026-07-01T12:00:00.000Z",
  lastSyncedAt: "2026-07-10T12:00:00.000Z",
  status: "active" as const,
};

describe("card verdict aggregation", () => {
  it("aggregates 13F support and short interest contradiction independently from the visible insight", () => {
    const verdict = getCardVerdict({
      ...baseEntry,
      ticker: "INTC",
      companyName: "Intel Corporation",
    }, { changePercent: -2 });

    expect(verdict.state).toBe("Strengthening");
    expect(verdict.support).toBe(3);
    expect(verdict.contra).toBe(0);
    expect(verdict.insight).toContain("2 new tracked-manager");
    expect(verdict.source).toBe("SEC 13F");
  });

  it("uses explicit 13F evidence counts instead of parsing the display sentence", () => {
    const verdict = getCardVerdict({
      ...baseEntry,
      ticker: "INTC",
      companyName: "Intel Corporation",
    }, { changePercent: 4.5 });

    expect(verdict.state).toBe("Strengthening");
    expect(verdict.support).toBe(3);
    expect(verdict.contra).toBe(0);
    expect(verdict.insight).toBe("2 new tracked-manager positions and 1 increase detected.");
    expect(verdict.source).toBe("SEC 13F");
  });

  it("keeps the card quiet when no qualifying provider evidence exists", () => {
    const verdict = getCardVerdict({
      ...baseEntry,
      ticker: "XYZ",
      companyName: "Unknown Company",
    }, { changePercent: 0 });

    expect(verdict.state).toBe("Quiet");
    expect(verdict.support).toBe(0);
    expect(verdict.contra).toBe(0);
    expect(verdict.insight).toBe("No high-conviction change cached yet.");
  });

  it("reflects elevated short interest as a homepage contradiction", () => {
    const verdict = getCardVerdict({
      ...baseEntry,
      ticker: "WEN",
      companyName: "Wendy's Co",
    }, { changePercent: 0 }, {
      status: "success",
      latest: {
        settlementDate: "2026-06-30",
        currentShortShares: 59_995_573,
        changeShares: 8_326_648,
        changePercent: 16.12,
        daysToCover: 1.19,
      },
    });

    expect(verdict.state).toBe("Weakening");
    expect(verdict.support).toBe(0);
    expect(verdict.contra).toBe(1);
    expect(verdict.insight).toBe("Short interest rose +16.12% to 60.0M shares short.");
    expect(verdict.source).toBe("FINRA short interest");
  });
});
