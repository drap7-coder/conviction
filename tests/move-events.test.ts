import { describe, expect, it } from "vitest";
import { getMoveEvent } from "@/lib/evidence/move-events";

describe("getMoveEvent", () => {
  it("returns a high-confidence IBM earnings warning catalyst", () => {
    const event = getMoveEvent("ibm");

    expect(event.ticker).toBe("IBM");
    expect(event.category).toBe("earnings-warning");
    expect(event.confidence).toBe("high");
    expect(event.answer).toContain("preliminary Q2 revenue");
    expect(event.sources.length).toBeGreaterThan(0);
  });

  it("returns a medium-confidence APLD company-news catalyst", () => {
    const event = getMoveEvent("APLD");

    expect(event.ticker).toBe("APLD");
    expect(event.category).toBe("company-news");
    expect(event.confidence).toBe("medium");
    expect(event.answer).toContain("debt-funded AI data center expansion");
    expect(event.convictionQuestion).toContain("tracked managers");
  });

  it("falls back honestly when no catalyst is loaded", () => {
    const event = getMoveEvent("OXY", "Occidental Petroleum");

    expect(event.ticker).toBe("OXY");
    expect(event.companyName).toBe("Occidental Petroleum");
    expect(event.category).toBe("no-clear-catalyst");
    expect(event.confidence).toBe("low");
    expect(event.details).toEqual([]);
    expect(event.headline).toBe("No sourced same-day catalyst loaded.");
    expect(event.sources).toEqual([]);
  });
});
