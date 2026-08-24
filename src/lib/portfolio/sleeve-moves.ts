/**
 * Concrete moves toward a Study template.
 * Trim names an existing holding. Add fills a missing category with a
 * representative ETF — never an individual common stock as a buy.
 *
 * Aggressive Growth uses the Growth book but accepts concentration
 * (35% mark, no equal-weight trims). Other profiles use the 20% mark.
 */

import { getMarketInstrument } from "@/lib/market/market-instruments";
import type { RiskProfile } from "@/lib/portfolio/fit";
import { sampleBookSleeves, type SampleBook } from "@/lib/portfolio/sample-books";
import { rankedHoldings, type BookHolding } from "@/lib/portfolio/sleeves";

export type SleeveMoveAction = "trim" | "add" | "keep";

export type SleeveMove = {
  ticker: string;
  action: SleeveMoveAction;
  deltaPt: number;
  label: string;
  why: string;
  /** Missing-sleeve category for Add rows. Trim/Keep leave this unset. */
  category?: string;
};

/** Add instrument for growth-book gaps (AAPL / MSFT / … → one category). */
const GROWTH_ADD_ETF = "QQQ";
/** Add instrument for dividend / Dogs gaps (JNJ / VZ / … → one category). */
const YIELD_ADD_ETF = "SCHD";

const CONCENTRATION_MARK = 20;
const AGGRESSIVE_MARK = 35;
const MIN_GAP = 5;
const MIN_TRIM = 3;

const GROWTH_NAMES = new Set([
  "AAPL", "MSFT", "NVDA", "AMZN", "GOOG", "GOOGL", "META", "AVGO", "NFLX", "CRM", "COST", "TSLA",
]);

export function generateSleeveMoves(
  holdings: BookHolding[],
  target: SampleBook,
  limit = { min: 2, max: 4 },
  profile?: RiskProfile,
): SleeveMove[] {
  const ranked = rankedHoldings(holdings);
  if (ranked.length === 0) return [];

  const aggressive = profile === "aggressive-growth";
  const mark = aggressive ? AGGRESSIVE_MARK : CONCENTRATION_MARK;
  const targetSleeves = sampleBookSleeves(target);
  const targetMap = new Map(targetSleeves.map((sleeve) => [sleeve.ticker.toUpperCase(), sleeve.weight]));
  const currentMap = new Map(ranked.map((row) => [row.ticker, row.weight]));

  const trims: SleeveMove[] = [];
  const adds: SleeveMove[] = [];
  const keeps: SleeveMove[] = [];

  for (const row of ranked) {
    const targetWeight = targetMap.get(row.ticker);
    const onTarget = targetWeight != null && Math.abs(row.weight - targetWeight) < MIN_GAP;

    if (onTarget) continue;

    if (row.weight > mark && (targetWeight == null || targetWeight < mark)) {
      const delta = Math.round(row.weight - mark);
      if (delta >= MIN_TRIM) {
        trims.push({
          ticker: row.ticker,
          action: "trim",
          deltaPt: -delta,
          label: `Trim ${row.ticker}`,
          why: concentrationWhy(row.ticker, row.weight, aggressive),
        });
        continue;
      }
    }

    if (!aggressive && targetWeight != null && row.weight - targetWeight >= MIN_GAP) {
      const delta = Math.round(row.weight - targetWeight);
      trims.push({
        ticker: row.ticker,
        action: "trim",
        deltaPt: -delta,
        label: `Trim ${row.ticker}`,
        why: `${row.ticker} is ${pct(row.weight)}. Larger than needed.`,
      });
      continue;
    }

    if (targetWeight == null && row.weight >= 12) {
      if (aggressive && isGrowthName(row.ticker, row.exposure)) continue;
      const delta = Math.round(Math.min(row.weight, Math.max(8, row.weight * 0.4)));
      if (delta >= MIN_TRIM) {
        trims.push({
          ticker: row.ticker,
          action: "trim",
          deltaPt: -delta,
          label: `Trim ${row.ticker}`,
          why: `${row.ticker} is ${pct(row.weight)}. This profile does not need it.`,
        });
      }
    }
  }

  const addCandidates = collapsedAddSleeves(targetSleeves, ranked)
    .filter((sleeve) => sleeve.gap >= MIN_GAP)
    .sort((a, b) => b.gap - a.gap);

  const addCap = aggressive ? (ranked.length <= 2 ? 2 : 1) : addCandidates.length;

  for (const sleeve of addCandidates.slice(0, addCap)) {
    const delta = Math.round(sleeve.gap);
    const category = sleeve.category;
    adds.push({
      ticker: sleeve.ticker,
      action: "add",
      deltaPt: delta,
      label: `Add ${category}`,
      why: sleeve.current <= 0
        ? missingWhy(sleeve.ticker)
        : `${sleeve.ticker} is ${pct(sleeve.current)}. This profile wants ${pct(sleeve.weight)}.`,
      category,
    });
  }

  for (const sleeve of targetSleeves) {
    const current = currentMap.get(sleeve.ticker);
    if (current == null) continue;
    if (Math.abs(current - sleeve.weight) < MIN_GAP) {
      keeps.push({
        ticker: sleeve.ticker,
        action: "keep",
        deltaPt: 0,
        label: `Keep ${sleeve.ticker}`,
        why: `${sleeve.ticker} is already the size.`,
      });
    }
  }

  const picked: SleeveMove[] = [];
  const seen = new Set<string>();

  const take = (move: SleeveMove) => {
    if (seen.has(move.ticker) || picked.length >= limit.max) return;
    seen.add(move.ticker);
    picked.push(move);
  };

  trims.slice(0, 2).forEach(take);
  adds.forEach(take);
  keeps.forEach(take);
  trims.slice(2).forEach(take);

  if (picked.length < limit.min) {
    for (const row of ranked) {
      if (picked.length >= limit.min) break;
      if (seen.has(row.ticker)) continue;
      take({
        ticker: row.ticker,
        action: "keep",
        deltaPt: 0,
        label: `Keep ${row.ticker}`,
        why: `${row.ticker} is already core.`,
      });
    }
  }

  return picked.slice(0, limit.max);
}

export function moveVerb(action: SleeveMoveAction): string {
  if (action === "trim") return "Trim";
  if (action === "add") return "Add";
  return "Keep";
}

/** Bold scan target: holding ticker on Trim/Keep, category on Add. */
export function moveFocus(move: SleeveMove): string {
  if (move.action === "add") return move.category ?? addCategory(move.ticker);
  return move.ticker;
}

export function isAddEtf(ticker: string): boolean {
  return getMarketInstrument(ticker)?.kind === "etf";
}

/**
 * Stock sleeves from Growth / Dividend / Dogs collapse onto one ETF each.
 * Study ETFs (VTI, TLT, BND, …) stay themselves.
 */
function representativeAdd(ticker: string): { ticker: string; category: string } {
  const category = addCategory(ticker);
  if (isAddEtf(ticker)) return { ticker, category };
  if (category === "growth") return { ticker: GROWTH_ADD_ETF, category: "growth" };
  return { ticker: YIELD_ADD_ETF, category: "yield" };
}

function collapsedAddSleeves(
  targetSleeves: Array<{ ticker: string; weight: number }>,
  ranked: Array<{ ticker: string; weight: number }>,
): Array<{ ticker: string; category: string; current: number; weight: number; gap: number }> {
  const grouped = new Map<string, { ticker: string; category: string; weight: number }>();

  for (const sleeve of targetSleeves) {
    const instrument = representativeAdd(sleeve.ticker);
    const existing = grouped.get(instrument.ticker);
    if (existing) {
      existing.weight += sleeve.weight;
    } else {
      grouped.set(instrument.ticker, { ...instrument, weight: sleeve.weight });
    }
  }

  return [...grouped.values()].map((sleeve) => {
    const current = categoryHeldWeight(sleeve.ticker, sleeve.category, ranked);
    return { ...sleeve, current, gap: sleeve.weight - current };
  });
}

function categoryHeldWeight(
  representativeTicker: string,
  category: string,
  ranked: Array<{ ticker: string; weight: number }>,
): number {
  let sum = 0;
  for (const row of ranked) {
    if (row.ticker === representativeTicker) {
      sum += row.weight;
      continue;
    }
    if (isAddEtf(row.ticker)) continue;
    if (addCategory(row.ticker) === category) sum += row.weight;
  }
  return sum;
}

function isGrowthName(ticker: string, exposure: string | null): boolean {
  if (GROWTH_NAMES.has(ticker)) return true;
  return exposure === "Technology"
    || exposure === "Communication Services"
    || exposure === "Consumer Discretionary";
}

function concentrationWhy(ticker: string, weight: number, aggressive: boolean): string {
  const head = `${ticker} is ${pct(weight)} of the book.`;
  return aggressive
    ? `${head} Even this profile has a limit.`
    : `${head} One name is the risk.`;
}

function addCategory(ticker: string): string {
  if (ticker === "BND" || ticker === "TLT" || ticker === "IEF") return "ballast";
  if (ticker === "VTI" || ticker === "SPY") return "U.S. equity";
  if (ticker === "QQQ") return "growth";
  if (ticker === "VXUS") return "international";
  if (ticker === "GLD") return "gold";
  if (ticker === "SGOV") return "cash";
  if (ticker === "DBC") return "commodities";
  if (ticker === "SCHD" || ticker === "VNQ") return "yield";
  if (GROWTH_NAMES.has(ticker)) return "growth";
  return "yield";
}

function missingWhy(ticker: string): string {
  if (ticker === "TLT" || ticker === "IEF") return "The book has no rates exposure.";
  if (ticker === "BND") return "The book has no ballast.";
  if (ticker === "VXUS") return "The book has no international.";
  if (ticker === "GLD") return "The book has no gold.";
  if (ticker === "SGOV") return "The book has no cash.";
  if (ticker === "DBC") return "The book has no commodities.";
  if (ticker === "VTI" || ticker === "SPY") return "The book has no broad U.S. equity.";
  if (ticker === "QQQ") return "The book has no growth.";
  if (ticker === "SCHD") return "The book has no yield.";
  if (ticker === "VNQ") return "The book has no real estate.";
  return `The book is missing ${ticker}.`;
}

function pct(weight: number): string {
  return `${Math.round(weight)}%`;
}
