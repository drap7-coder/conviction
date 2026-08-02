import { describe, expect, it } from "vitest";
import {
  isInsiderQuietMessage,
  notableSignalNotes,
  qualityHighlightsFromFactors,
  rankConvictionSignals,
  signalDisagreement,
  signalStateLabel,
  signalToneFromScore,
  synthesizeConvictionSignals,
  type ConvictionSignalDisplay,
} from "@/lib/conviction/signal-display";

function signal(
  label: string,
  tone: ConvictionSignalDisplay["tone"],
  strength: number,
  status: ConvictionSignalDisplay["status"] = "available",
  overrides: Partial<ConvictionSignalDisplay> = {},
): ConvictionSignalDisplay {
  return {
    category: (overrides.category
      ?? label.toLowerCase().replace(" ", "_")) as ConvictionSignalDisplay["category"],
    label,
    tone,
    status,
    headline: overrides.headline ?? label,
    detail: overrides.detail ?? label,
    strength,
    ...overrides,
  };
}

describe("conviction signal display", () => {
  it("maps score thresholds aligned with Accumulating/Distribution rings", () => {
    expect(signalToneFromScore(20, true)).toBe("positive");
    expect(signalToneFromScore(-20, true)).toBe("negative");
    expect(signalToneFromScore(19, true)).toBe("neutral");
    expect(signalToneFromScore(80, false)).toBe("unavailable");
    expect(signalToneFromScore(80, true, true)).toBe("unavailable");
  });

  it("detects disagreement only between current bullish and bearish signals", () => {
    expect(signalDisagreement([
      signal("Institutional", "positive", 80),
      signal("Technicals", "negative", 60),
      signal("Earnings", "positive", 90, "stale"),
    ])).toEqual({ positive: ["Institutional"], negative: ["Technicals"] });

    expect(signalDisagreement([
      signal("Institutional", "positive", 80),
      signal("Technicals", "neutral", 10),
    ])).toBeNull();
  });

  it("ranks directional, then informative neutrals, then quiet/stale evidence", () => {
    const ranked = rankConvictionSignals([
      signal("Institutional", "positive", 45, "available", { category: "institutional" }),
      signal("Technicals", "neutral", 15, "available", { category: "technicals" }),
      signal("Insider buying", "neutral", 8, "quiet", { category: "insider" }),
      signal("Short interest", "positive", 99, "stale", { category: "short_interest" }),
      signal("Political", "unavailable", 0, "unavailable"),
    ]);

    expect(ranked.map((item) => item.label)).toEqual([
      "Institutional",
      "Technicals",
      "Insider buying",
      "Short interest",
    ]);
  });

  it("uses plain-language state labels including quiet insider buying", () => {
    expect(signalStateLabel(signal("Insider", "positive", 60))).toBe("Bullish");
    expect(signalStateLabel(signal("Insider", "unavailable", 0, "loading"))).toBe("Checking");
    expect(signalStateLabel(signal("Insider", "unavailable", 0, "unavailable"))).toBe("No data");
    expect(signalStateLabel(signal("Insider buying", "neutral", 8, "quiet"))).toBe("No buying");
  });

  it("recognizes purchases-only empty windows as quiet, not missing", () => {
    expect(isInsiderQuietMessage(
      "No open-market insider purchases in the scoring window (sales ignored).",
    )).toBe(true);
    expect(isInsiderQuietMessage("Insider Form 4 filings could not be loaded.")).toBe(false);
  });

  it("synthesizes a quiet mega-cap read when nothing is directional", () => {
    const synthesis = synthesizeConvictionSignals([
      signal("Institutional", "neutral", 16, "available", {
        category: "institutional",
        headline: "2 adding or opening, 3 trimming or exiting.",
      }),
      signal("Insider buying", "neutral", 8, "quiet", { category: "insider" }),
      signal("Technicals", "neutral", 15, "available", {
        category: "technicals",
        headline: "Below SMA50, above SMA200",
      }),
      signal("Short interest", "neutral", 2, "available", {
        category: "short_interest",
        headline: "Short interest fell -4.8%; 3.5 days to cover.",
      }),
    ]);

    expect(synthesis).toMatch(/Evidence is quiet/i);
    expect(synthesis).toMatch(/no insider buying/i);
    expect(synthesis).toMatch(/institutions mixed/i);
    expect(synthesis).toMatch(/chart soft near-term/i);
  });

  it("surfaces notable notes and quality highlights for context", () => {
    const notes = notableSignalNotes([
      signal("Insider buying", "neutral", 8, "quiet", { category: "insider" }),
      signal("Technicals", "neutral", 15, "available", {
        category: "technicals",
        headline: "Price has fallen below the short-term average while staying above the long-term trend.",
      }),
    ]);
    expect(notes[0]).toMatch(/Insider open-market buying is quiet/i);
    expect(notes.some((note) => /fallen below the short-term/i.test(note))).toBe(true);

    const highlights = qualityHighlightsFromFactors([
      {
        factor: "earnings_consistency",
        score: 100,
        hasData: true,
        explanation: "4/4 recent quarters met or beat estimates.",
      },
      {
        factor: "ownership_base",
        score: -1,
        hasData: true,
        explanation: "Durable holders include Baupost.",
      },
      {
        factor: "capital_return",
        score: 70,
        hasData: true,
        explanation: "Net buybacks vs revenue.",
      },
    ]);
    expect(highlights).toHaveLength(2);
    expect(highlights[0]?.factor).toBe("earnings consistency");
    expect(highlights[1]?.factor).toBe("capital return");
  });
});
