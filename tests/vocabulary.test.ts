import { describe, expect, it } from "vitest";
import {
  EVIDENCE_STRENGTH_LABEL,
  EVIDENCE_STRENGTH_TONE,
  THESIS_STATUS_LABEL,
  USER_PRIORITY_LABEL,
  SOURCE_BADGE_LABEL,
  evidenceStrengthFromCounts,
  sourceBadgeLabel,
} from "@/lib/display/vocabulary";

describe("shared vocabulary", () => {
  it("exposes the four evidence-strength labels", () => {
    expect(EVIDENCE_STRENGTH_LABEL.strong).toBe("Strong");
    expect(EVIDENCE_STRENGTH_LABEL.mixed).toBe("Mixed");
    expect(EVIDENCE_STRENGTH_LABEL.weak).toBe("Weak");
    expect(EVIDENCE_STRENGTH_LABEL.awaiting).toBe("Awaiting Evidence");
  });

  it("maps support/contra counts to evidence strength", () => {
    expect(evidenceStrengthFromCounts(2, 0)).toBe("strong");
    expect(evidenceStrengthFromCounts(1, 1)).toBe("mixed");
    expect(evidenceStrengthFromCounts(0, 2)).toBe("weak");
    expect(evidenceStrengthFromCounts(0, 0)).toBe("awaiting");
  });

  it("keeps tone aligned with evidence strength", () => {
    expect(EVIDENCE_STRENGTH_TONE.strong).toBe("positive");
    expect(EVIDENCE_STRENGTH_TONE.mixed).toBe("contested");
    expect(EVIDENCE_STRENGTH_TONE.weak).toBe("negative");
    expect(EVIDENCE_STRENGTH_TONE.awaiting).toBe("quiet");
  });

  it("exposes thesis, priority, and source vocabularies", () => {
    expect(THESIS_STATUS_LABEL.building).toBe("Building");
    expect(THESIS_STATUS_LABEL.broken).toBe("Broken");
    expect(USER_PRIORITY_LABEL.needs_attention).toBe("Needs Attention");
    expect(SOURCE_BADGE_LABEL.sec_filing).toBe("SEC Filing");
  });

  it("maps provider strings to source badges", () => {
    expect(sourceBadgeLabel("SEC 13F")).toBe("SEC Filing");
    expect(sourceBadgeLabel("FINRA short interest")).toBe("Market Data");
    expect(sourceBadgeLabel("Yahoo Finance RSS")).toBe("Material News");
    expect(sourceBadgeLabel("STOCK Act")).toBe("Congressional Disclosure");
  });
});
