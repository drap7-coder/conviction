import { describe, expect, it } from "vitest";
import { classifyFit, targetBookForPosture } from "@/lib/portfolio/fit";
import { generateSleeveMoves } from "@/lib/portfolio/sleeve-moves";
import { getSampleBook } from "@/lib/portfolio/sample-books";
import type { BookHolding } from "@/lib/portfolio/sleeves";

const sixtyForty = getSampleBook("sixty-forty")!;
const threeFund = getSampleBook("three-fund")!;
const growth = getSampleBook("growth")!;

describe("generateSleeveMoves", () => {
  it("returns no moves for an empty book", () => {
    expect(generateSleeveMoves([], sixtyForty)).toEqual([]);
  });

  it("trims a single name over the 20% mark and adds target sleeves", () => {
    const holdings: BookHolding[] = [{ ticker: "NVDA", weight: 100, exposure: "Technology" }];
    const fit = classifyFit(holdings);
    const target = targetBookForPosture("balance", fit.rankings);
    const moves = generateSleeveMoves(holdings, target);

    expect(moves.length).toBeGreaterThanOrEqual(2);
    expect(moves.length).toBeLessThanOrEqual(4);
    expect(moves[0]).toMatchObject({
      ticker: "NVDA",
      action: "trim",
      label: "Trim NVDA −80pt",
      why: "over 20% concentration mark",
    });
    expect(moves.some((move) => move.action === "add")).toBe(true);
    expect(moves.every((move) => move.why.split(/\s+/).length <= 6)).toBe(true);
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
    expect(moves.filter((move) => move.action === "keep").every((move) => move.why === "already at target weight")).toBe(true);
  });

  it("adds ballast toward Three-Fund from a growth-like book", () => {
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
      label: "Trim NVDA −8pt",
      why: "over 20% concentration mark",
    });
    const add = moves.find((move) => move.ticker === "VTI" || move.ticker === "BND" || move.ticker === "VXUS");
    expect(add?.action).toBe("add");
    expect(add?.label).toMatch(/toward Three-Fund/);
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
    expect(moves.some((move) => /toward Growth/.test(move.label) || move.ticker === "AAPL" || move.action === "trim")).toBe(true);
    expect(moves.length).toBeGreaterThanOrEqual(2);
    expect(moves.length).toBeLessThanOrEqual(4);
  });
});
