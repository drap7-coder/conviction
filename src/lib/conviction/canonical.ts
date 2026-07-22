/**
 * ── Canonical Orchestrator ──
 *
 * Builds a single ConvictionSnapshot per ticker from raw evidence data,
 * technical analysis, and market quotes. All views consume this.
 *
 * This file is the ONLY place where scoring decisions are made.
 * UI components must never recalculate, reinterpret, or rename the score.
 */

import { calculateConviction, clampScore, SIGNAL_WEIGHTS, type ConvictionSignal } from "./scoring";
import { MODEL_VERSION } from "./model-version";
import { deriveTechnicalState, type StockHistoryPoint } from "@/lib/market/technical-state";
import { getLivePrice } from "@/lib/market/live-quote";
import type { EvidenceEvent } from "@/lib/evidence/types";
import type { PoliticalTradeSummary } from "@/lib/political-trades";
import type { EarningsEvidence } from "@/lib/earnings/types";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";
import type { StockQuote } from "@/lib/market/quotes";
import type {
  ConvictionSnapshot,
  EvidenceAssessment,
  SignalAssessment,
  SignalSentiment,
  EvidenceVerdict,
  EvidenceDirection,
  TechnicalAssessment,
  MarketSessionAssessment,
  EvidenceReference,
  SignalReference,
} from "./canonical-types";

// ── Helpers ──

function sentimentFromScore(score: number | null): SignalSentiment {
  if (score === null) return "unknown";
  if (score >= 30) return "strong_positive";
  if (score >= 15) return "positive";
  if (score <= -30) return "strong_negative";
  if (score <= -15) return "negative";
  return "neutral";
}

function verdictFromScore(score: number): EvidenceVerdict {
  if (score >= 30) return "strong";
  if (score >= 15) return "positive";
  if (score <= -30) return "negative";
  if (score <= -15) return "weak";
  return "mixed";
}

function directionFromSignals(signals: SignalAssessment[]): EvidenceDirection {
  const nonNull = signals.filter((s) => s.score !== null && s.sentiment !== "unknown");
  if (nonNull.length === 0) return "unknown";

  // Compare current scores to a simple freshness-weighted average
  // If recent signals (< 90 days) are more positive than older ones, direction is improving
  const recent = nonNull.filter((s) => s.freshness > 0.5);
  const older = nonNull.filter((s) => s.freshness <= 0.5);

  if (recent.length === 0 || older.length === 0) return "stable";

  const recentAvg = recent.reduce((s, sig) => s + (sig.score ?? 0), 0) / recent.length;
  const olderAvg = older.reduce((s, sig) => s + (sig.score ?? 0), 0) / older.length;

  if (recentAvg - olderAvg > 10) return "improving";
  if (olderAvg - recentAvg > 10) return "deteriorating";
  return "stable";
}

function buildEvidenceReferences(
  events: { id: string; type: string; summary: string; direction: "positive" | "negative" | "neutral"; date: string; strength: number; source: string }[],
): EvidenceReference[] {
  return events.map((e) => ({
    id: e.id,
    type: e.type,
    summary: e.summary,
    direction: e.direction,
    date: e.date,
    strength: e.strength,
    source: e.source,
  }));
}

function computeFreshness(dateStr: string | null): number {
  if (!dateStr) return 0;
  const age = (Date.now() - new Date(dateStr).getTime()) / 86_400_000; // days
  if (age > 365) return 0;
  return Math.max(0, 1 - age / 365);
}

// ── Signal builders ──

function buildInstitutionalSignal(
  data: { results?: InstitutionalAccumulation[]; status?: string } | null,
  now: Date,
): SignalAssessment {
  const usable = data && data.status !== "timeout" && data.status !== "error";
  const rows = data?.results ?? [];
  const gross = rows.reduce((sum, row) => sum + Math.max(row.shares, row.previousShares), 0);
  const net = rows.reduce((sum, row) => sum + row.shareChange, 0);
  const score = usable && gross ? clampScore((net / gross) * 100) : null;

  const latestDate = rows.map((r) => r.filingDate).sort().at(-1) ?? null;
  const freshness = computeFreshness(latestDate);
  const confidence = freshness > 0.5 ? 0.8 : freshness > 0.2 ? 0.5 : 0.2;
  const sentiment = sentimentFromScore(score);

  // Build evidence references from individual manager actions
  const evidenceFor = rows
    .filter((r) => r.status === "New" || r.status === "Increased")
    .slice(0, 5)
    .map((r) => ({
      id: `${r.cik}-${r.filingQuarter}`,
      type: "institutional",
      summary: `${r.displayName} ${r.status === "New" ? "opened" : "increased"} a position (${r.shareChange > 0 ? "+" : ""}${r.shareChange.toLocaleString()} shares)`,
      direction: "positive" as const,
      date: r.filingDate,
      strength: Math.min(1, Math.abs(r.percentageChange ?? 0) / 100),
      source: "SEC 13F",
    }));

  const evidenceAgainst = rows
    .filter((r) => r.status === "Reduced" || r.status === "Exited")
    .slice(0, 5)
    .map((r) => ({
      id: `${r.cik}-${r.filingQuarter}-reduce`,
      type: "institutional",
      summary: `${r.displayName} ${r.status === "Exited" ? "exited" : "reduced"} a position (${r.shareChange > 0 ? "+" : ""}${r.shareChange.toLocaleString()} shares)`,
      direction: "negative" as const,
      date: r.filingDate,
      strength: Math.min(1, Math.abs(r.percentageChange ?? 0) / 100),
      source: "SEC 13F",
    }));

  const summary =
    score === null
      ? "Institutional data unavailable"
      : score > 20
        ? "Multiple managers are accumulating positions"
        : score > 10
          ? "Managers are net buyers"
          : score < -20
            ? "Multiple managers are reducing exposure"
            : score < -10
              ? "Managers are net sellers"
              : "Institutional activity is balanced";

  return {
    sentiment,
    score,
    confidence,
    freshness,
    evidenceFor,
    evidenceAgainst,
    summary,
    updatedAt: latestDate,
  };
}

function buildInsiderSignal(
  data: { events?: EvidenceEvent[]; status?: string; source?: string } | null,
  now: Date,
): SignalAssessment {
  const usable = data && data.status !== "timeout" && data.status !== "error" && data.source !== "error";
  const cutoff = now.getTime() - 90 * 86_400_000;
  const events = (data?.events ?? []).filter(
    (e) => new Date(e.date).getTime() >= cutoff && ["purchase", "sale"].includes(e.metadata?.transactionType ?? ""),
  );
  const buys = events
    .filter((e) => e.metadata?.transactionType === "purchase")
    .reduce((sum, e) => sum + (e.metadata?.totalValue ?? e.metadata?.shares ?? 0), 0);
  const sells = events
    .filter((e) => e.metadata?.transactionType === "sale")
    .reduce((sum, e) => sum + (e.metadata?.totalValue ?? e.metadata?.shares ?? 0), 0);
  const score = usable && buys + sells ? clampScore(((buys - sells) / (buys + sells)) * 100) : null;

  const latestDate = events.map((e) => e.date).sort().at(-1) ?? null;
  const freshness = computeFreshness(latestDate);
  const confidence = freshness > 0.5 ? (events.length >= 3 ? 0.8 : 0.5) : 0.2;

  const evidenceFor = events
    .filter((e) => e.metadata?.transactionType === "purchase")
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      type: "insider",
      summary: `${e.metadata?.insiderName ?? "Insider"} purchased ${e.metadata?.shares?.toLocaleString() ?? "?"} shares`,
      direction: "positive" as const,
      date: e.date,
      strength: e.strength,
      source: "SEC Form 4",
    }));

  const evidenceAgainst = events
    .filter((e) => e.metadata?.transactionType === "sale")
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      type: "insider",
      summary: `${e.metadata?.insiderName ?? "Insider"} sold ${e.metadata?.shares?.toLocaleString() ?? "?"} shares`,
      direction: "negative" as const,
      date: e.date,
      strength: e.strength,
      source: "SEC Form 4",
    }));

  const summary =
    score === null
      ? "Insider data unavailable"
      : score > 10
        ? "Insiders are net buyers"
        : score < -10
          ? "Insiders are net sellers"
          : "Insider activity is neutral";

  return { sentiment: sentimentFromScore(score), score, confidence, freshness, evidenceFor, evidenceAgainst, summary, updatedAt: latestDate };
}

function buildEarningsSignal(data: EarningsEvidence | null, now: Date): SignalAssessment {
  const score = data?.status === "unavailable" ? null : (data?.score ?? null);
  const latestDate = data?.asOf ?? null;
  const freshness = computeFreshness(latestDate);
  const confidence = freshness > 0.5 ? 0.7 : 0.3;

  const evidenceFor: EvidenceReference[] = [];
  const evidenceAgainst: EvidenceReference[] = [];
  if (score !== null) {
    if (score > 0) {
      evidenceFor.push({ id: `${data?.ticker}-earnings`, type: "earnings", summary: "Earnings estimates are trending higher", direction: "positive", date: latestDate ?? new Date().toISOString(), strength: Math.min(1, Math.abs(score) / 100), source: "Nasdaq estimates" });
    } else {
      evidenceAgainst.push({ id: `${data?.ticker}-earnings`, type: "earnings", summary: "Earnings estimates are trending lower", direction: "negative", date: latestDate ?? new Date().toISOString(), strength: Math.min(1, Math.abs(score) / 100), source: "Nasdaq estimates" });
    }
  }

  const summary =
    score == null
      ? "Earnings data unavailable"
      : score > 10
        ? "Earnings momentum is improving"
        : score < -10
          ? "Earnings momentum is weakening"
          : "Earnings momentum is stable";

  return { sentiment: sentimentFromScore(score), score, confidence, freshness, evidenceFor, evidenceAgainst, summary, updatedAt: latestDate };
}

function buildPoliticalSignal(
  data: (PoliticalTradeSummary & { status?: string }) | null,
  now: Date,
): SignalAssessment {
  const usable = data && data.status !== "timeout" && data.status !== "error";
  const buys = data?.totalEstimatedPurchases ?? 0;
  const sells = data?.totalEstimatedSales ?? 0;
  const score = usable && buys + sells ? clampScore(((buys - sells) / (buys + sells)) * 100) : null;

  const latestDate = data?.latestFilingDate ?? null;
  const freshness = computeFreshness(latestDate);
  const confidence = freshness > 0.5 ? 0.6 : 0.2;

  const evidenceFor: EvidenceReference[] = [];
  const evidenceAgainst: EvidenceReference[] = [];
  if (data?.purchases) {
    for (const trade of data.purchases.slice(0, 5)) {
      evidenceFor.push({ id: `pol-${trade.id ?? trade.ticker}-${trade.transactionDate}`, type: "political", summary: `${trade.filerName} disclosed a purchase`, direction: "positive", date: trade.filingDate || trade.transactionDate, strength: 0.5, source: "Political disclosures" });
    }
  }
  if (data?.sales) {
    for (const trade of data.sales.slice(0, 5)) {
      evidenceAgainst.push({ id: `pol-${trade.id ?? trade.ticker}-${trade.transactionDate}-sell`, type: "political", summary: `${trade.filerName} disclosed a sale`, direction: "negative", date: trade.filingDate || trade.transactionDate, strength: 0.5, source: "Political disclosures" });
    }
  }

  const summary =
    score === null
      ? "Political disclosure data unavailable"
      : score > 10
        ? "Political disclosures lean toward buying"
        : score < -10
          ? "Political disclosures lean toward selling"
          : "Political disclosures are neutral";

  return { sentiment: sentimentFromScore(score), score, confidence, freshness, evidenceFor, evidenceAgainst, summary, updatedAt: latestDate };
}

// ── Multi-signal evaluation ──

function evaluateMultiSignal(signals: SignalAssessment[]): {
  qualifies: boolean;
  categories: string[];
  explanation: string;
} {
  const qualifying = signals.filter((s) => {
    if (s.score === null) return false;
    if (s.sentiment !== "positive" && s.sentiment !== "strong_positive") return false;
    if (s.confidence < 0.5) return false;
    if (s.freshness < 0.25) return false; // ~90 days stale threshold
    return true;
  });

  const categoryNames: Record<string, string> = {
    institutional: "institutional activity",
    insider: "insider trading",
    earnings: "earnings momentum",
    political: "political disclosures",
  };

  const categories = qualifying.map((s) => {
    // Find the key by matching score
    if (s.evidenceFor.some((e) => e.source === "SEC 13F")) return categoryNames.institutional;
    if (s.evidenceFor.some((e) => e.source === "SEC Form 4")) return categoryNames.insider;
    if (s.evidenceFor.some((e) => e.source === "Nasdaq estimates")) return categoryNames.earnings;
    if (s.evidenceFor.some((e) => e.source === "Political disclosures")) return categoryNames.political;
    return "unknown";
  }).filter(Boolean);

  const uniqueCategories = [...new Set(categories)];
  const qualifies = uniqueCategories.length >= 2;
  const explanation = qualifies
    ? `Multiple signals align: ${uniqueCategories.join(" and ")} show positive momentum with sufficient freshness and confidence.`
    : "Insufficient qualifying signals for multi-signal status.";

  return { qualifies, categories: uniqueCategories, explanation };
}

// ── Primary signal / risk ──

function primarySignal(signals: SignalAssessment[]): SignalReference | null {
  const sorted = [...signals]
    .filter((s) => s.score !== null && s.score > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  if (sorted.length === 0) return null;
  return { key: "primary", label: "Primary signal", sentiment: sentimentFromScore(sorted[0].score), summary: sorted[0].summary };
}

function primaryRisk(signals: SignalAssessment[]): SignalReference | null {
  const sorted = [...signals]
    .filter((s) => s.score !== null && s.score < 0)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  if (sorted.length === 0) return null;
  return { key: "risk", label: "Primary risk", sentiment: sentimentFromScore(sorted[0].score), summary: sorted[0].summary };
}

// ── Build full EvidenceAssessment ──

function buildEvidenceAssessment(
  raw: {
    institutional: { results?: InstitutionalAccumulation[]; status?: string } | null;
    insider: { events?: EvidenceEvent[]; status?: string; source?: string } | null;
    earnings: EarningsEvidence | null;
    political: (PoliticalTradeSummary & { status?: string }) | null;
  },
  now: Date,
): EvidenceAssessment {
  const signals = {
    institutional: buildInstitutionalSignal(raw.institutional, now),
    insider: buildInsiderSignal(raw.insider, now),
    earnings: buildEarningsSignal(raw.earnings, now),
    political: buildPoliticalSignal(raw.political, now),
  };

  // Feed into the weighted scoring engine
  const signalInputs: ConvictionSignal[] = [
    { key: "institutional", label: "Large investors", weight: SIGNAL_WEIGHTS.institutional, score: signals.institutional.score, asOf: signals.institutional.updatedAt, summary: signals.institutional.summary },
    { key: "insider", label: "Company insiders", weight: SIGNAL_WEIGHTS.insider, score: signals.insider.score, asOf: signals.insider.updatedAt, summary: signals.insider.summary },
    { key: "earnings", label: "Earnings momentum", weight: SIGNAL_WEIGHTS.earnings, score: signals.earnings.score, asOf: signals.earnings.updatedAt, summary: signals.earnings.summary },
    { key: "political", label: "Political disclosures", weight: SIGNAL_WEIGHTS.political, score: signals.political.score, asOf: signals.political.updatedAt, summary: signals.political.summary },
  ];

  const verdict = calculateConviction(signalInputs, now);
  const score = verdict.score ?? 0;
  const allSignalAssessments = Object.values(signals);
  const direction = directionFromSignals(allSignalAssessments);
  const multiSignalStatus = evaluateMultiSignal(allSignalAssessments);

  const supportingSignals: SignalReference[] = allSignalAssessments
    .filter((s) => s.score !== null && s.score > 0)
    .map((s) => ({ key: "supporting", label: "Supporting", sentiment: sentimentFromScore(s.score), summary: s.summary }));

  const conflictingSignals: SignalReference[] = allSignalAssessments
    .filter((s) => s.score !== null && s.score < 0)
    .map((s) => ({ key: "conflicting", label: "Conflicting", sentiment: sentimentFromScore(s.score), summary: s.summary }));

  const updatedAts = allSignalAssessments.map((s) => s.updatedAt).filter(Boolean) as string[];

  return {
    score,
    verdict: verdictFromScore(score),
    direction,
    signals,
    primarySignal: primarySignal(allSignalAssessments),
    primaryRisk: primaryRisk(allSignalAssessments),
    supportingSignals,
    conflictingSignals,
    multiSignalStatus,
    confidence: verdict.confidence === "High" ? 0.85 : verdict.confidence === "Medium" ? 0.6 : 0.3,
    coverage: verdict.coverage,
    summary: verdict.summary,
  };
}

// ── Build full TechnicalAssessment ──

function buildTechnicalAssessment(
  points: StockHistoryPoint[],
  currentPrice: number | null,
  week52High: number | null,
  week52Low: number | null,
  updatedAt: string | null,
): TechnicalAssessment {
  const tech = deriveTechnicalState(points, currentPrice, week52High, week52Low);

  const shortTermTrend: SignalAssessment = {
    sentiment: (tech.shortTermTrend ?? 0) > 0.5 ? "positive" : (tech.shortTermTrend ?? 0) < -0.5 ? "negative" : "neutral",
    score: tech.shortTermTrend !== null ? clampScore(tech.shortTermTrend * 3) : null,
    confidence: points.length >= 6 ? 0.7 : 0.3,
    freshness: 1,
    evidenceFor: [],
    evidenceAgainst: [],
    summary: tech.shortTermTrend !== null
      ? `Short-term trend: ${tech.shortTermTrend > 0 ? "+" : ""}${tech.shortTermTrend.toFixed(2)}% over 5 days`
      : "Insufficient data for short-term trend",
    updatedAt,
  };

  const longTermTrend: SignalAssessment = {
    sentiment: tech.smaCrossRelation === "golden-cross" ? "strong_positive" : tech.smaCrossRelation === "death-cross" ? "strong_negative" : tech.sma50Relation === "above" ? "positive" : tech.sma50Relation === "below" ? "negative" : "neutral",
    score: tech.sma50Delta !== null ? clampScore(tech.sma50Delta * 2) : null,
    confidence: tech.sma50 !== null && tech.sma200 !== null ? 0.8 : 0.2,
    freshness: 1,
    evidenceFor: [],
    evidenceAgainst: [],
    summary: tech.sma50 !== null
      ? `Price is ${tech.sma50Relation ?? "?"} SMA-50 (${tech.sma50Delta?.toFixed(1) ?? "?"}%) and ${tech.sma200Relation ?? "?"} SMA-200 (${tech.sma200Delta?.toFixed(1) ?? "?"}%)`
      : "Insufficient data for long-term trend",
    updatedAt,
  };

  const rangePosition: SignalAssessment = {
    sentiment: (tech.fiftyTwoWeekPercentile ?? 50) > 75 ? "positive" : (tech.fiftyTwoWeekPercentile ?? 50) < 25 ? "negative" : "neutral",
    score: tech.fiftyTwoWeekPercentile !== null ? clampScore((tech.fiftyTwoWeekPercentile - 50) * 2) : null,
    confidence: tech.fiftyTwoWeekPercentile !== null ? 0.7 : 0.1,
    freshness: 1,
    evidenceFor: [],
    evidenceAgainst: [],
    summary: tech.fiftyTwoWeekPercentile !== null
      ? `Price is at the ${Math.round(tech.fiftyTwoWeekPercentile)}th percentile of its 52-week range`
      : "52-week range data unavailable",
    updatedAt,
  };

  return {
    state: tech.label === "Insufficient Data" ? "unknown" : tech.label === "Trend Resisting" || tech.label === "Golden Cross" ? "strong" : tech.label === "Recovering" ? "improving" : tech.label === "Weakening" ? "weakening" : tech.label === "Trend Lagging" || tech.label === "Death Cross" ? "weak" : "mixed",
    shortTermTrend,
    longTermTrend,
    rangePosition,
    price: currentPrice ?? tech.fiftyTwoWeekHigh ?? null,
    previousClose: null, // filled by caller
    sma50: tech.sma50,
    sma200: tech.sma200,
    distanceFromSma50Pct: tech.sma50Delta,
    distanceFromSma200Pct: tech.sma200Delta,
    week52High: tech.fiftyTwoWeekHigh,
    week52Low: tech.fiftyTwoWeekLow,
    rangePositionPct: tech.fiftyTwoWeekPercentile,
    summary: tech.interpretation,
    updatedAt,
  };
}

// ── Build MarketSessionAssessment ──

function buildMarketSessionAssessment(quote: StockQuote): MarketSessionAssessment {
  const live = getLivePrice(quote);

  const session: MarketSessionAssessment["session"] =
    quote.marketState === "PRE"
      ? "pre_market"
      : quote.marketState === "POST" || quote.marketState === "POSTPOST"
        ? "after_hours"
        : quote.marketState === "REGULAR" || quote.marketState === null
          ? "regular"
          : "closed";

  return {
    session,
    displayedPrice: live.price ?? quote.price,
    absoluteChange: live.change ?? quote.change,
    percentChange: live.changePercent ?? quote.changePercent,
    referencePrice: quote.previousClose ?? quote.price,
    referenceLabel: session === "pre_market" ? "Prior close" : session === "after_hours" ? "Regular close" : "Previous close",
    updatedAt: null,
  };
}

// ── Public API ──

export interface BuildSnapshotInput {
  ticker: string;
  institutional: { results?: InstitutionalAccumulation[]; status?: string } | null;
  insider: { events?: EvidenceEvent[]; status?: string; source?: string } | null;
  earnings: EarningsEvidence | null;
  political: (PoliticalTradeSummary & { status?: string }) | null;
  historyPoints: StockHistoryPoint[];
  quote: StockQuote;
  week52High: number | null;
  week52Low: number | null;
  now?: Date;
}

/**
 * Build a complete ConvictionSnapshot from raw evidence, technical, and market data.
 *
 * This is the ONLY function that should be called to produce a conviction assessment.
 * UI components call this once (or receive the result) and never recalculate.
 */
export function buildConvictionSnapshot(input: BuildSnapshotInput): ConvictionSnapshot {
  const now = input.now ?? new Date();
  const nowISO = now.toISOString();

  const evidence = buildEvidenceAssessment(
    {
      institutional: input.institutional,
      insider: input.insider,
      earnings: input.earnings,
      political: input.political,
    },
    now,
  );

  const technical = buildTechnicalAssessment(
    input.historyPoints,
    input.quote.price,
    input.week52High,
    input.week52Low,
    nowISO,
  );

  const market = buildMarketSessionAssessment(input.quote);

  // Collect timestamps
  const signalDates = Object.values(evidence.signals)
    .map((s) => s.updatedAt)
    .filter(Boolean) as string[];
  const evidenceUpdatedAt = signalDates.length > 0 ? signalDates.sort().at(-1) ?? null : null;

  return {
    ticker: input.ticker.toUpperCase(),
    modelVersion: MODEL_VERSION,
    evidence,
    technical,
    market,
    generatedAt: nowISO,
    evidenceUpdatedAt,
    technicalUpdatedAt: nowISO,
    marketUpdatedAt: nowISO,
  };
}