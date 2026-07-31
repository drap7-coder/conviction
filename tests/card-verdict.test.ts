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

    expect(verdict.state).toBe("Strong");
    expect(verdict.evidenceStrength).toBe("strong");
    expect(verdict.support).toBe(3);
    expect(verdict.contra).toBe(0);
    expect(verdict.insight).toContain("2 big funds opened new stakes");
    expect(verdict.source).toBe("SEC 13F");
  });

  it("uses explicit 13F evidence counts instead of parsing the display sentence", () => {
    const verdict = getCardVerdict({
      ...baseEntry,
      ticker: "INTC",
      companyName: "Intel Corporation",
    }, { changePercent: 4.5 });

    expect(verdict.state).toBe("Strong");
    expect(verdict.evidenceStrength).toBe("strong");
    expect(verdict.support).toBe(3);
    expect(verdict.contra).toBe(0);
    expect(verdict.insight).toBe("2 big funds opened new stakes and 1 added shares.");
    expect(verdict.source).toBe("SEC 13F");
  });

  it("keeps the card awaiting evidence when no qualifying provider evidence exists", () => {
    const verdict = getCardVerdict({
      ...baseEntry,
      ticker: "XYZ",
      companyName: "Unknown Company",
    }, { changePercent: 0 });

    expect(verdict.state).toBe("Awaiting Evidence");
    expect(verdict.evidenceStrength).toBe("awaiting");
    expect(verdict.support).toBe(0);
    expect(verdict.contra).toBe(0);
    expect(verdict.strength).toBeNull();
    expect(verdict.insight).toBe("No ownership or short-interest change loaded yet.");
  });

  it("does not invent a low score from a down day when ownership evidence is missing", () => {
    const verdict = getCardVerdict({
      ...baseEntry,
      ticker: "AAPL",
      companyName: "Apple Inc.",
    }, { changePercent: -6.2 });

    expect(verdict.state).toBe("Awaiting Evidence");
    expect(verdict.strength).toBeNull();
    expect(verdict.tone).toBe("quiet");
  });

  it("scores ownership evidence without tilting by the daily quote", () => {
    const down = getCardVerdict({
      ...baseEntry,
      ticker: "INTC",
      companyName: "Intel Corporation",
    }, { changePercent: -8 });
    const up = getCardVerdict({
      ...baseEntry,
      ticker: "INTC",
      companyName: "Intel Corporation",
    }, { changePercent: 8 });

    expect(down.strength).toBe(75);
    expect(up.strength).toBe(75);
    expect(down.state).toBe("Strong");
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

    expect(verdict.state).toBe("Weak");
    expect(verdict.evidenceStrength).toBe("weak");
    expect(verdict.support).toBe(0);
    expect(verdict.contra).toBe(1);
    expect(verdict.insight).toBe("Short interest rose +16.12% to 60.0M shares short.");
    expect(verdict.source).toBe("FINRA short interest");
  });
});
