import { describe, expect, it } from "vitest";
import {
  buildConvictionSnapshot,
  diffConvictionSnapshots,
  type ConvictionSnapshot,
} from "@/lib/conviction/snapshot";
import type { ConvictionHeader } from "@/lib/conviction/header";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";

const now = new Date("2026-07-15T12:00:00Z");

function header(status: ConvictionHeader["status"], signals: Array<"institutional" | "insider" | "political"> = []): ConvictionHeader {
  return {
    status,
    headline: status,
    reason: status,
    confidence: status === "monitor" ? "low" : "medium",
    supportingSignals: signals.map((kind) => ({
      kind,
      label: kind,
      detail: kind === "insider" || kind === "political" ? `1 ${kind} signal` : kind,
    })),
    offsets: [],
    inactiveSignals: [],
  };
}

function manager(name: string, status: InstitutionalAccumulation["status"]): InstitutionalAccumulation {
  return {
    manager: name,
    displayName: name,
    cik: name,
    issuer: "Test",
    classTitle: "COM",
    cusip: name,
    shares: 100,
    previousShares: 50,
    shareChange: status === "Reduced" ? -50 : 50,
    percentageChange: null,
    reportedValue: 1000,
    filingQuarter: "2026-Q2",
    filingDate: "2026-05-15",
    status,
  };
}

function snapshot(
  ticker: string,
  model: ConvictionHeader,
  rows: InstitutionalAccumulation[] = [],
): ConvictionSnapshot {
  return buildConvictionSnapshot({
    ticker,
    header: model,
    institutionalRows: rows,
    now,
  });
}

describe("conviction snapshot diffing", () => {
  it("does not create a transition for initial baseline", () => {
    const current = snapshot("TEST", header("monitor"));
    expect(diffConvictionSnapshots(null, current)).toBeNull();
  });

  it("creates a transition for a genuine status upgrade", () => {
    const previous = snapshot("TEST", header("monitor"));
    const current = snapshot("TEST", header("watch", ["insider"]));
    const transition = diffConvictionSnapshots(previous, current);

    expect(transition?.type).toBe("new_signal_type");
    expect(transition?.previousStatus).toBe("monitor");
    expect(transition?.currentStatus).toBe("watch");
  });

  it("ignores duplicate evidence with the same fingerprint", () => {
    const previous = snapshot("TEST", header("institutional", ["institutional"]), [manager("a", "Increased")]);
    const current = snapshot("TEST", header("institutional", ["institutional"]), [manager("a", "Increased")]);

    expect(diffConvictionSnapshots(previous, current)).toBeNull();
  });

  it("does not publish transitions across schema versions", () => {
    const previous = snapshot("TEST", header("monitor"));
    const current = snapshot("TEST", header("watch", ["insider"]));

    expect(diffConvictionSnapshots({ ...previous, schemaVersion: previous.schemaVersion - 1 }, current)).toBeNull();
  });

  it("detects material manager breadth increase", () => {
    const previous = snapshot("TEST", header("institutional", ["institutional"]), [manager("a", "Increased")]);
    const current = snapshot("TEST", header("institutional", ["institutional"]), [
      manager("a", "Increased"),
      manager("b", "New"),
      manager("c", "Increased"),
    ]);

    expect(diffConvictionSnapshots(previous, current)?.type).toBe("manager_breadth_increase");
  });

  it("detects expired active signal types", () => {
    const previous = snapshot("TEST", header("watch", ["insider"]));
    const current = snapshot("TEST", header("monitor"));

    expect(diffConvictionSnapshots(previous, current)?.type).toBe("signal_expired");
  });
});
