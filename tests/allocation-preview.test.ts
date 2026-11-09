import { describe, expect, it } from 'vitest';
import { contributionPreview } from '@/lib/retirement/allocation';
describe('new-money allocation preview', () => {
  it('starts an empty portfolio at its chosen targets', () => {
    expect(contributionPreview([0, 0, 0], [60, 35, 5], 500).map(r => r.add)).toEqual([300, 175, 25]);
  });
  it('never sells or adds to a category already above its post-contribution target', () => {
    const rows = contributionPreview([900, 100, 0], [60, 35, 5], 100);
    expect(rows[0].add).toBe(0);
    expect(rows.every(r => r.add >= 0)).toBe(true);
    expect(rows.reduce((sum, r) => sum + r.add, 0)).toBeCloseTo(100);
    expect(rows[0].afterPct).toBeLessThan(rows[0].beforePct);
  });
  it('preserves a balanced mix and exactly spends the cent-rounded budget', () => {
    const rows = contributionPreview([600, 350, 50], [60, 35, 5], 123.45);
    expect(Math.round(rows.reduce((sum, r) => sum + r.add, 0) * 100)).toBe(12345);
    expect(rows.reduce((sum, r) => sum + r.afterPct, 0)).toBeCloseTo(100);
  });
  it('handles no contribution and zero target categories', () => {
    expect(contributionPreview([0, 0, 0], [100, 0, 0], 0).map(r => r.add)).toEqual([0, 0, 0]);
    expect(contributionPreview([0, 0, 0], [100, 0, 0], 1).map(r => r.add)).toEqual([1, 0, 0]);
  });
  it('rejects invalid totals and nonfinite or negative inputs', () => {
    for (const [balances, targets, budget] of [[[0, 0, 0], [50, 40, 0], 100], [[-1, 0, 0], [60, 35, 5], 100], [[0, 0, 0], [60, 35, 5], NaN]] as [number[], number[], number][]) expect(() => contributionPreview(balances, targets, budget)).toThrow();
  });
});
