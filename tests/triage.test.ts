import { describe, expect, it } from "vitest";
import { runTriage, type TriageWatchlistInput } from "@/lib/market/triage";

function makeItem(
  ticker: string,
  overrides: Partial<TriageWatchlistInput> = {},
): TriageWatchlistInput {
  return {
    ticker,
    companyName: ticker,
    price: 100,
    changePercent: 0,
    snapshot: null,
    thesisStatus: null,
    portfolio: { held: false, positionChange: null },
    ...overrides,
  };
}

describe("runTriage", () => {
  it("flags broken thesis as highest priority", () => {
    const result = runTriage([
      makeItem("A", { thesisStatus: "broken" }),
    ]);
    expect(result.hasAlerts).toBe(true);
    expect(result.alerts[0].ticker).toBe("A");
    expect(result.alerts[0].priority).toBe(1);
    expect(result.alerts[0].action).toBe("Review thesis");
  });

  it("flags large decline with deteriorating conviction", () => {
    const result = runTriage([
      makeItem("A", {
        changePercent: -6,
        snapshot: { evidence: { verdict: "mixed", direction: "deteriorating" } } as any,
      }),
    ]);
    expect(result.hasAlerts).toBe(true);
    expect(result.alerts[0].priority).toBeLessThanOrEqual(3);
  });

  it("flags significant price decline", () => {
    const result = runTriage([
      makeItem("A", { changePercent: -8 }),
    ]);
    expect(result.hasAlerts).toBe(true);
    expect(result.alerts[0].priority).toBe(4);
  });

  it("flags deteriorating conviction without decline", () => {
    const result = runTriage([
      makeItem("A", {
        changePercent: 0,
        snapshot: { evidence: { verdict: "mixed", direction: "deteriorating" } } as any,
      }),
    ]);
    expect(result.hasAlerts).toBe(true);
    expect(result.alerts[0].action).toBe("View evidence");
  });

  it("flags thesis review as overdue", () => {
    const result = runTriage([
      makeItem("A", { thesisStatus: "review" }),
    ]);
    expect(result.hasAlerts).toBe(true);
    expect(result.alerts[0].action).toBe("Update thesis");
  });

  it("flags missing evidence data", () => {
    const result = runTriage([
      makeItem("A", { snapshot: null, price: 100 }),
    ]);
    expect(result.hasAlerts).toBe(true);
    expect(result.alerts[0].action).toBe("View evidence");
  });

  it("deduplicates multiple alerts for the same ticker", () => {
    const result = runTriage([
      makeItem("A", { thesisStatus: "broken", changePercent: -10 }),
    ]);
    const aAlerts = result.alerts.filter((a) => a.ticker === "A");
    expect(aAlerts).toHaveLength(1);
  });

  it("returns empty alerts when all items are stable", () => {
    const result = runTriage([
      makeItem("A", { changePercent: 0.5, snapshot: { evidence: { verdict: "positive", direction: "stable" } } as any }),
      makeItem("B", { changePercent: -0.3, snapshot: { evidence: { verdict: "positive", direction: "improving" } } as any }),
    ]);
    expect(result.hasAlerts).toBe(false);
    expect(result.stableCount).toBe(2);
  });

  it("sortes alerts by priority ascending", () => {
    const result = runTriage([
      makeItem("A", { changePercent: -8 }),
      makeItem("B", { thesisStatus: "broken" }),
    ]);
    expect(result.alerts[0].ticker).toBe("B"); // priority 1
    expect(result.alerts[1].ticker).toBe("A"); // priority 4
  });

  it("handles empty input", () => {
    const result = runTriage([]);
    expect(result.hasAlerts).toBe(false);
    expect(result.alerts).toHaveLength(0);
    expect(result.stableCount).toBe(0);
    expect(result.unknownCount).toBe(0);
  });

  it("counts stable and unknown items", () => {
    // item A: stable (valid snapshot, no alert)
    // item B: has snapshot=null and price=null, triggers priority 7 → counts as alert
    const result = runTriage([
      makeItem("A", { changePercent: 0.1, snapshot: { evidence: { verdict: "positive", direction: "stable" } } as any }),
      makeItem("B", { price: null }),
    ]);
    expect(result.stableCount).toBe(1);
    expect(result.unknownCount).toBe(0); // B is an alert, not unknown
    expect(result.alerts.length).toBe(1); // priority 7: missing evidence
  });

  it("never returns NaN or infinity in priority", () => {
    const result = runTriage([
      makeItem("A", { thesisStatus: "broken" }),
      makeItem("B", { changePercent: null }),
    ]);
    for (const alert of result.alerts) {
      expect(isFinite(alert.priority)).toBe(true);
    }
  });
});