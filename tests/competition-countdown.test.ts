import { describe, expect, it } from "vitest";
import {
  countdownParts,
  formatCountdownShort,
  rivalryCountdownLabel,
  rivalryCountdownPhase,
} from "@/lib/competitions/countdown";

describe("rivalry countdown", () => {
  it("formats short countdown labels", () => {
    const parts = countdownParts(new Date("2026-09-04T12:00:00Z"), new Date("2026-09-01T12:00:00Z"));
    expect(formatCountdownShort(parts)).toBe("3d 0h 00m");
  });

  it("labels lock phase before Monday lock", () => {
    const lockAt = new Date("2026-09-02T13:30:00Z");
    const periodEnd = new Date("2026-09-06T20:00:00Z");
    const now = new Date("2026-09-01T12:00:00Z");
    expect(rivalryCountdownPhase({ lockAt, periodEnd, now })).toBe("lock");
    expect(rivalryCountdownLabel({ lockAt, periodEnd, now })).toMatch(/^Locks in /);
  });

  it("labels settlement phase after lock until period end", () => {
    const lockAt = new Date("2026-09-01T12:00:00Z");
    const periodEnd = new Date("2026-09-06T20:00:00Z");
    const now = new Date("2026-09-03T12:00:00Z");
    expect(rivalryCountdownPhase({ lockAt, periodEnd, now })).toBe("settlement");
    expect(rivalryCountdownLabel({ lockAt, periodEnd, now })).toMatch(/remaining until settlement$/);
  });
});
