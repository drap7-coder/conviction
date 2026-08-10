import { describe, expect, it } from "vitest";
import {
  SAMPLE_BOOK_TARGET_VALUE,
  SAMPLE_PORTFOLIO_BOOKS,
  equalWeightPositions,
} from "@/lib/portfolio/sample-books";
import {
  getSectorForCompany,
  normalizeSectorName,
} from "@/lib/market/industries";

describe("sample portfolio books", () => {
  it("keeps six theme books at ten names each", () => {
    expect(SAMPLE_PORTFOLIO_BOOKS).toHaveLength(6);
    for (const book of SAMPLE_PORTFOLIO_BOOKS) {
      expect(book.tickers).toHaveLength(10);
    }
  });

  it("sizes every book to $100k equal weight when prices exist", () => {
    const prices: Record<string, number> = {
      JNJ: 160,
      PG: 170,
      KO: 70,
      PEP: 170,
      ABBV: 180,
      MRK: 110,
      HD: 380,
      MMM: 140,
      IBM: 220,
      VZ: 40,
    };
    const positions = equalWeightPositions(
      SAMPLE_PORTFOLIO_BOOKS.find((book) => book.id === "rates-fed")!.tickers,
      prices,
    );
    expect(positions).toHaveLength(10);
    const total = positions.reduce((sum, pos) => sum + pos.shares * prices[pos.ticker]!, 0);
    expect(total).toBeCloseTo(SAMPLE_BOOK_TARGET_VALUE, 0);
    for (const pos of positions) {
      expect(pos.shares * prices[pos.ticker]!).toBeCloseTo(SAMPLE_BOOK_TARGET_VALUE / 10, 0);
    }
  });
});

describe("sector normalization", () => {
  it("maps Yahoo aliases onto canonical names", () => {
    expect(normalizeSectorName("Healthcare")).toBe("Health Care");
    expect(normalizeSectorName("Consumer Cyclical")).toBe("Consumer Discretionary");
    expect(normalizeSectorName("Consumer Defensive")).toBe("Consumer Staples");
    expect(normalizeSectorName("Basic Materials")).toBe("Materials");
    expect(normalizeSectorName("Financial Services")).toBe("Financials");
  });

  it("classifies dividend-book names without falling through", () => {
    const dividend = ["JNJ", "PG", "KO", "PEP", "ABBV", "MRK", "HD", "MMM", "IBM", "VZ"];
    for (const ticker of dividend) {
      expect(getSectorForCompany(ticker)?.name).toBeTruthy();
    }
    expect(getSectorForCompany("JNJ")?.name).toBe("Health Care");
    expect(getSectorForCompany("PG")?.name).toBe("Consumer Staples");
    expect(getSectorForCompany("VZ")?.name).toBe("Communication Services");
    expect(getSectorForCompany("MMM")?.name).toBe("Industrials");
  });
});
