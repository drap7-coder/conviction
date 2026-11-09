export const ASSET_CLASSES = ['Stocks', 'Bonds', 'Cash'] as const;
export interface AllocationRow { name: string; current: number; target: number; add: number; beforePct: number; afterPct: number }
/** Allocate only new money, proportional to dollar shortfalls versus the post-contribution target. */
export function contributionPreview(balances: number[], targets: number[], contribution: number): AllocationRow[] {
  if (balances.length !== 3 || targets.length !== 3 || [...balances, contribution].some(n => !Number.isFinite(n) || n < 0 || n > 1e9) || targets.some(n => !Number.isFinite(n) || n < 0 || n > 100) || Math.abs(targets.reduce((a, b) => a + b, 0) - 100) > 1e-6) throw new Error('Enter nonnegative balances and a target mix totaling 100%.');
  const total = balances.reduce((a, b) => a + b, 0);
  const cents = Math.round(contribution * 100);
  const afterTotal = total + cents / 100;
  const gaps = targets.map((target, i) => Math.max(0, afterTotal * target / 100 - balances[i]));
  const gapTotal = gaps.reduce((a, b) => a + b, 0);
  const raw = gaps.map(gap => gapTotal ? gap / gapTotal * cents : 0);
  const additions = raw.map(Math.floor);
  let remainder = cents - additions.reduce((a, b) => a + b, 0);
  const order = raw.map((amount, i) => ({ i, fraction: amount - additions[i] })).sort((a, b) => b.fraction - a.fraction);
  for (const { i } of order) { if (remainder <= 0) break; additions[i]++; remainder--; }
  return ASSET_CLASSES.map((name, i) => ({ name, current: balances[i], target: targets[i], add: additions[i] / 100, beforePct: total ? balances[i] / total * 100 : 0, afterPct: afterTotal ? (balances[i] + additions[i] / 100) / afterTotal * 100 : 0 }));
}
