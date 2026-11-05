import { describe, expect, it } from 'vitest';
import { DEFAULT_RETIREMENT, projectRetirement, retirementScenarios, validateRetirement } from '@/lib/retirement/model';
const flat = { ...DEFAULT_RETIREMENT, currentAge: 60, retirementAge: 65, endAge: 70, preReturn: 0, postReturn: 0, inflation: 0, savings: 100000, monthlySavings: 1000, annualSpending: 20000 };
describe('retirement model', () => {
  it('handles zero-return accumulation and beginning-of-month withdrawals', () => {
    const result = projectRetirement(flat);
    expect(result.projected).toBe(160000);
    expect(result.endingBalance).toBeCloseTo(60000, 5);
    expect(result.target).toBe(500000);
    expect(result.extraMonthly).toBeCloseTo(340000 / 60);
    expect(result.points.at(-1)?.age).toBe(70);
  });
  it('keeps purchasing power constant when returns equal inflation', () => {
    expect(projectRetirement({ ...flat, preReturn: 3, postReturn: 3, inflation: 3 }).projected).toBe(160000);
  });
  it('uses effective annual returns, including negative returns', () => {
    expect(projectRetirement({ ...flat, retirementAge: 61, monthlySavings: 0, preReturn: -10 }).projected).toBeCloseTo(90000);
  });
  it('does not start Social Security before its specified age', () => {
    const input = { ...flat, currentAge: 65, savings: 50000, socialSecurity: 20000, socialSecurityAge: 67 };
    const delayed = projectRetirement(input);
    expect(delayed.target).toBe(500000);
    expect(delayed.endingBalance).toBeCloseTo(10000);
    expect(projectRetirement({ ...input, socialSecurityAge: 65 }).target).toBe(0);
    expect(projectRetirement({ ...input, socialSecurityAge: 65 }).endingBalance).toBe(50000);
  });
  it('uses the horizon and reports unmet spending without negative balances', () => {
    const result = projectRetirement({ ...flat, currentAge: 65, savings: 10000 });
    expect(result.depletedAge).not.toBeNull();
    expect(result.endingBalance).toBe(0);
    expect(result.extraMonthly).toBeNull();
    expect(result.points.every(point => point.balance >= 0)).toBe(true);
  });
  it('distinguishes the rule-of-thumb target from a sustainable horizon', () => {
    const result = projectRetirement({ ...flat, currentAge: 65, endAge: 100, savings: 500000 });
    expect(result.gap).toBe(0);
    expect(result.depletedAge).not.toBeNull();
  });
  it('handles income covering all spending and orders illustrative scenarios', () => {
    const result = projectRetirement({ ...flat, pension: 20000 });
    expect(result.target).toBe(0);
    expect(result.extraMonthly).toBe(0);
    const scenarios = retirementScenarios(flat);
    expect(scenarios[0].projected).toBeLessThan(scenarios[1].projected);
    expect(scenarios[1].projected).toBeLessThan(scenarios[2].projected);
  });
  it('closes the target gap using the additional contribution, even with negative real returns', () => {
    const input = { ...flat, preReturn: 0, inflation: 3 };
    const result = projectRetirement(input);
    expect(projectRetirement({ ...input, monthlySavings: input.monthlySavings + result.extraMonthly! }).projected).toBeCloseTo(result.target, 4);
  });
  it('does not flag a rounding remainder as early depletion', () => {
    const result = projectRetirement({ ...flat, currentAge: 65, savings: 10000 });
    expect(result.depletedAge).toBe(65.5);
  });
  it('rejects invalid, fractional, missing or impossible inputs', () => {
    for (const patch of [{ currentAge: 70 }, { endAge: 65 }, { savings: -1 }, { inflation: NaN }, { withdrawalRate: 0 }, { currentAge: 30.5 }]) {
      expect(validateRetirement({ ...flat, ...patch }).length).toBeGreaterThan(0);
      expect(() => projectRetirement({ ...flat, ...patch })).toThrow();
    }
  });
});
