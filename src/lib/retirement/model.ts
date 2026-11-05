/** All balances, spending, income and savings are in today's purchasing power. */
export interface RetirementInputs {
  currentAge: number;
  retirementAge: number;
  endAge: number;
  savings: number;
  monthlySavings: number;
  annualSpending: number;
  socialSecurity: number;
  socialSecurityAge: number;
  pension: number;
  rentalIncome: number;
  preReturn: number;
  postReturn: number;
  inflation: number;
  withdrawalRate: number;
}
export const DEFAULT_RETIREMENT: RetirementInputs = {
  currentAge: 35, retirementAge: 65, endAge: 95,
  savings: 0, monthlySavings: 500, annualSpending: 50000,
  socialSecurity: 0, socialSecurityAge: 67, pension: 0, rentalIncome: 0,
  preReturn: 6, postReturn: 4, inflation: 2.5, withdrawalRate: 4,
};
export const INPUT_LIMITS: Record<keyof RetirementInputs, [number, number]> = {
  currentAge: [18, 100], retirementAge: [18, 100], endAge: [19, 120],
  savings: [0, 1e9], monthlySavings: [0, 1e6], annualSpending: [0, 1e7],
  socialSecurity: [0, 1e6], socialSecurityAge: [62, 70], pension: [0, 1e7], rentalIncome: [0, 1e7],
  preReturn: [-20, 20], postReturn: [-20, 20], inflation: [0, 15], withdrawalRate: [1, 10],
};
export function validateRetirement(input: RetirementInputs): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(INPUT_LIMITS) as (keyof RetirementInputs)[]) {
    const [min, max] = INPUT_LIMITS[key];
    if (!Number.isFinite(input[key]) || input[key] < min || input[key] > max) errors.push(`${key} must be between ${min} and ${max}.`);
  }
  for (const key of ['currentAge', 'retirementAge', 'endAge', 'socialSecurityAge'] as const) {
    if (!Number.isInteger(input[key])) errors.push('Enter whole years for ages.');
  }
  if (input.retirementAge < input.currentAge) errors.push('Retirement age must be at least your current age.');
  if (input.endAge <= input.retirementAge) errors.push('Plan-through age must be later than retirement age.');
  return [...new Set(errors)];
}
export interface RetirementPoint { age: number; balance: number }
export interface RetirementScenario {
  label: string; preReturn: number; postReturn: number;
  projected: number; target: number; gap: number;
  extraMonthly: number | null; depletedAge: number | null;
  endingBalance: number; points: RetirementPoint[];
}
const realMonthly = (nominal: number, inflation: number) => ((1 + nominal / 100) / (1 + inflation / 100)) ** (1 / 12) - 1;
/** Deterministic scenarios, not probabilities. Returns are annual effective rates after fees, before tax. */
export function projectRetirement(input: RetirementInputs, offset = 0, label = 'Your assumptions'): RetirementScenario {
  const errors = validateRetirement(input);
  if (errors.length) throw new Error(errors.join(' '));
  const preReturn = input.preReturn + offset;
  const postReturn = input.postReturn + offset;
  const pre = realMonthly(preReturn, input.inflation);
  const post = realMonthly(postReturn, input.inflation);
  const accumulationMonths = (input.retirementAge - input.currentAge) * 12;
  let balance = input.savings;
  const points = [{ age: input.currentAge, balance }];
  for (let month = 1; month <= accumulationMonths; month++) {
    balance = balance * (1 + pre) + input.monthlySavings;
    if (month % 12 === 0) points.push({ age: input.currentAge + month / 12, balance });
  }
  const projected = balance;
  const incomeAt = (age: number) => input.pension + input.rentalIncome + (age >= input.socialSecurityAge ? input.socialSecurity : 0);
  const target = Math.max(0, input.annualSpending - incomeAt(input.retirementAge)) / (input.withdrawalRate / 100);
  const gap = target - projected;
  const contributionFactor = accumulationMonths === 0 ? 0 : Math.abs(pre) < 1e-12 ? accumulationMonths : Math.expm1(accumulationMonths * Math.log1p(pre)) / pre;
  const extraMonthly = gap <= 0 ? 0 : contributionFactor > 0 ? gap / contributionFactor : null;
  let depletedAge: number | null = null;
  const retirementMonths = (input.endAge - input.retirementAge) * 12;
  for (let month = 0; month < retirementMonths; month++) {
    const age = input.retirementAge + month / 12;
    const withdrawal = Math.max(0, input.annualSpending - incomeAt(age)) / 12;
    // Spending at the beginning of each month; no saving of surplus outside income.
    if (withdrawal > balance + 0.005 && depletedAge === null) depletedAge = age;
    balance = Math.max(0, balance - withdrawal) * (1 + post);
    if ((month + 1) % 12 === 0) points.push({ age: input.retirementAge + (month + 1) / 12, balance });
  }
  return { label, preReturn, postReturn, projected, target, gap, extraMonthly, depletedAge, endingBalance: balance, points };
}
export function retirementScenarios(input: RetirementInputs) {
  return [projectRetirement(input, -2, 'Lower returns'), projectRetirement(input), projectRetirement(input, 2, 'Higher returns')];
}
