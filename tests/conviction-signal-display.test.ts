import { describe, expect, it } from "vitest";
import {
  rankConvictionSignals,
  signalDisagreement,
  signalStateLabel,
  signalToneFromScore,
  type ConvictionSignalDisplay,
} from "@/lib/conviction/signal-display";

function signal(
  label: string,
  tone: ConvictionSignalDisplay["tone"],
  strength: number,
  status: ConvictionSignalDisplay["status"] = "available",
): ConvictionSignalDisplay {
  return {
    category: label.toLowerCase().replace(" ", "_") as ConvictionSignalDisplay["category"],
    label,
    tone,
    status,
    headline: label,
    detail: label,
    strength,
  };
}

describe("conviction signal display", () => {
  it("maps score thresholds without surfacing stale or missing data as directional", () => {
    expect(signalToneFromScore(25, true)).toBe("positive");
    expect(signalToneFromScore(-25, true)).toBe("negative");
    expect(signalToneFromScore(24, true)).toBe("neutral");
    expect(signalToneFromScore(80, false)).toBe("unavailable");
    expect(signalToneFromScore(80, true, true)).toBe("unavailable");
  });

  it("detects disagreement only between current bullish and bearish signals", () => {
    expect(signalDisagreement([
      signal("Institutional", "positive", 80),
      signal("Technicals", "negative", 60),
      signal("Earnings", "negative", 90, "stale"),
    ])).toEqual({ positive: ["Institutional"], negative: ["Technicals"] });

    expect(signalDisagreement([
      signal("Institutional", "positive", 80),
      signal("Technicals", "neutral", 10),
    ])).toBeNull();
  });

  it("ranks current signal intensity ahead of stale evidence and excludes missing rows", () => {
    const ranked = rankConvictionSignals([
      signal("Institutional", "positive", 45),
      signal("Technicals", "negative", 80),
      signal("Earnings", "positive", 99, "stale"),
      signal("Political", "unavailable", 0, "unavailable"),
    ]);

    expect(ranked.map((item) => item.label)).toEqual([
      "Technicals",
      "Institutional",
      "Earnings",
    ]);
  });

  it("uses plain-language state labels", () => {
    expect(signalStateLabel(signal("Insider", "positive", 60))).toBe("Bullish");
    expect(signalStateLabel(signal("Insider", "unavailable", 0, "loading"))).toBe("Checking");
    expect(signalStateLabel(signal("Insider", "unavailable", 0, "unavailable"))).toBe("No data");
  });
});
