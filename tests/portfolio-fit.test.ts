import { describe, expect, it } from "vitest";
import { BOOK_POSTURES, classifyFit, POSTURE_LABELS, RISK_PROFILE_QUESTION, RUNNER_UP_MARGIN, targetBookForPosture } from "@/lib/portfolio/fit";
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
    expect(fit.defaultPosture).toBeNull();
    expect(fit.headline).not.toMatch(/runs the book/i);
  });

  it("classifies a single name by sleeve mix, with ticker overlap as the tie-break", () => {
    const fit = classifyFit([{ ticker: "NVDA", weight: 100, exposure: "Technology" }]);
    expect(fit.primary?.id).toBe("growth");
    expect(fit.primary?.label).toBe("Growth");
    expect(fit.primary?.posture).toBe("grow");
    expect(fit.headline).toBe("This book looks like Growth");
    expect(fit.headline).not.toMatch(/runs the book/i);
    expect(fit.defaultPosture).toBe("grow");
  });

  it("classifies a 60/40-like book as 60/40 with Balance", () => {
    const fit = classifyFit(sixtyForty);
    expect(fit.primary?.id).toBe("sixty-forty");
    expect(fit.primary?.label).toBe("60/40");
    expect(fit.primary?.score).toBeGreaterThanOrEqual(95);
    expect(fit.defaultPosture).toBe("balance");
    expect(fit.headline).toBe("This book looks like 60/40");
  });

  it("classifies a growth-like mega-cap book as Growth", () => {
    const fit = classifyFit(growthLike);
    expect(fit.primary?.id).toBe("growth");
    expect(fit.primary?.score).toBeGreaterThan(
      fit.rankings.find((row) => row.id === "dividend")?.score ?? 0,
    );
    expect(fit.defaultPosture).toBe("grow");
  });

  it("shows a runner-up only when the next template is within ~8 points", () => {
    const close = classifyFit([
      { ticker: "VTI", weight: 55, exposure: "U.S. Equity" },
      { ticker: "VXUS", weight: 20, exposure: "International Equity" },
      { ticker: "BND", weight: 25, exposure: "Fixed Income" },
    ]);
    expect(close.primary?.id).toBe("three-fund");
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

  it("asks for one of three risk profiles: Protect, Balance, Grow", () => {
    expect(BOOK_POSTURES).toHaveLength(3);
    expect(POSTURE_LABELS).toEqual({
      preserve: "Protect",
      balance: "Balance",
      grow: "Grow",
    });
    expect(RISK_PROFILE_QUESTION).toBe("What’s your risk profile?");
  });

  it("picks Permanent or All-Weather as the Protect target from Fit rankings", () => {
    const fit = classifyFit([
      { ticker: "VTI", weight: 25, exposure: "U.S. Equity" },
      { ticker: "TLT", weight: 25, exposure: "Fixed Income" },
      { ticker: "GLD", weight: 25, exposure: "Commodities" },
      { ticker: "SGOV", weight: 25, exposure: "Cash" },
    ]);
    expect(fit.primary?.id).toBe("permanent");
    expect(targetBookForPosture("preserve", fit.rankings).id).toBe("permanent");
    expect(targetBookForPosture("balance", fit.rankings).id).toMatch(/sixty-forty|three-fund/);
    expect(targetBookForPosture("grow", fit.rankings).id).toBe("growth");
  });
});
