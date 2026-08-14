import { describe, expect, it } from "vitest";
import {
  SAMPLE_BOOK_TARGET_VALUE,
  SAMPLE_PORTFOLIO_BOOKS,
  equalWeightPositions,
  positionsMatchSampleBook,
  resolveActivePortfolioPositions,
  sizeSampleBookPositions,
  weightedPositions,
} from "@/lib/portfolio/sample-books";
import {
  getSectorForCompany,
  normalizeSectorName,
} from "@/lib/market/industries";

describe("sample portfolio books", () => {
  it("keeps theme books at ten names and includes All-Weather weights", () => {
    const allWeather = SAMPLE_PORTFOLIO_BOOKS.find((book) => book.id === "all-weather");
    expect(allWeather).toBeTruthy();
    expect(allWeather!.tickers).toEqual(["VTI", "TLT", "IEF", "GLD", "DBC"]);
    expect(allWeather!.weights).toEqual({
      VTI: 30,
      TLT: 40,
      IEF: 15,
      GLD: 7.5,
      DBC: 7.5,
    });
    const weightSum = Object.values(allWeather!.weights!).reduce((sum, weight) => sum + weight, 0);
    expect(weightSum).toBeCloseTo(100, 5);

    const themeBooks = SAMPLE_PORTFOLIO_BOOKS.filter((book) => book.id !== "all-weather");
    expect(themeBooks).toHaveLength(6);
    for (const book of themeBooks) {
      expect(book.tickers).toHaveLength(10);
      expect(book.weights).toBeUndefined();
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

  it("sizes All-Weather to classic Dalio target weights", () => {
    const book = SAMPLE_PORTFOLIO_BOOKS.find((item) => item.id === "all-weather")!;
    const prices: Record<string, number> = {
      VTI: 250,
      TLT: 90,
      IEF: 95,
      GLD: 180,
      DBC: 22,
    };
    const positions = sizeSampleBookPositions(book, prices);
    expect(positions).toHaveLength(5);

    const total = positions.reduce((sum, pos) => sum + pos.shares * prices[pos.ticker]!, 0);
    expect(total).toBeCloseTo(SAMPLE_BOOK_TARGET_VALUE, 0);

    for (const pos of positions) {
      const weight = book.weights![pos.ticker]!;
      expect(pos.shares * prices[pos.ticker]!).toBeCloseTo(SAMPLE_BOOK_TARGET_VALUE * (weight / 100), 0);
    }

    // Direct weighted helper stays available for callers that pass raw maps.
    expect(weightedPositions(book.tickers, book.weights!, prices)).toEqual(positions);
  });

  it("keeps a sample preview separate from the saved personal portfolio", () => {
    const personal = [{ ticker: "OXY", shares: 100, averageCost: 45 }];
    const sample = [{ ticker: "NVDA", shares: 20, averageCost: 180 }];

    expect(resolveActivePortfolioPositions(personal, "ai-compute", sample)).toEqual(sample);
    expect(resolveActivePortfolioPositions(personal, null, sample)).toEqual(personal);
    expect(resolveActivePortfolioPositions(personal, "ai-compute", [])).toEqual(personal);
  });

  it("recognizes legacy sample positions without mistaking a personal book", () => {
    const book = SAMPLE_PORTFOLIO_BOOKS.find((item) => item.id === "ai-compute")!;
    const legacySample = book.tickers.map((ticker) => ({ ticker, shares: 10 }));

    expect(positionsMatchSampleBook(legacySample, book)).toBe(true);
    expect(positionsMatchSampleBook([{ ticker: "OXY", shares: 100 }], book)).toBe(false);
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
