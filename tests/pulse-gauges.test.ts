import { describe, expect, it } from "vitest";
import type { PulseIndicator } from "@/app/api/market/pulse/route";
import {
  normalizeTenYear,
  pulseMacroGauges,
  vixStatus,
  yieldStatus,
} from "@/lib/market/pulse-gauges";

function indicator(overrides: Partial<PulseIndicator> = {}): PulseIndicator {
  return {
    ticker: "^VIX",
    label: "VIX",
    price: 16.4,
    change: -0.8,
    changePercent: -4.6,
    status: "ready",
    isPercentValue: false,
    history: [],
    ...overrides,
  };
}

describe("pulse macro gauges", () => {
  it("classifies VIX 16.4 as CALM and a tiny 10Y move as STEADY", () => {
    expect(vixStatus(16.4)).toEqual({ status: "CALM", tone: "calm" });
    expect(yieldStatus(0.02)).toEqual({ status: "STEADY", tone: "steady" });
    expect(yieldStatus(0.12)).toEqual({ status: "RISING", tone: "elevated" });
    expect(yieldStatus(-0.09)).toEqual({ status: "FALLING", tone: "calm" });
  });

  it("scales Yahoo's 10× 10-year quote down to a percent yield", () => {
    expect(normalizeTenYear(42.8, 0.2)).toEqual({ last: 4.28, change: 0.02 });
    expect(normalizeTenYear(4.28, 0.02)).toEqual({ last: 4.28, change: 0.02 });
  });

  it("returns VIX then 10Y with yesterday captions", () => {
    const cards = pulseMacroGauges([
      indicator({ ticker: "SPY", label: "S&P 500", price: 500, change: 1 }),
      indicator(),
      indicator({
        ticker: "^TNX",
        label: "10Y Yield",
        price: 4.28,
        change: 0.02,
        isPercentValue: true,
      }),
    ]);

    expect(cards.map((card) => card.id)).toEqual(["vix", "yield"]);
    expect(cards[0]).toMatchObject({
      label: "VIX",
      value: "16.4",
      status: "CALM",
      caption: "−0.8 vs. yesterday",
    });
    expect(cards[1]).toMatchObject({
      label: "10Y YIELD",
      value: "4.28%",
      status: "STEADY",
      caption: "+0.02 vs. yesterday",
    });
  });
});
