import { describe, expect, it } from "vitest";
import { classifyFit, RISK_PROFILE_LABELS, RISK_PROFILES, targetBookForProfile } from "@/lib/portfolio/fit";
import { generateSleeveMoves, isAddEtf, moveFocus, moveVerb } from "@/lib/portfolio/sleeve-moves";
import { getSampleBook } from "@/lib/portfolio/sample-books";
import type { BookHolding } from "@/lib/portfolio/sleeves";

const sixtyForty = getSampleBook("sixty-forty")!;
const threeFund = getSampleBook("three-fund")!;
const growth = getSampleBook("growth")!;

function expectPlainMoveCopy(moves: ReturnType<typeof generateSleeveMoves>) {
  expect(moves.every((move) => {
    if (move.action === "add") {
      return /^Add /.test(move.label)
        && Boolean(move.category)
        && !move.label.includes(move.ticker)
        && isAddEtf(move.ticker)
        && moveFocus(move) === move.category
        && moveVerb(move.action) === "Add";
    }
    return /^(Trim|Keep) [A-Z0-9.-]+$/.test(move.label)
      && move.category == null
      && moveFocus(move) === move.ticker;
  })).toBe(true);
  expect(moves.filter((move) => move.action === "add").every((move) => isAddEtf(move.ticker))).toBe(true);
  expect(moves.every((move) => !/sleeve|toward |\d+pt|bonds \(/i.test(move.label))).toBe(true);
  expect(moves.every((move) => !/sleeve|toward |\d+pt|more than 20%/i.test(move.why))).toBe(true);
}

describe("generateSleeveMoves", () => {
  it("returns no moves for an empty book", () => {
    expect(generateSleeveMoves([], sixtyForty)).toEqual([]);
  });

  it("trims a single name over the 20% mark and adds target holdings", () => {
    const holdings: BookHolding[] = [{ ticker: "NVDA", weight: 100, exposure: "Technology" }];
    const fit = classifyFit(holdings);
    const target = targetBookForProfile("growth-income", fit.rankings);
    const moves = generateSleeveMoves(holdings, target, undefined, "growth-income");

    expect(moves.length).toBeGreaterThanOrEqual(2);
    expect(moves.length).toBeLessThanOrEqual(4);
    expect(moves[0]).toMatchObject({
      ticker: "NVDA",
      action: "trim",
      label: "Trim NVDA",
      why: "NVDA is 100% of the book. One name is the risk.",
    });
    expect(moves.some((move) => move.action === "add")).toBe(true);
    expectPlainMoveCopy(moves);
  });

  it("keeps an on-target 60/40-like book and stays at 2–4 moves", () => {
    const holdings: BookHolding[] = [
      { ticker: "VTI", weight: 60, exposure: "U.S. Equity" },
      { ticker: "BND", weight: 40, exposure: "Fixed Income" },
    ];
    const moves = generateSleeveMoves(holdings, sixtyForty, undefined, "growth-income");
    expect(moves.length).toBeGreaterThanOrEqual(2);
    expect(moves.length).toBeLessThanOrEqual(4);
    expect(moves.map((move) => move.label)).toEqual(expect.arrayContaining([
      "Keep VTI",
      "Keep BND",
    ]));
    expect(moves.filter((move) => move.action === "keep").every((move) => move.why.endsWith("is already the size."))).toBe(true);
    expectPlainMoveCopy(moves);
  });

  it("adds bonds toward Three-Fund from a growth-like book", () => {
    const holdings: BookHolding[] = [
      { ticker: "NVDA", weight: 28, exposure: "Technology" },
      { ticker: "AAPL", weight: 18, exposure: "Technology" },
      { ticker: "MSFT", weight: 16, exposure: "Technology" },
      { ticker: "AMZN", weight: 14, exposure: "Consumer Discretionary" },
      { ticker: "GOOG", weight: 12, exposure: "Communication Services" },
      { ticker: "META", weight: 12, exposure: "Communication Services" },
    ];
    const moves = generateSleeveMoves(holdings, threeFund, undefined, "growth-income");
    expect(moves.length).toBeGreaterThanOrEqual(2);
    expect(moves.length).toBeLessThanOrEqual(4);
    expect(moves[0]).toMatchObject({
      ticker: "NVDA",
      action: "trim",
      label: "Trim NVDA",
      why: "NVDA is 28% of the book. One name is the risk.",
    });
    const add = moves.find((move) => move.ticker === "VTI" || move.ticker === "BND" || move.ticker === "VXUS");
    expect(add?.action).toBe("add");
    expect(add?.label).toMatch(/^Add /);
    expect(add?.label).not.toMatch(/toward |bonds \(|U\.S\. stocks/);
    if (add?.ticker === "BND") {
      expect(add.label).toBe("Add ballast");
      expect(add.category).toBe("ballast");
      expect(add.why).toBe("The book has no ballast.");
    }
    if (add?.ticker === "VTI") {
      expect(add.label).toBe("Add U.S. equity");
      expect(add.category).toBe("U.S. equity");
      expect(add.why).toBe("The book has no broad U.S. equity.");
    }
    if (add?.ticker === "VXUS") {
      expect(add.label).toBe("Add international");
      expect(add.category).toBe("international");
      expect(add.why).toBe("The book has no international.");
    }
    expectPlainMoveCopy(moves);
  });

  it("maps Growth to the diversified Growth book and Income onto yield templates", () => {
    const holdings: BookHolding[] = [
      { ticker: "JNJ", weight: 20, exposure: "Health Care" },
      { ticker: "PG", weight: 20, exposure: "Consumer Staples" },
      { ticker: "KO", weight: 20, exposure: "Consumer Staples" },
      { ticker: "PEP", weight: 20, exposure: "Consumer Staples" },
      { ticker: "MRK", weight: 20, exposure: "Health Care" },
    ];
    const fit = classifyFit(holdings);
    expect(fit.primary?.id).toBe("dividend");
    expect(fit.defaultProfile).toBe("growth-income");
    expect(targetBookForProfile("growth", fit.rankings).id).toBe("growth");
    expect(targetBookForProfile("income", fit.rankings).id).toMatch(/dividend|dogs-of-the-dow|permanent/);
    const moves = generateSleeveMoves(holdings, growth, undefined, "growth");
    expect(moves.some((move) => move.action === "trim" || move.action === "add")).toBe(true);
    expect(moves.filter((move) => move.action === "add").every((move) => (
      isAddEtf(move.ticker) && !["AAPL", "MSFT", "JNJ", "GEV", "TSLA"].includes(move.ticker)
    ))).toBe(true);
    expect(moves.length).toBeGreaterThanOrEqual(2);
    expect(moves.length).toBeLessThanOrEqual(4);
    expect(RISK_PROFILES).toHaveLength(5);
    expect(RISK_PROFILE_LABELS.income).toBe("Income");
    expectPlainMoveCopy(moves);
  });

  it("changes moves when Aggressive Growth vs Growth + Income is picked", () => {
    const holdings: BookHolding[] = [
      { ticker: "MSFT", weight: 32, exposure: "Technology" },
      { ticker: "NVDA", weight: 22, exposure: "Technology" },
      { ticker: "AAPL", weight: 18, exposure: "Technology" },
      { ticker: "AMZN", weight: 14, exposure: "Consumer Discretionary" },
      { ticker: "GOOG", weight: 14, exposure: "Communication Services" },
    ];
    const fit = classifyFit(holdings);
    const aggressiveTarget = targetBookForProfile("aggressive-growth", fit.rankings);
    const incomeTarget = targetBookForProfile("growth-income", fit.rankings);
    const aggressive = generateSleeveMoves(holdings, aggressiveTarget, undefined, "aggressive-growth");
    const income = generateSleeveMoves(holdings, incomeTarget, undefined, "growth-income");

    expect(aggressiveTarget.id).toBe("growth");
    expect(incomeTarget.id).toMatch(/sixty-forty|three-fund|dividend/);
    expect(aggressive.some((move) => move.ticker === "MSFT" && move.action === "trim")).toBe(false);
    expect(income.some((move) => (
      (move.ticker === "MSFT" && move.action === "trim")
      || move.label === "Add ballast"
    ))).toBe(true);
    expect(aggressive.map((move) => move.label).join("|")).not.toBe(income.map((move) => move.label).join("|"));
    expectPlainMoveCopy(aggressive);
    expectPlainMoveCopy(income);
  });

  it("frames Defensive adds as a category plus representative ETF", () => {
    const holdings: BookHolding[] = [{ ticker: "NVDA", weight: 100, exposure: "Technology" }];
    const fit = classifyFit(holdings);
    const target = targetBookForProfile("defensive", fit.rankings);
    const moves = generateSleeveMoves(holdings, target, undefined, "defensive");
    const add = moves.find((move) => move.action === "add" && (move.ticker === "TLT" || move.ticker === "IEF"));
    expect(add).toMatchObject({
      action: "add",
      label: "Add ballast",
      category: "ballast",
    });
    if (add?.ticker === "TLT" || add?.ticker === "IEF") {
      expect(add.why).toBe("The book has no rates exposure.");
    }
    expect(moves.find((move) => move.action === "trim")).toMatchObject({
      ticker: "NVDA",
      label: "Trim NVDA",
    });
    expectPlainMoveCopy(moves);
  });

  it("does not recommend individual stocks as Growth adds — QQQ stands in", () => {
    const holdings: BookHolding[] = [
      { ticker: "JNJ", weight: 40, exposure: "Health Care" },
      { ticker: "PG", weight: 30, exposure: "Consumer Staples" },
      { ticker: "KO", weight: 30, exposure: "Consumer Staples" },
    ];
    const fit = classifyFit(holdings);
    const target = targetBookForProfile("growth", fit.rankings);
    const moves = generateSleeveMoves(holdings, target, undefined, "growth");
    const add = moves.find((move) => move.action === "add");
    expect(add).toMatchObject({
      ticker: "QQQ",
      action: "add",
      label: "Add growth",
      category: "growth",
      why: "The book has no growth.",
    });
    expect(moves.some((move) => move.action === "add" && !isAddEtf(move.ticker))).toBe(false);
    expect(moves.some((move) => ["AAPL", "MSFT", "NVDA", "TSLA", "GEV"].includes(move.ticker) && move.action === "add")).toBe(false);
    expectPlainMoveCopy(moves);
  });

  it("does not add mega-caps to a concentrated growth book that already has the category", () => {
    const holdings: BookHolding[] = [{ ticker: "NVDA", weight: 100, exposure: "Technology" }];
    const fit = classifyFit(holdings);
    const target = targetBookForProfile("growth", fit.rankings);
    const moves = generateSleeveMoves(holdings, target, undefined, "growth");
    expect(moves.find((move) => move.action === "trim")).toMatchObject({
      ticker: "NVDA",
      label: "Trim NVDA",
    });
    expect(moves.some((move) => move.action === "add" && move.ticker === "QQQ")).toBe(false);
    expect(moves.some((move) => move.action === "add" && !isAddEtf(move.ticker))).toBe(false);
    expect(moves.some((move) => ["AAPL", "MSFT", "AMZN", "GOOG", "META"].includes(move.ticker) && move.action === "add")).toBe(false);
    expectPlainMoveCopy(moves);
  });

  it("frames Income adds as yield plus SCHD, not a dividend stock pick", () => {
    const holdings: BookHolding[] = [{ ticker: "NVDA", weight: 100, exposure: "Technology" }];
    const fit = classifyFit(holdings);
    const target = targetBookForProfile("income", fit.rankings);
    const moves = generateSleeveMoves(holdings, target, undefined, "income");
    const add = moves.find((move) => move.action === "add");
    expect(add).toBeTruthy();
    expect(isAddEtf(add!.ticker)).toBe(true);
    expect(["JNJ", "PG", "KO", "VZ", "IBM", "DOW", "NVDA", "TSLA"]).not.toContain(add!.ticker);
    if (add?.ticker === "SCHD") {
      expect(add).toMatchObject({
        label: "Add yield",
        category: "yield",
        why: "The book has no yield.",
      });
    }
    expectPlainMoveCopy(moves);
  });
});
