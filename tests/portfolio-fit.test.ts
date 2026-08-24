import { describe, expect, it } from "vitest";
import {
  classifyFit,
  FIT_HEDGE,
  PROFILE_TARGET_IDS,
  RISK_PROFILE_BLURBS,
  RISK_PROFILE_LABELS,
  COMPARE_AGAINST_LABEL,
  RISK_PROFILE_MOVES_SUBHEAD,
  RISK_PROFILE_QUESTION,
  RISK_PROFILES,
  RUNNER_UP_MARGIN,
  riskProfileDeltaLead,
  targetBookForProfile,
} from "@/lib/portfolio/fit";
import type { BookHolding } from "@/lib/portfolio/sleeves";

const sixtyForty: BookHolding[] = [
  { ticker: "VTI", weight: 60, exposure: "U.S. Equity" },
  { ticker: "BND", weight: 40, exposure: "Fixed Income" },
];

const growthLike: BookHolding[] = [
  { ticker: "NVDA", weight: 12, exposure: "Technology" },
  { ticker: "AAPL", weight: 11, exposure: "Technology" },
  { ticker: "MSFT", weight: 11, exposure: "Technology" },
  { ticker: "AMZN", weight: 10, exposure: "Consumer Discretionary" },
  { ticker: "GOOG", weight: 10, exposure: "Communication Services" },
  { ticker: "META", weight: 10, exposure: "Communication Services" },
  { ticker: "AVGO", weight: 9, exposure: "Technology" },
  { ticker: "NFLX", weight: 9, exposure: "Communication Services" },
  { ticker: "CRM", weight: 9, exposure: "Technology" },
  { ticker: "COST", weight: 9, exposure: "Consumer Staples" },
];

describe("classifyFit", () => {
  it("returns no primary for an empty book", () => {
    const fit = classifyFit([]);
    expect(fit.primary).toBeNull();
    expect(fit.runnerUp).toBeNull();
    expect(fit.headline).toBe("Waiting on prices.");
    expect(fit.defaultProfile).toBeNull();
    expect(fit.headline).not.toMatch(/runs the book/i);
  });

  it("classifies a single name as Growth and defaults to Aggressive Growth", () => {
    const fit = classifyFit([{ ticker: "NVDA", weight: 100, exposure: "Technology" }]);
    expect(fit.primary?.id).toBe("growth");
    expect(fit.primary?.label).toBe("Growth");
    expect(fit.primary?.profile).toBe("growth");
    expect(fit.headline).toBe("Looks like Growth.");
    expect(fit.headline).not.toMatch(/ · \d+$/);
    expect(fit.headline).not.toMatch(/runs the book/i);
    expect(fit.defaultProfile).toBe("aggressive-growth");
  });

  it("classifies a 60/40-like book as 60/40 with Growth + Income", () => {
    const fit = classifyFit(sixtyForty);
    expect(fit.primary?.id).toBe("sixty-forty");
    expect(fit.primary?.label).toBe("60/40");
    expect(fit.primary?.score).toBeGreaterThanOrEqual(95);
    expect(fit.defaultProfile).toBe("growth-income");
    expect(fit.headline).toBe("Looks like 60/40.");
  });

  it("classifies a diversified mega-cap book as Growth, not Aggressive Growth", () => {
    const fit = classifyFit(growthLike);
    expect(fit.primary?.id).toBe("growth");
    expect(fit.primary?.score).toBeGreaterThan(
      fit.rankings.find((row) => row.id === "dividend")?.score ?? 0,
    );
    expect(fit.defaultProfile).toBe("growth");
  });

  it("shows a runner-up only when the next template is within ~8 points", () => {
    const close = classifyFit([
      { ticker: "VTI", weight: 55, exposure: "U.S. Equity" },
      { ticker: "VXUS", weight: 20, exposure: "International Equity" },
      { ticker: "BND", weight: 25, exposure: "Fixed Income" },
    ]);
    expect(close.primary?.id).toBe("three-fund");
    expect(close.defaultProfile).toBe("growth-income");
    if (close.runnerUp) {
      expect(close.primary!.score - close.runnerUp.score).toBeLessThanOrEqual(RUNNER_UP_MARGIN);
    }

    const exact = classifyFit(sixtyForty);
    expect(exact.primary?.id).toBe("sixty-forty");
    if (exact.runnerUp) {
      expect(exact.primary!.score - exact.runnerUp.score).toBeLessThanOrEqual(RUNNER_UP_MARGIN);
    } else {
      const second = exact.rankings[1];
      expect(exact.primary!.score - second.score).toBeGreaterThan(RUNNER_UP_MARGIN);
    }
  });

  it("asks for the five standard brokerage risk profiles", () => {
    expect(RISK_PROFILES).toEqual([
      "aggressive-growth",
      "growth",
      "growth-income",
      "defensive",
      "income",
    ]);
    expect(RISK_PROFILE_LABELS).toEqual({
      "aggressive-growth": "Aggressive Growth",
      growth: "Growth",
      "growth-income": "Growth + Income",
      defensive: "Defensive",
      income: "Income",
    });
    expect(RISK_PROFILE_BLURBS["aggressive-growth"]).toMatch(/drawdowns/i);
    expect(RISK_PROFILE_QUESTION).toBe("Risk profile");
    expect(COMPARE_AGAINST_LABEL).toBe("Compare against →");
    expect(riskProfileDeltaLead("Growth", "defensive")).toBe("Growth → Defensive");
    expect(riskProfileDeltaLead("60/40", "growth-income")).toBe("60/40 → Growth + Income");
    expect(RISK_PROFILE_MOVES_SUBHEAD).toBe("Here's what would need to change:");
    expect(FIT_HEDGE).toBe("A description of this book. Not a trade.");
    expect(PROFILE_TARGET_IDS["aggressive-growth"]).toEqual(["growth"]);
    expect(PROFILE_TARGET_IDS.growth).toEqual(["growth"]);
    expect(PROFILE_TARGET_IDS["growth-income"]).toEqual(["sixty-forty", "three-fund", "dividend"]);
    expect(PROFILE_TARGET_IDS.defensive).toEqual(["all-weather", "permanent"]);
    expect(PROFILE_TARGET_IDS.income).toEqual(["dividend", "dogs-of-the-dow", "permanent"]);
  });

  it("maps each profile onto existing Study templates from Fit rankings", () => {
    const fit = classifyFit([
      { ticker: "VTI", weight: 25, exposure: "U.S. Equity" },
      { ticker: "TLT", weight: 25, exposure: "Fixed Income" },
      { ticker: "GLD", weight: 25, exposure: "Commodities" },
      { ticker: "SGOV", weight: 25, exposure: "Cash" },
    ]);
    expect(fit.primary?.id).toBe("permanent");
    expect(fit.defaultProfile).toBe("defensive");
    expect(targetBookForProfile("defensive", fit.rankings).id).toBe("permanent");
    expect(targetBookForProfile("growth-income", fit.rankings).id).toMatch(/sixty-forty|three-fund|dividend/);
    expect(targetBookForProfile("aggressive-growth", fit.rankings).id).toBe("growth");
    expect(targetBookForProfile("growth", fit.rankings).id).toBe("growth");
    expect(targetBookForProfile("income", fit.rankings).id).toMatch(/dividend|dogs-of-the-dow|permanent/);
  });

  it("defaults a dividend-like book to Growth + Income and Dogs to Income", () => {
    const dividend = classifyFit([
      { ticker: "JNJ", weight: 10, exposure: "Health Care" },
      { ticker: "PG", weight: 10, exposure: "Consumer Staples" },
      { ticker: "KO", weight: 10, exposure: "Consumer Staples" },
      { ticker: "PEP", weight: 10, exposure: "Consumer Staples" },
      { ticker: "ABBV", weight: 10, exposure: "Health Care" },
      { ticker: "MRK", weight: 10, exposure: "Health Care" },
      { ticker: "HD", weight: 10, exposure: "Consumer Discretionary" },
      { ticker: "MMM", weight: 10, exposure: "Industrials" },
      { ticker: "IBM", weight: 10, exposure: "Technology" },
      { ticker: "VZ", weight: 10, exposure: "Communication Services" },
    ]);
    expect(dividend.primary?.id).toBe("dividend");
    expect(dividend.defaultProfile).toBe("growth-income");

    const dogs = classifyFit([
      { ticker: "VZ", weight: 10, exposure: "Communication Services" },
      { ticker: "IBM", weight: 10, exposure: "Technology" },
      { ticker: "DOW", weight: 10, exposure: "Materials" },
      { ticker: "CVX", weight: 10, exposure: "Energy" },
      { ticker: "AMGN", weight: 10, exposure: "Health Care" },
      { ticker: "KO", weight: 10, exposure: "Consumer Staples" },
      { ticker: "CSCO", weight: 10, exposure: "Technology" },
      { ticker: "JPM", weight: 10, exposure: "Financials" },
      { ticker: "MMM", weight: 10, exposure: "Industrials" },
      { ticker: "WBA", weight: 10, exposure: "Consumer Staples" },
    ]);
    expect(dogs.primary?.id).toBe("dogs-of-the-dow");
    expect(dogs.defaultProfile).toBe("income");
  });
});
