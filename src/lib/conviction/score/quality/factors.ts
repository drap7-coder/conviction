/**
 * Build quality factor scores from slow-moving inputs.
 * Ownership base uses who is holding — not the flow direction used by evidence.
 */

import type { EarningsEvidence } from "@/lib/earnings/types";
import type { CompanyFundamentals } from "@/lib/market/fundamentals";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";
import { clampSignedScore } from "../freshness";
import type { QualityFactorId, QualityFactorScore } from "./types";
import { QUALITY_FACTOR_WEIGHTS } from "./weights";

/** Long-horizon / durable capital — quality of who holds, not what they just did. */
const DURABLE_MANAGERS = new Set([
  "Berkshire Hathaway",
  "Baupost Group",
  "Pershing Square Capital Management",
  "Duquesne Family Office",
  "Scion Asset Management",
  "Bridgewater Associates",
]);

/** Faster / trading-oriented managers — still institutional, less quality signal. */
const TRADING_MANAGERS = new Set([
  "Citadel Advisors",
  "Renaissance Technologies",
  "D. E. Shaw",
  "Coatue Management",
  "Tiger Global Management",
  "Lone Pine Capital",
  "Viking Global Investors",
  "Third Point",
  "Soros Fund Management",
]);

function emptyFactor(
  factor: QualityFactorId,
  explanation: string,
): QualityFactorScore {
  return {
    factor,
    score: 0,
    baseWeight: QUALITY_FACTOR_WEIGHTS[factor],
    hasData: false,
    explanation,
  };
}

function scoredFactor(
  factor: QualityFactorId,
  score: number,
  explanation: string,
): QualityFactorScore {
  return {
    factor,
    score: clampSignedScore(score),
    baseWeight: QUALITY_FACTOR_WEIGHTS[factor],
    hasData: true,
    explanation,
  };
}

/** Map a ratio onto [-100, +100] around soft bands. */
function bandScore(
  value: number,
  weak: number,
  strong: number,
): number {
  if (value <= weak) {
    return clampSignedScore(-60 + ((value - weak) / Math.max(weak, 1)) * 40);
  }
  if (value >= strong) {
    return clampSignedScore(40 + Math.min(60, ((value - strong) / strong) * 60));
  }
  const t = (value - weak) / (strong - weak);
  return clampSignedScore(-20 + t * 60);
}

export function scoreMarginMoat(fundamentals: CompanyFundamentals | null): QualityFactorScore {
  if (!fundamentals || fundamentals.status === "unavailable") {
    return emptyFactor("margin_moat", "Margin structure unavailable.");
  }

  const parts: number[] = [];
  if (fundamentals.grossMargin !== null) {
    parts.push(bandScore(fundamentals.grossMargin, 20, 45));
  }
  if (fundamentals.operatingMargin !== null) {
    parts.push(bandScore(fundamentals.operatingMargin, 8, 25));
  }
  if (fundamentals.profitMargin !== null) {
    parts.push(bandScore(fundamentals.profitMargin, 5, 18));
  }

  if (parts.length === 0) {
    return emptyFactor("margin_moat", "Margin ratios unavailable.");
  }

  const score = parts.reduce((sum, part) => sum + part, 0) / parts.length;
  const gm = fundamentals.grossMargin;
  const om = fundamentals.operatingMargin;
  return scoredFactor(
    "margin_moat",
    score,
    `Margins${gm !== null ? ` · gross ${gm.toFixed(0)}%` : ""}${om !== null ? ` · op ${om.toFixed(0)}%` : ""}.`,
  );
}

export function scoreBalanceSheet(fundamentals: CompanyFundamentals | null): QualityFactorScore {
  if (!fundamentals || fundamentals.status === "unavailable") {
    return emptyFactor("balance_sheet", "Balance sheet unavailable.");
  }

  const parts: number[] = [];

  if (fundamentals.afterTaxRoe !== null) {
    parts.push(bandScore(fundamentals.afterTaxRoe, 8, 25));
  }

  const totalDebt =
    (fundamentals.shortTermDebt ?? 0) + (fundamentals.longTermDebt ?? 0);
  if (fundamentals.totalEquity !== null && fundamentals.totalEquity > 0) {
    const debtToEquity = totalDebt / fundamentals.totalEquity;
    // Lower leverage is better for quality; D/E < 0.5 strong, > 2.5 weak.
    if (debtToEquity <= 0.5) parts.push(55);
    else if (debtToEquity <= 1.25) parts.push(25);
    else if (debtToEquity <= 2.5) parts.push(-10);
    else parts.push(-55);
  }

  // Nasdaq current ratio arrives as a percent-like figure (e.g. 89 ≈ 0.89x).
  if (fundamentals.currentRatio !== null) {
    const ratio = fundamentals.currentRatio / 100;
    if (ratio >= 1.5) parts.push(45);
    else if (ratio >= 1) parts.push(15);
    else if (ratio >= 0.75) parts.push(-15);
    else parts.push(-50);
  }

  const liquid =
    (fundamentals.cashAndEquivalents ?? 0) + (fundamentals.shortTermInvestments ?? 0);
  if (liquid > 0 && totalDebt > 0) {
    const coverage = liquid / totalDebt;
    if (coverage >= 0.75) parts.push(40);
    else if (coverage >= 0.35) parts.push(15);
    else if (coverage >= 0.15) parts.push(-10);
    else parts.push(-40);
  }

  if (parts.length === 0) {
    return emptyFactor("balance_sheet", "Balance-sheet ratios unavailable.");
  }

  const score = parts.reduce((sum, part) => sum + part, 0) / parts.length;
  return scoredFactor(
    "balance_sheet",
    score,
    fundamentals.afterTaxRoe !== null
      ? `Balance sheet · after-tax ROE ${fundamentals.afterTaxRoe.toFixed(0)}%.`
      : "Balance sheet strength from leverage and liquidity.",
  );
}

export function scoreFcfStrength(fundamentals: CompanyFundamentals | null): QualityFactorScore {
  if (!fundamentals || fundamentals.status === "unavailable") {
    return emptyFactor("fcf_strength", "Cash-flow statement unavailable.");
  }

  if (fundamentals.freeCashFlow === null) {
    return emptyFactor("fcf_strength", "Free cash flow unavailable.");
  }

  let score: number;
  if (fundamentals.revenue && fundamentals.revenue > 0) {
    const fcfMargin = (fundamentals.freeCashFlow / fundamentals.revenue) * 100;
    score = bandScore(fcfMargin, 2, 15);
  } else if (fundamentals.freeCashFlow > 0) {
    score = 35;
  } else if (fundamentals.freeCashFlow === 0) {
    score = 0;
  } else {
    score = -45;
  }

  const fcfB = fundamentals.freeCashFlow / 1_000_000_000;
  return scoredFactor(
    "fcf_strength",
    score,
    `Free cash flow ${fcfB >= 0 ? "" : "-"}$${Math.abs(fcfB).toFixed(1)}B.`,
  );
}

export function scoreCapitalReturn(fundamentals: CompanyFundamentals | null): QualityFactorScore {
  if (!fundamentals || fundamentals.status === "unavailable") {
    return emptyFactor("capital_return", "Capital-return activity unavailable.");
  }

  if (fundamentals.saleAndPurchaseOfStock === null || fundamentals.revenue === null) {
    return emptyFactor("capital_return", "Buyback / issuance data unavailable.");
  }

  // Negative = net repurchase (shareholder return). Scale vs revenue.
  const netReturnPct =
    (-fundamentals.saleAndPurchaseOfStock / Math.max(fundamentals.revenue, 1)) * 100;

  let score: number;
  if (netReturnPct >= 8) score = 70;
  else if (netReturnPct >= 3) score = 45;
  else if (netReturnPct >= 0.5) score = 20;
  else if (netReturnPct >= -1) score = 0;
  else if (netReturnPct >= -5) score = -35;
  else score = -60;

  const action =
    fundamentals.saleAndPurchaseOfStock < 0
      ? "Net buybacks"
      : fundamentals.saleAndPurchaseOfStock > 0
        ? "Net issuance"
        : "No equity capital return";

  return scoredFactor("capital_return", score, `${action} vs revenue.`);
}

export function scoreEarningsConsistency(
  earnings: EarningsEvidence | null,
): QualityFactorScore {
  if (!earnings || earnings.status === "unavailable" || earnings.history.length === 0) {
    return emptyFactor("earnings_consistency", "Multi-quarter earnings history unavailable.");
  }

  // Prefer beat/miss track record over revisions (revisions are more timing-like).
  const historyScore = earnings.historyScore;
  if (historyScore === null) {
    return emptyFactor("earnings_consistency", "Earnings history could not be scored.");
  }

  const beats = earnings.history.filter((q) => q.actualEps >= q.estimatedEps).length;
  const total = earnings.history.length;
  return scoredFactor(
    "earnings_consistency",
    historyScore,
    `${beats}/${total} recent quarters met or beat estimates.`,
  );
}

export function scoreOwnershipBase(
  results: InstitutionalAccumulation[] | null | undefined,
): QualityFactorScore {
  const holdings = (results ?? []).filter((row) => row.shares > 0);
  if (holdings.length === 0) {
    return emptyFactor(
      "ownership_base",
      "No tracked managers currently holding this name.",
    );
  }

  let durable = 0;
  let trading = 0;
  let other = 0;
  for (const row of holdings) {
    if (DURABLE_MANAGERS.has(row.manager)) durable += 1;
    else if (TRADING_MANAGERS.has(row.manager)) trading += 1;
    else other += 1;
  }

  // Who holds — not whether they just added. Durable capital dominates.
  const score = clampSignedScore(durable * 28 + other * 10 + trading * 4 - 15);
  const names = holdings
    .filter((row) => DURABLE_MANAGERS.has(row.manager))
    .map((row) => row.displayName)
    .slice(0, 3);

  return scoredFactor(
    "ownership_base",
    score,
    names.length > 0
      ? `Durable holders include ${names.join(", ")}.`
      : `${holdings.length} tracked manager${holdings.length === 1 ? "" : "s"} holding.`,
  );
}

export interface BuildQualityFactorsInput {
  fundamentals?: CompanyFundamentals | null;
  earnings?: EarningsEvidence | null;
  institutionalResults?: InstitutionalAccumulation[] | null;
}

export function buildQualityFactors(input: BuildQualityFactorsInput): QualityFactorScore[] {
  return [
    scoreMarginMoat(input.fundamentals ?? null),
    scoreBalanceSheet(input.fundamentals ?? null),
    scoreFcfStrength(input.fundamentals ?? null),
    scoreEarningsConsistency(input.earnings ?? null),
    scoreOwnershipBase(input.institutionalResults),
    scoreCapitalReturn(input.fundamentals ?? null),
  ];
}
