import { describe, expect, it } from "vitest";
import { getCardVerdict } from "@/lib/evidence/card-verdict";

const baseEntry = {
  companyName: "Test Company",
  addedAt: "2026-07-01T12:00:00.000Z",
  lastSyncedAt: "2026-07-10T12:00:00.000Z",
  status: "active" as const,
};

describe("card verdict aggregation", () => {
  it("aggregates 13F support and material news contradiction independently from the visible insight", () => {
    const verdict = getCardVerdict({
      ...baseEntry,
      ticker: "IBM",
      companyName: "International Business Machines",
    }, { changePercent: -2 });

    expect(verdict.state).toBe("Weakening");
    expect(verdict.support).toBe(0);
    expect(verdict.contra).toBe(1);
    expect(verdict.insight).toContain("preliminary Q2 revenue");
    expect(verdict.source).toBe("AP");
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
});
