export const SANDBOX_STARTING_VALUE = 100_000;
export const SANDBOX_MAX_HOLDINGS = 10;
export const SANDBOX_STORAGE_KEY = "iq-bulls-sandbox-v1";

export type SandboxHolding = {
  ticker: string;
  weight: number;
  entryPrice?: number | null;
};

export type SandboxAnalysis = {
  investedPct: number;
  cashPct: number;
  largestPct: number;
  diversificationScore: number;
  effectiveHoldings: number;
  riskScore: number;
  riskLabel: "Low" | "Moderate" | "High" | "Very high";
  observations: string[];
};

const round = (value: number, digits = 1) => Number(value.toFixed(digits));

export function equalizeSandboxHoldings(holdings: SandboxHolding[]): SandboxHolding[] {
  if (!holdings.length) return [];
  const weight = 100 / holdings.length;
  return holdings.map((holding, index) => ({
    ...holding,
    weight: round(index === holdings.length - 1 ? 100 - round(weight) * (holdings.length - 1) : weight),
  }));
}

export function normalizeSandboxHoldings(holdings: SandboxHolding[]): SandboxHolding[] {
  const total = holdings.reduce((sum, holding) => sum + Math.max(0, holding.weight), 0);
  if (!total) return equalizeSandboxHoldings(holdings);
  let allocated = 0;
  return holdings.map((holding, index) => {
    const weight = index === holdings.length - 1
      ? round(100 - allocated)
      : round((Math.max(0, holding.weight) / total) * 100);
    allocated += weight;
    return { ...holding, weight };
  });
}

export function analyzeSandbox(holdings: SandboxHolding[]): SandboxAnalysis {
  if (!holdings.length) {
    return { investedPct: 0, cashPct: 100, largestPct: 0, diversificationScore: 0, effectiveHoldings: 0, riskScore: 0, riskLabel: "Low", observations: ["Add an asset to see how the pieces work together."] };
  }
  const weights = holdings.map((holding) => Math.max(0, holding.weight));
  const investedPct = Math.min(100, weights.reduce((sum, weight) => sum + weight, 0));
  const cashPct = Math.max(0, 100 - investedPct);
  const largestPct = weights.length ? Math.max(...weights) : 0;
  const hhi = weights.reduce((sum, weight) => sum + (weight / 100) ** 2, (cashPct / 100) ** 2);
  const effectiveHoldings = hhi ? 1 / hhi : 0;
  const speculativePct = holdings.reduce((sum, holding) => {
    const ticker = holding.ticker.toUpperCase();
    return sum + (ticker.endsWith("-USD") || ["USO", "UNG", "DBC"].includes(ticker) ? holding.weight : 0);
  }, 0);
  const concentrationPenalty = Math.max(0, largestPct - 25) * 0.8;
  const breadthPenalty = Math.max(0, 4 - effectiveHoldings) * 5;
  const speculativePenalty = speculativePct * 0.25;
  const riskScore = Math.round(Math.min(100, 15 + concentrationPenalty + breadthPenalty + speculativePenalty));
  const riskLabel = riskScore < 35 ? "Low" : riskScore < 55 ? "Moderate" : riskScore < 75 ? "High" : "Very high";
  const diversificationScore = Math.round(Math.max(0, Math.min(100, effectiveHoldings * 18 - largestPct * 0.35 + 25)));
  const observations: string[] = [];
  if (largestPct >= 35) observations.push(`One position controls ${round(largestPct)}% of the sandbox.`);
  else observations.push(`Your largest position is ${round(largestPct)}% of the sandbox.`);
  if (cashPct >= 20) observations.push(`${round(cashPct)}% cash lowers swings but also reduces market participation.`);
  if (speculativePct >= 15) observations.push(`${round(speculativePct)}% sits in assets that can move sharply.`);
  if (holdings.length >= 5 && largestPct < 25) observations.push("Position sizing is reasonably spread out.");

  return { investedPct: round(investedPct), cashPct: round(cashPct), largestPct: round(largestPct), diversificationScore, effectiveHoldings: round(effectiveHoldings), riskScore, riskLabel, observations };
}
