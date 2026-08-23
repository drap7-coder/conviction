import { describe, expect, it } from "vitest";
import { classifyFit, POSTURE_LABELS, BOOK_POSTURES, targetBookForPosture } from "@/lib/portfolio/fit";
import { generateSleeveMoves } from "@/lib/portfolio/sleeve-moves";
import { getSampleBook } from "@/lib/portfolio/sample-books";
import type { BookHolding } from "@/lib/portfolio/sleeves";

const sixtyForty = getSampleBook("sixty-forty")!;
const threeFund = getSampleBook("three-fund")!;
const growth = getSampleBook("growth")!;

function expectPlainMoveCopy(moves: ReturnType<typeof generateSleeveMoves>) {
  expect(moves.every((move) => !/sleeve|toward |\d+pt/i.test(move.label))).toBe(true);
  expect(moves.every((move) => !/sleeve|toward |\d+pt/i.test(move.why))).toBe(true);
}

describe("generateSleeveMoves", () => {
  it("returns no moves for an empty book", () => {
    expect(generateSleeveMoves([], sixtyForty)).toEqual([]);
  });

  it("trims a single name over the 20% mark and adds target holdings", () => {
    const holdings: BookHolding[] = [{ ticker: "NVDA", weight: 100, exposure: "Technology" }];
    const fit = classifyFit(holdings);
    const target = targetBookForPosture("balance", fit.rankings);
    const moves = generateSleeveMoves(holdings, target);

    expect(moves.length).toBeGreaterThanOrEqual(2);
    expect(moves.length).toBeLessThanOrEqual(4);
    expect(moves[0]).toMatchObject({
      ticker: "NVDA",
      action: "trim",
      label: "Trim NVDA",
      why: "it’s more than 20% of the book",
    });
    expect(moves.some((move) => move.action === "add")).toBe(true);
    expectPlainMoveCopy(moves);
  });

  it("keeps an on-target 60/40-like book and stays at 2–4 moves", () => {
    const holdings: BookHolding[] = [
      { ticker: "VTI", weight: 60, exposure: "U.S. Equity" },
      { ticker: "BND", weight: 40, exposure: "Fixed Income" },
    ];
    const moves = generateSleeveMoves(holdings, sixtyForty);
    expect(moves.length).toBeGreaterThanOrEqual(2);
    expect(moves.length).toBeLessThanOrEqual(4);
    expect(moves.map((move) => move.label)).toEqual(expect.arrayContaining([
      "Keep VTI",
      "Keep BND",
    ]));
    expect(moves.filter((move) => move.action === "keep").every((move) => move.why === "already the size this profile wants")).toBe(true);
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
    const moves = generateSleeveMoves(holdings, threeFund);
    expect(moves.length).toBeGreaterThanOrEqual(2);
    expect(moves.length).toBeLessThanOrEqual(4);
    expect(moves[0]).toMatchObject({
      ticker: "NVDA",
      action: "trim",
      label: "Trim NVDA",
      why: "it’s more than 20% of the book",
    });
    const add = moves.find((move) => move.ticker === "VTI" || move.ticker === "BND" || move.ticker === "VXUS");
    expect(add?.action).toBe("add");
    expect(add?.label).toMatch(/^Add /);
    expect(add?.label).not.toMatch(/toward /);
    if (add?.ticker === "BND") expect(add.label).toBe("Add bonds (BND)");
    if (add?.ticker === "VTI") expect(add.label).toBe("Add U.S. stocks (VTI)");
    if (add?.ticker === "VXUS") expect(add.label).toBe("Add international (VXUS)");
    expectPlainMoveCopy(moves);
  });

  it("aims Grow moves at the Growth template, not a fourth posture", () => {
    const holdings: BookHolding[] = [
      { ticker: "JNJ", weight: 20, exposure: "Health Care" },
      { ticker: "PG", weight: 20, exposure: "Consumer Staples" },
      { ticker: "KO", weight: 20, exposure: "Consumer Staples" },
      { ticker: "PEP", weight: 20, exposure: "Consumer Staples" },
      { ticker: "MRK", weight: 20, exposure: "Health Care" },
    ];
    const fit = classifyFit(holdings);
    expect(fit.defaultPosture).toBe("grow");
    const target = targetBookForPosture("grow", fit.rankings);
    expect(target.id).toBe("growth");
    const moves = generateSleeveMoves(holdings, growth);
    expect(moves.some((move) => move.ticker === "AAPL" || move.action === "trim" || move.action === "add")).toBe(true);
    expect(moves.length).toBeGreaterThanOrEqual(2);
    expect(moves.length).toBeLessThanOrEqual(4);
    expect(BOOK_POSTURES).toEqual(["preserve", "balance", "grow"]);
    expect(POSTURE_LABELS).toEqual({
      preserve: "Protect",
      balance: "Balance",
      grow: "Grow",
    });
    expectPlainMoveCopy(moves);
  });
});
