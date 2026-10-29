export type RiskFactorId = "growth-duration" | "economic-cycle" | "inflation" | "defensive";

export interface RiskXRayHolding {
  ticker: string;
  weight: number | null;
  exposure: string | null;
}

export interface RiskFactorReading {
  id: RiskFactorId;
  label: string;
  score: number;
  interpretation: string;
  drivers: Array<{ ticker: string; weight: number }>;
}

export interface PortfolioRiskXRayResult {
  headline: string;
  detail: string;
  coverage: number;
  factors: RiskFactorReading[];
}

const FACTORS: Array<{
  id: RiskFactorId;
  label: string;
  interpretation: string;
  exposures: Set<string>;
  tickers: Set<string>;
}> = [
  { id: "growth-duration", label: "Growth & duration", interpretation: "More exposed to changing interest-rate expectations and long-duration growth valuations.", exposures: new Set(["Technology", "Communication Services", "Consumer Discretionary", "Long Treasuries"]), tickers: new Set(["QQQ", "VGT", "XLK", "ARKK", "TLT", "EDV"]) },
  { id: "economic-cycle", label: "Economic growth", interpretation: "More dependent on demand, capital spending, credit availability, and the business cycle.", exposures: new Set(["Industrials", "Financials", "Consumer Discretionary", "Materials", "Energy", "Small Cap"]), tickers: new Set(["IWM", "XLI", "XLF", "XLY", "XLB", "XLE"]) },
  { id: "inflation", label: "Inflation hedge", interpretation: "Assets that can respond differently when commodities or inflation expectations rise.", exposures: new Set(["Energy", "Materials", "Gold", "Commodities", "Real Estate"]), tickers: new Set(["GLD", "IAU", "SLV", "USO", "DBC", "GSG", "XLE", "XLB", "VNQ"]) },
  { id: "defensive", label: "Defensive ballast", interpretation: "Holdings that may soften equity stress, though diversification can fail in some regimes.", exposures: new Set(["Bonds", "Long Treasuries", "Short Treasuries", "Gold", "Utilities", "Consumer Staples", "Health Care", "Cash"]), tickers: new Set(["BND", "AGG", "TLT", "IEF", "SHY", "SGOV", "GLD", "IAU", "XLU", "XLP", "XLV"]) },
];

function normalizedWeight(value: number | null): number {
  return Number.isFinite(value) && (value ?? 0) > 0 ? value! : 0;
}

function strengthLabel(score: number): string {
  if (score >= 55) return "Dominant";
  if (score >= 30) return "Meaningful";
  if (score >= 12) return "Present";
  return "Limited";
}

export function buildPortfolioRiskXRay(holdings: RiskXRayHolding[]): PortfolioRiskXRayResult {
  const valid = holdings
    .map((holding) => ({ ticker: holding.ticker.toUpperCase(), exposure: holding.exposure, weight: normalizedWeight(holding.weight) }))
    .filter((holding) => holding.weight > 0);
  const totalWeight = valid.reduce((sum, holding) => sum + holding.weight, 0);
  const coveredWeight = valid.reduce((sum, holding) => sum + (holding.exposure ? holding.weight : 0), 0);

  const factors = FACTORS.map((factor) => {
    const drivers = valid
      .filter((holding) => factor.tickers.has(holding.ticker) || (holding.exposure ? factor.exposures.has(holding.exposure) : false))
      .map((holding) => ({ ticker: holding.ticker, weight: holding.weight }))
      .sort((a, b) => b.weight - a.weight);
    const score = Math.min(100, Math.round(drivers.reduce((sum, driver) => sum + driver.weight, 0)));
    return { id: factor.id, label: factor.label, score, interpretation: factor.interpretation, drivers: drivers.slice(0, 3) };
  });

  const leading = factors.slice().sort((a, b) => b.score - a.score)[0];
  const coverage = totalWeight > 0 ? Math.round((coveredWeight / totalWeight) * 100) : 0;
  const headline = leading && leading.score >= 12 ? `${leading.label} is the book’s clearest macro sensitivity.` : "No single macro sensitivity dominates this book.";
  const detail = leading && leading.score >= 12 ? `${strengthLabel(leading.score)} exposure across ${leading.score}% of portfolio weight.` : "The current mix is spread across the rule-based factor lenses.";
  return { headline, detail, coverage, factors };
}
