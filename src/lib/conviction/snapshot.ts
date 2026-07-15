import { createHash } from "node:crypto";
import type { ConvictionHeader, ConvictionSignalKind } from "@/lib/conviction/header";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";

export const CONVICTION_SNAPSHOT_SCHEMA_VERSION = 1;

export type ConvictionTransitionType =
  | "status_upgrade"
  | "new_signal_type"
  | "manager_breadth_increase"
  | "status_downgrade"
  | "signal_expired";

export interface ConvictionSnapshot {
  ticker: string;
  status: ConvictionHeader["status"];
  confidence: ConvictionHeader["confidence"];
  supportingSignalTypes: ConvictionSignalKind[];
  offsetSignalTypes: ConvictionSignalKind[];
  accumulatingManagerCount: number;
  insiderPurchaseCount: number;
  politicalPurchaseCount: number;
  evidenceFingerprint: string;
  schemaVersion: number;
  createdAt: string;
}

export interface ConvictionTransition {
  id: string;
  ticker: string;
  type: ConvictionTransitionType;
  previousStatus: ConvictionSnapshot["status"];
  currentStatus: ConvictionSnapshot["status"];
  reason: string;
  evidenceFingerprint: string;
  evidenceReferences: string[];
  schemaVersion: number;
  createdAt: string;
}

const STATUS_RANK: Record<ConvictionSnapshot["status"], number> = {
  monitor: 0,
  watch: 1,
  institutional: 2,
  multi: 3,
  broad: 4,
};

function uniqueSorted<T extends string>(values: T[]) {
  return [...new Set(values)].sort();
}

function fingerprintPayload(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 16);
}

function transitionId(ticker: string, type: ConvictionTransitionType, evidenceFingerprint: string) {
  return `${ticker}:${type}:${evidenceFingerprint}`;
}

export function buildConvictionSnapshot({
  ticker,
  header,
  institutionalRows,
  now = new Date(),
}: {
  ticker: string;
  header: ConvictionHeader;
  institutionalRows: InstitutionalAccumulation[];
  now?: Date;
}): ConvictionSnapshot {
  const supportingSignalTypes = uniqueSorted(header.supportingSignals.map((signal) => signal.kind));
  const offsetSignalTypes = uniqueSorted(header.offsets.map((signal) => signal.kind));
  const latestQuarter = institutionalRows
    .map((row) => row.filingQuarter)
    .sort((a, b) => b.localeCompare(a))[0];
  const latestRows = latestQuarter
    ? institutionalRows.filter((row) => row.filingQuarter === latestQuarter)
    : institutionalRows;
  const accumulatingManagerCount = latestRows.filter((row) => row.status === "New" || row.status === "Increased").length;
  const insiderPurchaseSignal = header.supportingSignals.find((signal) => signal.kind === "insider");
  const politicalPurchaseSignal = header.supportingSignals.find((signal) => signal.kind === "political");
  const insiderPurchaseCount = insiderPurchaseSignal ? Number(insiderPurchaseSignal.detail.match(/^\d+/)?.[0] ?? 1) : 0;
  const politicalPurchaseCount = politicalPurchaseSignal ? Number(politicalPurchaseSignal.detail.match(/^\d+/)?.[0] ?? 1) : 0;

  const evidenceFingerprint = fingerprintPayload({
    status: header.status,
    confidence: header.confidence,
    supportingSignalTypes,
    offsetSignalTypes,
    accumulatingManagerCount,
    insiderPurchaseCount,
    politicalPurchaseCount,
  });

  return {
    ticker: ticker.toUpperCase(),
    status: header.status,
    confidence: header.confidence,
    supportingSignalTypes,
    offsetSignalTypes,
    accumulatingManagerCount,
    insiderPurchaseCount,
    politicalPurchaseCount,
    evidenceFingerprint,
    schemaVersion: CONVICTION_SNAPSHOT_SCHEMA_VERSION,
    createdAt: now.toISOString(),
  };
}

export function diffConvictionSnapshots(
  previous: ConvictionSnapshot | null,
  current: ConvictionSnapshot,
): ConvictionTransition | null {
  if (!previous) return null;
  if (previous.schemaVersion !== current.schemaVersion) return null;
  if (previous.evidenceFingerprint === current.evidenceFingerprint) return null;

  const newSignals = current.supportingSignalTypes.filter((signal) => !previous.supportingSignalTypes.includes(signal));
  const expiredSignals = previous.supportingSignalTypes.filter((signal) => !current.supportingSignalTypes.includes(signal));
  const previousRank = STATUS_RANK[previous.status];
  const currentRank = STATUS_RANK[current.status];

  let type: ConvictionTransitionType | null = null;
  let reason = "";

  if (newSignals.length > 0) {
    type = "new_signal_type";
    reason = `New active signal type: ${newSignals.join(", ")}.`;
  } else if (currentRank > previousRank) {
    type = "status_upgrade";
    reason = `${previous.status} upgraded to ${current.status}.`;
  } else if (current.accumulatingManagerCount >= previous.accumulatingManagerCount + 2) {
    type = "manager_breadth_increase";
    reason = `Accumulating manager count increased from ${previous.accumulatingManagerCount} to ${current.accumulatingManagerCount}.`;
  } else if (
    previous.accumulatingManagerCount > 0
    && current.accumulatingManagerCount >= previous.accumulatingManagerCount * 1.5
  ) {
    type = "manager_breadth_increase";
    reason = `Accumulating manager breadth increased by at least 50%.`;
  } else if (expiredSignals.length > 0) {
    type = "signal_expired";
    reason = `Active signal expired: ${expiredSignals.join(", ")}.`;
  } else if (currentRank < previousRank) {
    type = "status_downgrade";
    reason = `${previous.status} downgraded to ${current.status}.`;
  }

  if (!type) return null;

  return {
    id: transitionId(current.ticker, type, current.evidenceFingerprint),
    ticker: current.ticker,
    type,
    previousStatus: previous.status,
    currentStatus: current.status,
    reason,
    evidenceFingerprint: current.evidenceFingerprint,
    evidenceReferences: uniqueSorted([...current.supportingSignalTypes, ...current.offsetSignalTypes]),
    schemaVersion: current.schemaVersion,
    createdAt: current.createdAt,
  };
}
