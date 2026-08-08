import { describe, expect, it } from "vitest";
import {
  compositeEvidenceLabel,
  countEvidenceSemantics,
  plainLanguageLaneCopy,
  synthesizeEvidenceRead,
} from "@/lib/conviction/evidence-display";

describe("plainLanguageLaneCopy", () => {
  it("rewrites institutional fund flows into plain language", () => {
    const copy = plainLanguageLaneCopy(
      "institutional",
      "3 adding or opening, 3 trimming or exiting.",
    );
    expect(copy.primary).toBe(
      "3 funds adding or opening new positions, 3 trimming or exiting",
    );
  });

  it("rewrites short interest into cover-days language", () => {
    const copy = plainLanguageLaneCopy(
      "short_interest",
      "SI fell -5.3% · 1.2 DTC",
    );
    expect(copy.primary).toContain("Bets against the stock fell 5.3%");
    expect(copy.primary).toContain("1.2 days");
  });

  it("splits ownership into plain primary and filing secondary", () => {
    const copy = plainLanguageLaneCopy("ownership", "◆ 13G: major passive holder", {
      form: "SC 13G/A",
      filingDate: "Jul 25",
      ownershipTitle: "◆ 13G: major passive holder",
    });
    expect(copy.primary).toMatch(/passive fund/i);
    expect(copy.secondary).toMatch(/Filed Jul 25/);
    expect(copy.secondary).toMatch(/amended/i);
  });
});

describe("composite evidence synthesis", () => {
  it("labels majority support and builds a dynamic sentence", () => {
    const counts = countEvidenceSemantics([
      "support",
      "support",
      "mixed",
      "quiet",
      "against",
    ]);
    expect(compositeEvidenceLabel(counts)).toBe("support");

    const synthesis = synthesizeEvidenceRead([
      { label: "Earnings", semantic: "support" },
      { label: "Technicals", semantic: "support" },
      { label: "Institutional", semantic: "mixed" },
      { label: "Political", semantic: "mixed" },
      { label: "Insider", semantic: "quiet" },
    ]);
    expect(synthesis.toLowerCase()).toContain("earnings");
    expect(synthesis.toLowerCase()).toContain("technicals");
    expect(synthesis.toLowerCase()).toMatch(/bullish|lean/);
    expect(synthesis.toLowerCase()).toMatch(/split|mixed/);
  });
});
