/**
 * Fit: which Study template the live book is closest to.
 *
 * Primary signal is sleeve mix (U.S. equity / intl / bonds / gold / commodities / cash).
 * Ticker overlap is the tie-break. One primary; a runner-up only when it is within
 * RUNNER_UP_MARGIN points. Never says a manager or ticker "runs the book."
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

export type BookPosture = "preserve" | "balance" | "grow";

export const BOOK_POSTURES: BookPosture[] = ["preserve", "balance", "grow"];

export const POSTURE_LABELS: Record<BookPosture, string> = {
  preserve: "Preserve",
  balance: "Balance",
  grow: "Grow",
};

/** Posture → templates used as move targets. Dividend / Dogs default Grow but are not extra postures. */
export const POSTURE_TARGET_IDS: Record<BookPosture, readonly string[]> = {
  preserve: ["permanent", "all-weather"],
  balance: ["sixty-forty", "three-fund"],
  grow: ["growth"],
};

const TEMPLATE_POSTURE: Record<string, BookPosture> = {
  "all-weather": "preserve",
  "sixty-forty": "balance",
  "three-fund": "balance",
  permanent: "preserve",
  "dogs-of-the-dow": "grow",
  dividend: "grow",
  growth: "grow",
};

export const RUNNER_UP_MARGIN = 8;

export type FitCandidate = {
  id: string;
  label: string;
  score: number;
  sleeveScore: number;
  overlap: number;
  posture: BookPosture;
};

export type FitResult = {
  primary: FitCandidate | null;
  runnerUp: FitCandidate | null;
  headline: string;
  defaultPosture: BookPosture | null;
  rankings: FitCandidate[];
};

export function isBookPosture(value: string | null | undefined): value is BookPosture {
  return value === "preserve" || value === "balance" || value === "grow";
}

export function postureForTemplate(id: string): BookPosture {
  return TEMPLATE_POSTURE[id] ?? "grow";
}

export function classifyFit(holdings: BookHolding[]): FitResult {
  const ranked = rankedHoldings(holdings);
  if (ranked.length === 0) {
    return {
      primary: null,
      runnerUp: null,
      headline: "Waiting on prices.",
      defaultPosture: null,
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
      posture: postureForTemplate(book.id),
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
    headline: primary ? `Closest to ${primary.label} · ${primary.score}` : "Waiting on prices.",
    defaultPosture: primary?.posture ?? null,
    rankings,
  };
}

export function targetBookForPosture(
  posture: BookPosture,
  rankings: FitCandidate[],
): SampleBook {
  const ids = POSTURE_TARGET_IDS[posture];
  const best = rankings.find((row) => ids.includes(row.id));
  return getSampleBook(best?.id ?? ids[0]) ?? SAMPLE_PORTFOLIO_BOOKS[0];
}

function templateOrder(id: string): number {
  const index = SAMPLE_PORTFOLIO_BOOKS.findIndex((book) => book.id === id);
  return index >= 0 ? index : SAMPLE_PORTFOLIO_BOOKS.length;
}
