import { describe, expect, it } from "vitest";
import {
  compositeEvidenceLabel,
  countEvidenceSemantics,
  partitionEvidenceLanes,
  plainLanguageLaneCopy,
  synthesizeEvidenceRead,
} from "@/lib/conviction/evidence-display";

describe("plainLanguageLaneCopy", () => {
  it("rewrites institutional fund flows into plain language", () => {
    const copy = plainLanguageLaneCopy(
      "institutional",
      "3 adding or opening, 3 trimming or exiting.",
    );
    expect(copy.primary).toBe("3 funds adding, 3 trimming");
  });

  it("rewrites short interest into cover-days language", () => {
    const copy = plainLanguageLaneCopy(
      "short_interest",
      "SI fell -5.3% · 1.2 DTC",
    );
    expect(copy.primary).toContain("Short interest fell 5.3%");
    expect(copy.primary).toContain("1.2 days to cover");
  });

  it("splits ownership into plain primary and filing secondary", () => {
    const copy = plainLanguageLaneCopy("ownership", "◆ 13G: major passive holder", {
      form: "SC 13G/A",
      filingDate: "Jul 25",
      ownershipTitle: "◆ 13G: major passive holder",
    });
    expect(copy.primary).toMatch(/passive holder/i);
    expect(copy.secondary).toMatch(/Jul 25/);
    expect(copy.secondary).toMatch(/amended/i);
  });
});

describe("composite evidence synthesis", () => {
  it("does not treat unavailable as quiet", () => {
    const counts = countEvidenceSemantics([
      "support",
      "unavailable",
      "quiet",
    ]);
    expect(counts.quiet).toBe(1);
    expect(counts.unavailable).toBe(1);
    expect(compositeEvidenceLabel(counts)).toBe("support");
  });

  it("builds a dynamic sentence from directional lanes", () => {
    const synthesis = synthesizeEvidenceRead([
      { label: "Earnings", semantic: "support" },
      { label: "Trend", semantic: "support" },
      { label: "Funds", semantic: "mixed" },
      { label: "Congress", semantic: "mixed" },
      { label: "Insiders", semantic: "quiet" },
    ]);
    expect(synthesis.toLowerCase()).toContain("earnings");
    expect(synthesis.toLowerCase()).toContain("trend");
    expect(synthesis.toLowerCase()).toMatch(/bullish|lean/);
    expect(synthesis.toLowerCase()).toMatch(/mixed/);
  });

  it("partitions quiet and unavailable away from active lanes", () => {
    const { active, quiet } = partitionEvidenceLanes([
      { id: "a", semantic: "support" as const },
      { id: "b", semantic: "quiet" as const },
      { id: "c", semantic: "unavailable" as const },
      { id: "d", semantic: "mixed" as const },
    ]);
    expect(active.map((lane) => lane.id)).toEqual(["a", "d"]);
    expect(quiet.map((lane) => lane.id)).toEqual(["b", "c"]);
  });
});
