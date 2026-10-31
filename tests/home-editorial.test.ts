import { describe, expect, it } from "vitest";
import { homeChart, marketTakeaway, oilSignalContext, shouldShowOilSignal } from "@/lib/market/home-editorial";

describe("Home editorial evidence", () => {
  it("does not turn missing or invalid quotes into a flat market", () => {
    for (const value of [null, undefined, NaN, Infinity]) {
      expect(marketTakeaway(value)).toBe("The market picture is still coming together.");
    }
    expect(marketTakeaway(0)).toBe("U.S. stocks are little changed.");
    expect(marketTakeaway(.4)).toBe("U.S. stocks are moving higher.");
    expect(marketTakeaway(-.4)).toBe("U.S. stocks are moving lower.");
  });
  it("does not fabricate a chart from missing, invalid or single-time data", () => {
    expect(homeChart([])).toBeNull();
    expect(homeChart([{ date: "invalid", close: 10 }])).toBeNull();
    expect(homeChart([{ date: "2026-10-28T12:00:00Z", close: 10 }, { date: "2026-10-28T12:00:00Z", close: 11 }])).toBeNull();
  });
  it("orders actual timestamps and spaces gaps by elapsed time", () => {
    const chart = homeChart([
      { date: "2026-10-28T16:00:00Z", close: 120 },
      { date: "2026-10-28T12:00:00Z", close: 100 },
      { date: "2026-10-28T13:00:00Z", close: 110 },
      { date: "2026-10-28T14:00:00Z", close: NaN },
    ]);
    expect(chart?.path).toBe("M0.00 90.00 L25.00 50.00 L100.00 10.00");
    expect(chart?.low).toBe(100);
    expect(chart?.high).toBe(120);
  });
  it("centers flat prices instead of drawing a misleading bottomed-out chart", () => {
    expect(homeChart([{ date: "2026-10-28T12:00:00Z", close: 100 }, { date: "2026-10-28T13:00:00Z", close: 100 }])?.path).toBe("M0.00 50.00 L100.00 50.00");
  });
  it("only promotes oil when the move or divergence is material", () => {
    expect(shouldShowOilSignal(null, 0)).toBe(false);
    expect(shouldShowOilSignal(1.2, 0.4)).toBe(false);
    expect(shouldShowOilSignal(2, 0.4)).toBe(true);
    expect(shouldShowOilSignal(1.2, -1.4)).toBe(true);
  });
  it("describes divergence without claiming a cause", () => {
    expect(oilSignalContext(2.4, -0.5)).toContain("while stocks move the other way");
    expect(oilSignalContext(2.4, 0.5)).toBe("Oil is making a material session move.");
  });
});

import { briefingEdition, briefingLead } from "@/lib/market/home-editorial";
describe("publication timing", () => {
  it("uses Eastern date across UTC midnight and identifies weekends", () => {
    expect(briefingEdition(new Date("2026-11-01T01:00:00Z"))).toEqual({iso:"2026-10-31",label:"Saturday, October 31, 2026",weekend:true});
    expect(briefingEdition(new Date("2026-11-02T15:00:00Z")).weekend).toBe(false);
  });
  it("describes available sessions without inventing a cause or current trading", () => {
    expect(briefingLead(.19,"After Hours")).toBe("S&P 500 proxy edges higher in the after-hours snapshot.");
    expect(briefingLead(-1.2,"Closed")).toBe("S&P 500 proxy falls in the latest completed session.");
    expect(briefingLead(null,"Regular")).toBe("The market picture is still coming together.");
  });
});
