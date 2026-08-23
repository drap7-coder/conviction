/**
 * Fit: which Study template the live book is closest to.
 *
 * Primary signal is sleeve mix (U.S. equity / intl / bonds / gold / commodities / cash).
 * Ticker overlap is the tie-break. One primary; a runner-up only when it is within
 * RUNNER_UP_MARGIN points. Never says a manager or ticker "runs the book."
 *
 * Risk profile is a separate question: five standard brokerage buckets. Default
 * from Fit until the user picks. Moves map onto the existing seven Study books —
 * no new templates.
 */

import {
  SAMPLE_PORTFOLIO_BOOKS,
  getSampleBook,
  sampleBookSleeves,
  type SampleBook,
} from "@/lib/portfolio/sample-books";
import {
  mixFromHoldings,
  rankedHoldings,
  scoreSleeveMix,
  tickerOverlap,
  type BookHolding,
} from "@/lib/portfolio/sleeves";

export type RiskProfile =
  | "aggressive-growth"
  | "growth"
  | "growth-income"
  | "defensive"
  | "income";

export const RISK_PROFILES: RiskProfile[] = [
  "aggressive-growth",
  "growth",
  "growth-income",
  "defensive",
  "income",
];

export const RISK_PROFILE_LABELS: Record<RiskProfile, string> = {
  "aggressive-growth": "Aggressive Growth",
  growth: "Growth",
  "growth-income": "Growth + Income",
  defensive: "Defensive",
  income: "Income",
};

export const RISK_PROFILE_BLURBS: Record<RiskProfile, string> = {
  "aggressive-growth": "Max appreciation. Concentrated or high-beta names. You accept big drawdowns.",
  growth: "Core equity and leaders. Diversified, not speculative.",
  "growth-income": "Balanced. Upside plus dividends and cash flow.",
  defensive: "Preserve capital. Low-beta, staples, and cash.",
  income: "Yield first. Aristocrats and fixed income. Low vol.",
};

/** Live hero field — quiet ticket label. The five choices are the product. */
export const RISK_PROFILE_QUESTION = "Risk profile";

/** Moves are conditional on the stated profile. Not a second copy of the chip. */
export function riskProfileMovesLead(profile: RiskProfile): string {
  return `If you mean ${RISK_PROFILE_LABELS[profile]}`;
}

export const FIT_HEDGE = "A description of this book. Not a trade.";

/**
 * Profile → existing Study templates used as move targets.
 * Aggressive Growth and Growth share the Growth book; style (concentrated vs
 * diversified) is applied in sleeve-moves, not a new template.
 */
export const PROFILE_TARGET_IDS: Record<RiskProfile, readonly string[]> = {
  "aggressive-growth": ["growth"],
  growth: ["growth"],
  "growth-income": ["sixty-forty", "three-fund", "dividend"],
  defensive: ["all-weather", "permanent"],
  income: ["dividend", "dogs-of-the-dow", "permanent"],
};

/** Template family used when Fit lands on that book. Growth splits by concentration. */
const TEMPLATE_PROFILE: Record<string, RiskProfile> = {
  "all-weather": "defensive",
  "sixty-forty": "growth-income",
  "three-fund": "growth-income",
  permanent: "defensive",
  "dogs-of-the-dow": "income",
  dividend: "growth-income",
  growth: "growth",
};

const CONCENTRATED_NAME_MARK = 20;
const CONCENTRATED_NAME_COUNT = 5;

export const RUNNER_UP_MARGIN = 8;

export type FitCandidate = {
  id: string;
  label: string;
  score: number;
  sleeveScore: number;
  overlap: number;
  profile: RiskProfile;
};

export type FitResult = {
  primary: FitCandidate | null;
  runnerUp: FitCandidate | null;
  headline: string;
  defaultProfile: RiskProfile | null;
  rankings: FitCandidate[];
};

export function isRiskProfile(value: string | null | undefined): value is RiskProfile {
  return value === "aggressive-growth"
    || value === "growth"
    || value === "growth-income"
    || value === "defensive"
    || value === "income";
}

export function profileForTemplate(id: string): RiskProfile {
  return TEMPLATE_PROFILE[id] ?? "growth";
}

export function classifyFit(holdings: BookHolding[]): FitResult {
  const ranked = rankedHoldings(holdings);
  if (ranked.length === 0) {
    return {
      primary: null,
      runnerUp: null,
      headline: "Waiting on prices.",
      defaultProfile: null,
      rankings: [],
    };
  }

  const mix = mixFromHoldings(ranked);
  const rankings = SAMPLE_PORTFOLIO_BOOKS.map((book) => {
    const sleeves = sampleBookSleeves(book);
    const sleeve = scoreSleeveMix(mix, mixFromHoldings(sleeves));
    const overlap = tickerOverlap(ranked, sleeves);
    return {
      id: book.id,
      label: book.label,
      score: Math.round(sleeve * 0.85 + overlap * 0.15),
      sleeveScore: sleeve,
      overlap,
      profile: profileForTemplate(book.id),
    };
  }).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.overlap !== a.overlap) return b.overlap - a.overlap;
    if (b.sleeveScore !== a.sleeveScore) return b.sleeveScore - a.sleeveScore;
    return templateOrder(a.id) - templateOrder(b.id);
  });

  const primary = rankings[0] ?? null;
  const second = rankings[1] ?? null;
  const runnerUp =
    primary && second && primary.score - second.score <= RUNNER_UP_MARGIN
      ? second
      : null;

  return {
    primary,
    runnerUp,
    headline: primary ? `Looks like ${primary.label}.` : "Waiting on prices.",
    defaultProfile: primary ? defaultProfileFromFit(primary, ranked) : null,
    rankings,
  };
}

export function targetBookForProfile(
  profile: RiskProfile,
  rankings: FitCandidate[],
): SampleBook {
  const ids = PROFILE_TARGET_IDS[profile];
  const best = rankings.find((row) => ids.includes(row.id));
  return getSampleBook(best?.id ?? ids[0]) ?? SAMPLE_PORTFOLIO_BOOKS[0];
}

function defaultProfileFromFit(
  primary: FitCandidate,
  holdings: Array<{ weight: number }>,
): RiskProfile {
  if (primary.id === "growth" && isConcentratedGrowth(holdings)) {
    return "aggressive-growth";
  }
  return primary.profile;
}

function isConcentratedGrowth(holdings: Array<{ weight: number }>): boolean {
  const largest = holdings[0]?.weight ?? 0;
  return largest > CONCENTRATED_NAME_MARK || holdings.length <= CONCENTRATED_NAME_COUNT;
}

function templateOrder(id: string): number {
  const index = SAMPLE_PORTFOLIO_BOOKS.findIndex((book) => book.id === id);
  return index >= 0 ? index : SAMPLE_PORTFOLIO_BOOKS.length;
}
