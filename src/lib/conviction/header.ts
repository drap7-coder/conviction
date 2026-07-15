import type { EvidenceEvent } from "@/lib/evidence/types";
import type { PoliticalTrade, PoliticalTradeSummary } from "@/lib/political-trades";
import type { CorporateEventActivitySummary } from "@/lib/sec/corporate-disclosure-activity";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";

export type ConvictionHeaderStatus = "broad" | "multi" | "institutional" | "watch" | "monitor";
export type ConvictionHeaderConfidence = "high" | "medium" | "low";
export type ConvictionSignalKind =
  | "institutional"
  | "insider"
  | "political"
  | "short-interest"
  | "management";

export interface ConvictionSignal {
  kind: ConvictionSignalKind;
  label: string;
  detail: string;
}

export interface ConvictionHeader {
  status: ConvictionHeaderStatus;
  headline: string;
  reason: string;
  confidence: ConvictionHeaderConfidence;
  supportingSignals: ConvictionSignal[];
  offsets: ConvictionSignal[];
  inactiveSignals: ConvictionSignal[];
}

interface ShortInterestInput {
  changePercent: number;
  daysToCover: number;
}

interface BuildConvictionHeaderInput {
  institutionalRows: InstitutionalAccumulation[];
  insiderEvents: EvidenceEvent[];
  politicalSummary: PoliticalTradeSummary | null;
  shortInterest: ShortInterestInput | null;
  corporateActivity: CorporateEventActivitySummary | null;
  now?: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const INSIDER_ACTIVE_DAYS = 90;
const POLITICAL_ACTIVE_DAYS = 180;

function daysSince(value: string, now: Date) {
  const then = new Date(`${value}T12:00:00`).getTime();
  const current = new Date(now);
  current.setHours(12, 0, 0, 0);
  if (!Number.isFinite(then) || !Number.isFinite(current.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((current.getTime() - then) / DAY_MS);
}

function isRecent(value: string, now: Date, days: number) {
  const age = daysSince(value, now);
  return age >= 0 && age <= days;
}

function hasLatestInstitutionalAccumulation(rows: InstitutionalAccumulation[]) {
  const latestQuarter = rows
    .map((row) => row.filingQuarter)
    .sort((a, b) => b.localeCompare(a))[0];
  const latestRows = latestQuarter ? rows.filter((row) => row.filingQuarter === latestQuarter) : rows;
  return latestRows.some((row) => row.status === "New" || row.status === "Increased");
}

function recentInsiderPurchases(events: EvidenceEvent[], now: Date) {
  return events.filter((event) => (
    event.metadata?.transactionType === "purchase"
    && isRecent(event.date, now, INSIDER_ACTIVE_DAYS)
  ));
}

function recentInsiderSales(events: EvidenceEvent[], now: Date) {
  return events.filter((event) => (
    event.metadata?.transactionType === "sale"
    && isRecent(event.date, now, INSIDER_ACTIVE_DAYS)
  ));
}

function recentPoliticalTrades(trades: PoliticalTrade[] | undefined, now: Date) {
  return (trades ?? []).filter((trade) => isRecent(trade.filingDate || trade.transactionDate, now, POLITICAL_ACTIVE_DAYS));
}

export function buildConvictionHeader({
  institutionalRows,
  insiderEvents,
  politicalSummary,
  shortInterest,
  corporateActivity,
  now = new Date(),
}: BuildConvictionHeaderInput): ConvictionHeader {
  const hasInstitutional = hasLatestInstitutionalAccumulation(institutionalRows);
  const insiderPurchases = recentInsiderPurchases(insiderEvents, now);
  const insiderSales = recentInsiderSales(insiderEvents, now);
  const politicalPurchases = recentPoliticalTrades(politicalSummary?.purchases, now);
  const politicalSales = recentPoliticalTrades(politicalSummary?.sales, now);
  const hasInsider = insiderPurchases.length > 0;
  const hasPolitical = politicalPurchases.length > 0;
  const hasShortPressure = Boolean(shortInterest && (shortInterest.changePercent >= 10 || shortInterest.daysToCover >= 5));
  const hasManagementChange = Boolean(corporateActivity?.hasRecentLeadershipCluster);

  const supportingSignals: ConvictionSignal[] = [];
  if (hasInstitutional) {
    supportingSignals.push({
      kind: "institutional",
      label: "Institutional accumulation",
      detail: "Tracked managers opened or increased positions in the latest 13F cycle.",
    });
  }
  if (hasInsider) {
    supportingSignals.push({
      kind: "insider",
      label: "Recent insider purchase",
      detail: `${insiderPurchases.length} open-market purchase${insiderPurchases.length === 1 ? "" : "s"} in the last ${INSIDER_ACTIVE_DAYS} days.`,
    });
  }
  if (hasPolitical) {
    supportingSignals.push({
      kind: "political",
      label: "Recent political purchase",
      detail: `${politicalPurchases.length} disclosed purchase${politicalPurchases.length === 1 ? "" : "s"} filed in the last ${POLITICAL_ACTIVE_DAYS} days.`,
    });
  }

  const offsets: ConvictionSignal[] = [];
  if (insiderSales.length > 0) {
    offsets.push({
      kind: "insider",
      label: "Insider selling present",
      detail: `${insiderSales.length} open-market sale${insiderSales.length === 1 ? "" : "s"} in the last ${INSIDER_ACTIVE_DAYS} days.`,
    });
  }
  if (politicalSales.length > 0) {
    offsets.push({
      kind: "political",
      label: "Political sale present",
      detail: `${politicalSales.length} disclosed sale${politicalSales.length === 1 ? "" : "s"} filed in the last ${POLITICAL_ACTIVE_DAYS} days.`,
    });
  }
  if (hasShortPressure) {
    offsets.push({
      kind: "short-interest",
      label: "Elevated short interest",
      detail: "Short pressure is elevated in the latest FINRA report.",
    });
  }
  if (hasManagementChange) {
    offsets.push({
      kind: "management",
      label: "Leadership changes active",
      detail: corporateActivity?.copy ?? "Recent leadership-change 8-K filings detected.",
    });
  }

  const inactiveSignals: ConvictionSignal[] = [];
  if (!hasInstitutional) {
    inactiveSignals.push({
      kind: "institutional",
      label: "No tracked institutional accumulation",
      detail: "No latest-cycle New or Increased positions among tracked managers.",
    });
  }
  if (!hasInsider) {
    inactiveSignals.push({
      kind: "insider",
      label: "No recent insider purchase",
      detail: `No open-market insider purchase in the last ${INSIDER_ACTIVE_DAYS} days.`,
    });
  }
  if (!hasPolitical) {
    inactiveSignals.push({
      kind: "political",
      label: "No recent political purchase",
      detail: `No disclosed political purchase filed in the last ${POLITICAL_ACTIVE_DAYS} days.`,
    });
  }

  if (hasInstitutional && hasInsider && hasPolitical) {
    return {
      status: "broad",
      headline: "Broad conviction",
      reason: "Institutional accumulation, insider buying, and political purchases align.",
      confidence: "high",
      supportingSignals,
      offsets,
      inactiveSignals,
    };
  }

  if (hasInstitutional && (hasInsider || hasPolitical)) {
    return {
      status: "multi",
      headline: "Multi-signal conviction",
      reason: `Institutional accumulation plus ${hasInsider ? "insider buying" : "political buying"}.`,
      confidence: "high",
      supportingSignals,
      offsets,
      inactiveSignals,
    };
  }

  if (hasInstitutional) {
    return {
      status: "institutional",
      headline: "Institutional conviction",
      reason: "Tracked managers are building positions in the latest 13F cycle.",
      confidence: "medium",
      supportingSignals,
      offsets,
      inactiveSignals,
    };
  }

  if (hasInsider || hasPolitical) {
    return {
      status: "watch",
      headline: "Watchlist conviction",
      reason: "Active insider or political buying exists without tracked institutional accumulation.",
      confidence: "medium",
      supportingSignals,
      offsets,
      inactiveSignals,
    };
  }

  return {
    status: "monitor",
    headline: "No active conviction",
    reason: "No recent institutional, insider, or political conviction signal.",
    confidence: "low",
    supportingSignals,
    offsets,
    inactiveSignals,
  };
}
