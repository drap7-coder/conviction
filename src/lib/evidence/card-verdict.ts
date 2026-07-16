import { getTickerSignalSummary } from "./signal-summaries";
import type { EvidenceDirection } from "./types";

export interface CardVerdictEntry {
  ticker: string;
  companyName: string;
  addedAt: string;
  lastSyncedAt?: string;
  status: "active" | "unsupported" | "error";
}

export interface CardVerdictQuote {
  changePercent: number | null;
}

export interface CardVerdictShortInterest {
  status?: "success" | "empty" | "unsupported" | "timeout" | "error";
  latest: {
    settlementDate: string;
    currentShortShares: number;
    changeShares: number;
    changePercent: number;
    daysToCover: number;
  } | null;
}

interface CardEvidence {
  id: string;
  text: string;
  date: string;
  direction: EvidenceDirection;
  strength: number;
  supportCount: number;
  contraCount: number;
  provider: string;
}

function daysAgo(value: string | undefined) {
  if (!value) return "No sync yet";
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "No sync yet";
  const days = Math.max(0, Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000)));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function ageDays(value: string | undefined) {
  if (!value) return 365;
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return 365;
  return Math.max(0, Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000)));
}

function topEvidence(evidence: CardEvidence[]) {
  return [...evidence].sort((a, b) => {
    const aScore = a.strength * 100 - Math.min(ageDays(a.date), 90) * 0.5;
    const bScore = b.strength * 100 - Math.min(ageDays(b.date), 90) * 0.5;
    return bScore - aScore || b.date.localeCompare(a.date);
  })[0] ?? null;
}

function formatShares(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function shortInterestEvidence(ticker: string, summary?: CardVerdictShortInterest): CardEvidence | null {
  const latest = summary?.status === "success" ? summary.latest : null;
  if (!latest) return null;

  const isPressureElevated = latest.changePercent >= 10 || latest.daysToCover >= 5;
  const isPressureEasing = latest.changePercent <= -10;
  if (!isPressureElevated && !isPressureEasing) return null;

  const direction: EvidenceDirection = isPressureElevated ? "negative" : "positive";
  const changeText = `${latest.changePercent > 0 ? "+" : ""}${latest.changePercent.toFixed(2)}%`;
  const sharesText = formatShares(latest.currentShortShares);

  return {
    id: `${ticker}-short-interest-${latest.settlementDate}`,
    text: isPressureElevated
      ? `Short interest rose ${changeText} to ${sharesText} shares short.`
      : `Short interest fell ${changeText} to ${sharesText} shares short.`,
    date: latest.settlementDate,
    direction,
    strength: Math.min(0.82, 0.58 + Math.min(Math.abs(latest.changePercent), 40) / 100 + Math.min(latest.daysToCover, 8) / 100),
    supportCount: isPressureEasing ? 1 : 0,
    contraCount: isPressureElevated ? 1 : 0,
    provider: "FINRA short interest",
  };
}

export function getCardEvidence(entry: CardVerdictEntry, shortInterest?: CardVerdictShortInterest): CardEvidence[] {
  const evidence: CardEvidence[] = [];
  const signal = getTickerSignalSummary(entry.ticker);
  if (signal) {
    const direction = signal.direction === "pos" ? "positive" : signal.direction === "neg" ? "negative" : "neutral";
    evidence.push({
      id: `${entry.ticker}-13f`,
      text: signal.cardText,
      date: entry.lastSyncedAt ?? entry.addedAt,
      direction,
      strength: signal.strength ?? (direction === "positive" ? 0.68 : direction === "negative" ? 0.62 : 0.45),
      supportCount: signal.supportCount ?? (direction === "positive" ? 1 : 0),
      contraCount: signal.contraCount ?? (direction === "negative" ? 1 : 0),
      provider: "SEC 13F",
    });
  }

  const shortInterestItem = shortInterestEvidence(entry.ticker, shortInterest);
  if (shortInterestItem) evidence.push(shortInterestItem);

  return evidence;
}

export function getCardVerdict(
  entry: CardVerdictEntry,
  quote?: CardVerdictQuote,
  shortInterest?: CardVerdictShortInterest,
) {
  const evidence = getCardEvidence(entry, shortInterest);
  const support = evidence.reduce((sum, item) => sum + item.supportCount, 0);
  const contra = evidence.reduce((sum, item) => sum + item.contraCount, 0);
  const lead = topEvidence(evidence);
  const quoteMove = quote?.changePercent ?? 0;
  const quoteAdjustment = Math.max(-8, Math.min(8, quoteMove * 1.4));
  const base = support > 0 && contra > 0
    ? 58
    : support > contra
      ? 66 + Math.min(15, support * 3)
      : contra > support
        ? 44 - Math.min(16, contra * 4)
        : 46;
  const strength = Math.max(0, Math.min(99, Math.round(base + quoteAdjustment)));
  const state = support > 0 && contra > 0
    ? "Contested"
    : support > contra
      ? "Strengthening"
      : contra > support
        ? "Weakening"
        : "Quiet";
  const tone = state === "Strengthening"
    ? "positive"
    : state === "Weakening"
      ? "negative"
      : state === "Contested"
        ? "contested"
        : "quiet";

  return {
    state,
    tone,
    strength,
    support,
    contra,
    insight: lead?.text ?? (entry.status !== "active"
      ? "SEC coverage is limited for this issuer."
      : "No high-conviction change cached yet."),
    recency: daysAgo(lead?.date ?? entry.lastSyncedAt ?? entry.addedAt),
    source: lead?.provider ?? (entry.status !== "active" ? "Limited coverage" : "SEC evidence"),
    sortScore: Math.abs(strength - 50) + support * 5 + contra * 6 + Math.abs(quoteMove),
  };
}
