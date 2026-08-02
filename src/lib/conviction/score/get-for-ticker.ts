/**
 * Server-side Conviction Score loader — the single entry point for every UI.
 *
 * Builds evidence via calculateConvictionScore, quality via
 * calculateQualityComposite, then blends quality-led (~65/35, size-tilted)
 * so Watchlist, Trending, Portfolio, and the company dashboard all show one score.
 */

import { fetchEarningsEvidence } from "@/lib/earnings/fetch";
import { fetchCompanyFundamentals } from "@/lib/market/fundamentals";
import { getInstitutionalAccumulationForCompany } from "@/lib/sec/institutional";
import { fetchShortInterestSummary } from "@/lib/market/short-interest";
import { fetchStockHistory, fetchStockQuotes } from "@/lib/market/quotes";
import { fetchSectorProfile } from "@/lib/market/sector-profile";
import { fetchInsiderTransactions } from "@/lib/sec/client";
import { getStoredTransactions, recordToTx } from "@/lib/sec/persist";
import type { InsiderTransaction } from "@/lib/sec/types";
import { withTimeout } from "@/lib/request-timeout";
import {
  buildCategoryScores,
  buildConvictionScore,
  displayLabelForComposite,
  displayScoreFromSigned,
  formatCoverageSources,
  toneForComposite,
  type BuildConvictionScoreInput,
  type ConvictionDisplayLabel,
} from "./build";
import { getCachedConvictionScore, setCachedConvictionScore } from "./cache";
import { blendEvidenceAndQuality } from "./quality/blend";
import { calculateQualityComposite } from "./quality/calculate";
import { buildQualityFactors } from "./quality/factors";
import type { CategoryScore } from "./types";
import { MIN_COVERAGE, SCORING_VERSION } from "./weights";
import type { ConvictionScoreView } from "./view";

export type { ConvictionScoreView } from "./view";

function evidenceToneFromDisplay(
  label: ConvictionDisplayLabel,
): ConvictionScoreView["evidenceTone"] {
  if (label === "Accumulating") return "positive";
  if (label === "Distribution") return "negative";
  if (label === "Holding") return "contested";
  return "quiet";
}

function ringLabelFromDisplay(
  label: ConvictionDisplayLabel,
): ConvictionScoreView["ringLabel"] {
  return label === "Unavailable" ? "Awaiting" : label;
}

function toView(
  ticker: string,
  blended: ReturnType<typeof blendEvidenceAndQuality>,
  categories: CategoryScore[],
): ConvictionScoreView {
  const displayLabel = displayLabelForComposite(blended.label);
  const displayScore = displayScoreFromSigned(blended.score);
  const sources = formatCoverageSources(blended.evidence.includedCategories);
  const qualitySources = blended.quality.includedFactors
    .map((factor) => factor.replace(/_/g, " "))
    .join(" + ");

  let detail: string;
  if (blended.score === null) {
    detail =
      blended.evidence.coverage < MIN_COVERAGE
        ? `Need more evidence (coverage ${Math.round(blended.evidence.coverage * 100)}% · need ${Math.round(MIN_COVERAGE * 100)}%).`
        : "Insufficient evidence for a conviction score.";
  } else if (blended.blended) {
    detail = `Score ${displayScore}/100 · quality ${displayScoreFromSigned(blended.qualityScore)} + evidence ${displayScoreFromSigned(blended.evidenceScore)}`;
  } else if (blended.qualityScore === null) {
    detail = `Score ${displayScore}/100 · ${sources}`;
  } else {
    detail = `Score ${displayScore}/100 · ${sources}${qualitySources ? ` · quality ${qualitySources}` : ""}`;
  }

  return {
    ticker,
    score: blended.score,
    displayScore,
    label: blended.label,
    displayLabel,
    ringLabel: ringLabelFromDisplay(displayLabel),
    tone: toneForComposite(blended.label),
    evidenceTone: evidenceToneFromDisplay(displayLabel),
    evidenceScore: blended.evidenceScore,
    qualityScore: blended.qualityScore,
    blended: blended.blended,
    coverage: blended.evidence.coverage,
    includedCategories: blended.evidence.includedCategories,
    includedQualityFactors: blended.quality.includedFactors,
    detail,
    categories: categories.map((category) => ({
      category: category.category,
      score: category.score,
      hasData: category.hasData,
      isStale: category.isStale,
      explanation: category.explanation,
    })),
    qualityFactors: blended.quality.factors.map((factor) => ({
      factor: factor.factor,
      score: factor.score,
      hasData: factor.hasData,
      explanation: factor.explanation,
    })),
    scoringVersion: SCORING_VERSION,
  };
}

async function settled<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

type InsiderLoadResult = {
  transactions: InsiderTransaction[];
  status: "success" | "empty" | "error";
  fetchedAt: string;
};

/** Short process cache so parallel 13F work doesn't force repeat Form 4 pulls. */
const insiderLoadCache = new Map<string, { expiresAt: number; value: InsiderLoadResult }>();
const INSIDER_LOAD_CACHE_TTL_MS = 15 * 60 * 1000;

async function fetchInsiderFromSec(ticker: string): Promise<InsiderLoadResult> {
  const fetchedAt = new Date().toISOString();
  // Share the SEC rate-limit queue with institutional 13F work; give Form 4
  // enough room so parallel score loads don't false-fail into "No data".
  const result = await withTimeout(fetchInsiderTransactions(ticker), 28_000);
  return {
    transactions: result.allTransactions ?? [],
    status: (result.allTransactions?.length ?? 0) > 0 ? "success" : "empty",
    fetchedAt: result.fetchedAt ?? fetchedAt,
  };
}

async function loadInsiderTransactions(ticker: string): Promise<InsiderLoadResult> {
  const upper = ticker.toUpperCase();
  const cached = insiderLoadCache.get(upper);
  if (cached && Date.now() <= cached.expiresAt) {
    return cached.value;
  }

  const fetchedAt = new Date().toISOString();
  try {
    const stored = await getStoredTransactions(upper);
    if (stored.length > 0) {
      const value: InsiderLoadResult = {
        transactions: stored.map(recordToTx),
        status: "success",
        fetchedAt,
      };
      insiderLoadCache.set(upper, {
        expiresAt: Date.now() + INSIDER_LOAD_CACHE_TTL_MS,
        value,
      });
      return value;
    }

    try {
      const value = await fetchInsiderFromSec(upper);
      insiderLoadCache.set(upper, {
        expiresAt: Date.now() + INSIDER_LOAD_CACHE_TTL_MS,
        value,
      });
      return value;
    } catch {
      // One retry after a brief pause — first attempt often loses the SEC queue
      // to parallel tracked-manager 13F fetches during score builds.
      await new Promise((resolve) => setTimeout(resolve, 750));
      const value = await fetchInsiderFromSec(upper);
      insiderLoadCache.set(upper, {
        expiresAt: Date.now() + INSIDER_LOAD_CACHE_TTL_MS,
        value,
      });
      return value;
    }
  } catch {
    return { transactions: [], status: "error", fetchedAt };
  }
}

function buildInput(
  ticker: string,
  institutional: Awaited<ReturnType<typeof getInstitutionalAccumulationForCompany>> | null,
  insider: Awaited<ReturnType<typeof loadInsiderTransactions>> | null,
  shortInterest: Awaited<ReturnType<typeof fetchShortInterestSummary>> | null,
  history: Awaited<ReturnType<typeof fetchStockHistory>> | null,
  quote: Awaited<ReturnType<typeof fetchStockQuotes>>[number] | null,
): BuildConvictionScoreInput {
  return {
    ticker,
    marketCap: quote?.marketCap ?? null,
    institutional: institutional
      ? {
          results: institutional.results ?? [],
          status: "success",
          fetchedAt: new Date().toISOString(),
        }
      : {
          results: [],
          status: "error",
          message: "Institutional filings unavailable.",
        },
    insider: insider
      ? {
          transactions: insider.transactions,
          status: insider.status,
          fetchedAt: insider.fetchedAt,
        }
      : {
          transactions: [],
          status: "error",
          message: "Insider Form 4 filings unavailable.",
        },
    technicals: {
      points: history?.points ?? [],
      currentPrice: quote?.price ?? null,
      fiftyTwoWeekHigh: quote?.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: quote?.fiftyTwoWeekLow ?? null,
      fetchedAt: new Date().toISOString(),
    },
    shortInterest: shortInterest
      ? {
          ticker,
          status: shortInterest.status,
          latest: shortInterest.latest,
          fetchedAt: shortInterest.fetchedAt,
        }
      : {
          ticker,
          status: "error",
          latest: null,
          message: "Short interest unavailable.",
        },
  };
}

/**
 * Build the shared Conviction Score for one ticker.
 * Partial source failures become missing categories/factors, not hard errors.
 */
export async function getConvictionScoreForTicker(
  ticker: string,
  options: { companyName?: string; skipCache?: boolean } = {},
): Promise<ConvictionScoreView> {
  const upper = ticker.trim().toUpperCase();
  const companyName = options.companyName?.trim() || upper;

  if (!options.skipCache) {
    const cached = getCachedConvictionScore(upper);
    if (cached) return cached;
  }

  // Resolve Form 4s before the tracked-manager 13F fan-out so purchases-only
  // mega-caps don't false-fail as "No data" while waiting on the SEC queue.
  const insider = await loadInsiderTransactions(upper);

  const [
    institutional,
    shortInterest,
    history,
    quotes,
    profile,
    earnings,
    fundamentals,
  ] = await Promise.all([
    settled(
      withTimeout(
        getInstitutionalAccumulationForCompany(upper, companyName),
        22_000,
      ),
    ),
    settled(fetchShortInterestSummary(upper)),
    settled(fetchStockHistory(upper, "1y")),
    settled(fetchStockQuotes([upper])),
    // Chart meta often omits marketCap — quoteSummary price module is reliable.
    settled(withTimeout(fetchSectorProfile(upper), 6_000)),
    settled(withTimeout(fetchEarningsEvidence(upper), 12_000)),
    settled(withTimeout(fetchCompanyFundamentals(upper), 10_000)),
  ]);

  const quote = quotes?.[0] ?? null;
  const marketCap =
    quote?.marketCap
    ?? history?.marketCap
    ?? profile?.marketCap
    ?? null;
  const input = buildInput(
    upper,
    institutional,
    insider,
    shortInterest,
    history,
    quote ? { ...quote, marketCap } : quote,
  );
  // Ensure size regime sees marketCap even when quote object is null.
  if (input.marketCap == null) input.marketCap = marketCap;
  const categories = buildCategoryScores(input);
  const evidence = buildConvictionScore(input);
  const quality = calculateQualityComposite(
    buildQualityFactors({
      fundamentals,
      earnings,
      institutionalResults: institutional?.results ?? [],
    }),
  );
  const blended = blendEvidenceAndQuality(evidence, quality, { marketCap });
  const view = toView(upper, blended, categories);
  // Don't pin transient SEC/source failures in the 10-minute cache — otherwise
  // mega-caps stick on "No data" for insider after a single rate-limit timeout.
  const hasTransientSourceFailure = view.categories.some((category) =>
    /could not be loaded|filings unavailable|data is unavailable/i.test(
      category.explanation,
    ),
  );
  if (!hasTransientSourceFailure) {
    setCachedConvictionScore(view);
  }
  return view;
}

const DEFAULT_CONCURRENCY = 4;

/**
 * Batch loader with limited concurrency — institutional SEC work is rate-limited.
 */
export async function getConvictionScoresForTickers(
  tickers: Array<string | { ticker: string; companyName?: string }>,
  options: { concurrency?: number } = {},
): Promise<Record<string, ConvictionScoreView>> {
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  const jobs = tickers.map((item) =>
    typeof item === "string"
      ? { ticker: item.toUpperCase(), companyName: item.toUpperCase() }
      : {
          ticker: item.ticker.toUpperCase(),
          companyName: item.companyName ?? item.ticker.toUpperCase(),
        },
  );

  const unique = new Map<string, { ticker: string; companyName: string }>();
  for (const job of jobs) {
    if (!job.ticker) continue;
    if (!unique.has(job.ticker)) unique.set(job.ticker, job);
  }

  const list = [...unique.values()];
  const out: Record<string, ConvictionScoreView> = {};
  let index = 0;

  async function worker() {
    while (index < list.length) {
      const current = list[index++];
      out[current.ticker] = await getConvictionScoreForTicker(current.ticker, {
        companyName: current.companyName,
      });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, list.length || 1) }, () => worker()),
  );
  return out;
}
