import { describe, expect, it } from "vitest";
import { buildEvidenceDecisionView, type EvidenceDecisionLane } from "@/lib/conviction/evidence-decision";

function lane(
  id: EvidenceDecisionLane["id"],
  semantic: EvidenceDecisionLane["semantic"],
  status: EvidenceDecisionLane["status"] = "available",
): EvidenceDecisionLane {
  return {
    id,
    label: id,
    semantic,
    status,
    primary: `${id} fact`,
  };
}

describe("evidence decision view", () => {
  it("keeps live disagreement visible instead of averaging it away", () => {
    const view = buildEvidenceDecisionView([
      lane("earnings", "support"),
      lane("institutional", "support"),
      lane("technicals", "against"),
      lane("insider", "quiet", "quiet"),
    ]);

    expect(view.stance).toBe("mixed");
    expect(view.headline).toContain("dissent");
    expect(view.leadingSupport?.id).toBe("earnings");
    expect(view.leadingRisk?.id).toBe("technicals");
    expect(view.coveragePercent).toBe(100);
  });

  it("makes evidence gaps explicit and excludes them from live coverage", () => {
    const view = buildEvidenceDecisionView([
      lane("earnings", "mixed"),
      lane("institutional", "unavailable", "unavailable"),
      lane("technicals", "loading", "loading"),
      lane("short_interest", "quiet", "quiet"),
    ]);

    expect(view.headline).toContain("not earned");
    expect(view.coveredCount).toBe(2);
    expect(view.coveragePercent).toBe(50);
    expect(view.gapLabels).toEqual(["institutional", "technicals"]);
    expect(view.unresolved?.id).toBe("earnings");
  });
});
