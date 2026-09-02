/**
 * Minimal types for persisted conviction transitions (read-only feed).
 * Snapshot builders and deep evidence cascade are retired.
 */

export type ConvictionTransitionType =
  | "status_upgrade"
  | "new_signal_type"
  | "manager_breadth_increase"
  | "status_downgrade"
  | "signal_expired";

export type ConvictionSnapshotStatus =
  | "monitor"
  | "watch"
  | "institutional"
  | "multi"
  | "broad";

export interface ConvictionSnapshot {
  ticker: string;
  status: ConvictionSnapshotStatus;
  confidence: "high" | "medium" | "low";
  supportingSignalTypes: string[];
  offsetSignalTypes: string[];
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
  previousStatus: ConvictionSnapshotStatus;
  currentStatus: ConvictionSnapshotStatus;
  reason: string;
  evidenceFingerprint: string;
  evidenceReferences: string[];
  schemaVersion: number;
  createdAt: string;
}
