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

async function loadInsiderTransactions(ticker: string): Promise<{
  transactions: InsiderTransaction[];
  status: "success" | "empty" | "error";
  fetchedAt: string;
}> {
  const fetchedAt = new Date().toISOString();
  try {
    const stored = await getStoredTransactions(ticker);
    if (stored.length > 0) {
      return {
        transactions: stored.map(recordToTx),
        status: "success",
        fetchedAt,
      };
    }

    const result = await withTimeout(fetchInsiderTransactions(ticker), 12_000);
    return {
      transactions: result.allTransactions ?? [],
      status: (result.allTransactions?.length ?? 0) > 0 ? "success" : "empty",
      fetchedAt: result.fetchedAt ?? fetchedAt,
    };
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

  const [institutional, insider, shortInterest, history, quotes, earnings, fundamentals] =
    await Promise.all([
      settled(
        withTimeout(
          getInstitutionalAccumulationForCompany(upper, companyName),
          22_000,
        ),
      ),
      loadInsiderTransactions(upper),
      settled(fetchShortInterestSummary(upper)),
      settled(fetchStockHistory(upper, "1y")),
      settled(fetchStockQuotes([upper])),
      settled(withTimeout(fetchEarningsEvidence(upper), 12_000)),
      settled(withTimeout(fetchCompanyFundamentals(upper), 10_000)),
    ]);

  const quote = quotes?.[0] ?? null;
  const input = buildInput(
    upper,
    institutional,
    insider,
    shortInterest,
    history,
    quote,
  );
  const categories = buildCategoryScores(input);
  const evidence = buildConvictionScore(input);
  const quality = calculateQualityComposite(
    buildQualityFactors({
      fundamentals,
      earnings,
      institutionalResults: institutional?.results ?? [],
    }),
  );
  const blended = blendEvidenceAndQuality(evidence, quality, {
    marketCap: quote?.marketCap ?? null,
  });
  const view = toView(upper, blended, categories);
  setCachedConvictionScore(view);
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
