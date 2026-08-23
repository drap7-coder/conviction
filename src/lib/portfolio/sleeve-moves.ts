/**
 * Concrete moves toward a Study template.
 * Visible labels stay plain — ticker + verb. Why is everyday English.
 */

import { sampleBookSleeves, type SampleBook } from "@/lib/portfolio/sample-books";
import { rankedHoldings, type BookHolding } from "@/lib/portfolio/sleeves";

export type SleeveMoveAction = "trim" | "add" | "keep";

export type SleeveMove = {
  ticker: string;
  action: SleeveMoveAction;
  deltaPt: number;
  label: string;
  why: string;
};

const CONCENTRATION_MARK = 20;
const MIN_GAP = 5;
const MIN_TRIM = 3;

const ADD_NAMES: Record<string, string> = {
  BND: "bonds",
  IEF: "bonds",
  TLT: "long bonds",
  VXUS: "international",
  GLD: "gold",
  SGOV: "cash",
  DBC: "commodities",
  VTI: "U.S. stocks",
};

export function generateSleeveMoves(
  holdings: BookHolding[],
  target: SampleBook,
  limit = { min: 2, max: 4 },
): SleeveMove[] {
  const ranked = rankedHoldings(holdings);
  if (ranked.length === 0) return [];

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

    // 20% mark applies when the name is not supposed to be that large.
    // Template holdings that *target* 20%+ (VTI in 60/40) are not trimmed for size.
    if (row.weight > CONCENTRATION_MARK && (targetWeight == null || targetWeight < CONCENTRATION_MARK)) {
      const delta = Math.round(row.weight - CONCENTRATION_MARK);
      if (delta >= MIN_TRIM) {
        trims.push({
          ticker: row.ticker,
          action: "trim",
          deltaPt: -delta,
          label: `Trim ${row.ticker}`,
          why: `it’s more than ${CONCENTRATION_MARK}% of the book`,
        });
        continue;
      }
    }

    if (targetWeight != null && row.weight - targetWeight >= MIN_GAP) {
      const delta = Math.round(row.weight - targetWeight);
      trims.push({
        ticker: row.ticker,
        action: "trim",
        deltaPt: -delta,
        label: `Trim ${row.ticker}`,
        why: "it’s more than this profile wants",
      });
      continue;
    }

    if (targetWeight == null && row.weight >= 12) {
      const delta = Math.round(Math.min(row.weight, Math.max(8, row.weight * 0.4)));
      if (delta >= MIN_TRIM) {
        trims.push({
          ticker: row.ticker,
          action: "trim",
          deltaPt: -delta,
          label: `Trim ${row.ticker}`,
          why: "this profile doesn’t use it",
        });
      }
    }
  }

  const addCandidates = targetSleeves
    .map((sleeve) => {
      const current = currentMap.get(sleeve.ticker) ?? 0;
      return { ...sleeve, current, gap: sleeve.weight - current };
    })
    .filter((sleeve) => sleeve.gap >= MIN_GAP)
    .sort((a, b) => b.gap - a.gap);

  for (const sleeve of addCandidates) {
    const delta = Math.round(sleeve.gap);
    adds.push({
      ticker: sleeve.ticker,
      action: "add",
      deltaPt: delta,
      label: addLabel(sleeve.ticker),
      why: sleeve.current <= 0 ? missingWhy(sleeve.ticker) : "this profile wants more of it",
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
        why: "already the size this profile wants",
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

  // At most two trims so add/keep holdings still surface (2–4 total).
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
        why: "already a core holding",
      });
    }
  }

  return picked.slice(0, limit.max);
}

function addLabel(ticker: string): string {
  const name = ADD_NAMES[ticker];
  return name ? `Add ${name} (${ticker})` : `Add ${ticker}`;
}

function missingWhy(ticker: string): string {
  if (ticker === "BND" || ticker === "TLT" || ticker === "IEF") return "the book has no bonds";
  if (ticker === "VXUS") return "the book has no international stocks";
  if (ticker === "GLD") return "the book has no gold";
  if (ticker === "SGOV") return "the book has no cash";
  if (ticker === "DBC") return "the book has no commodities";
  if (ticker === "VTI") return "the book has no broad U.S. stocks";
  return `the book is missing ${ticker}`;
}
