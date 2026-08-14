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
  const STRATEGY_BOOK_IDS = [
    "all-weather",
    "sixty-forty",
    "three-fund",
    "permanent",
    "dogs-of-the-dow",
    "dividend",
    "growth",
  ] as const;

  it("keeps classic educational strategy and stock-screen allocations", () => {
    expect(SAMPLE_PORTFOLIO_BOOKS.map((book) => book.id)).toEqual([...STRATEGY_BOOK_IDS]);

    for (const book of SAMPLE_PORTFOLIO_BOOKS) {
      expect(book.weights).toBeTruthy();
      const weightSum = Object.values(book.weights!).reduce((sum, weight) => sum + weight, 0);
      expect(weightSum).toBeCloseTo(100, 5);
      expect(Object.keys(book.weights!).sort()).toEqual([...book.tickers].sort());
    }

    expect(SAMPLE_PORTFOLIO_BOOKS.find((book) => book.id === "sixty-forty")).toMatchObject({
      tickers: ["VTI", "BND"],
      weights: { VTI: 60, BND: 40 },
    });
    expect(SAMPLE_PORTFOLIO_BOOKS.find((book) => book.id === "three-fund")).toMatchObject({
      tickers: ["VTI", "VXUS", "BND"],
      weights: { VTI: 50, VXUS: 30, BND: 20 },
    });
    expect(SAMPLE_PORTFOLIO_BOOKS.find((book) => book.id === "permanent")).toMatchObject({
      tickers: ["VTI", "TLT", "GLD", "SGOV"],
      weights: { VTI: 25, TLT: 25, GLD: 25, SGOV: 25 },
    });
    expect(SAMPLE_PORTFOLIO_BOOKS.find((book) => book.id === "all-weather")).toMatchObject({
      tickers: ["VTI", "TLT", "IEF", "GLD", "DBC"],
      weights: {
        VTI: 30,
        TLT: 40,
        IEF: 15,
        GLD: 7.5,
        DBC: 7.5,
      },
    });
    expect(SAMPLE_PORTFOLIO_BOOKS.find((book) => book.id === "dogs-of-the-dow")?.tickers).toHaveLength(10);
    expect(SAMPLE_PORTFOLIO_BOOKS.find((book) => book.id === "dividend")?.tickers).toEqual([
      "JNJ", "PG", "KO", "PEP", "ABBV", "MRK", "HD", "MMM", "IBM", "VZ",
    ]);
    expect(SAMPLE_PORTFOLIO_BOOKS.find((book) => book.id === "growth")?.tickers).toHaveLength(10);
  });

  it("sizes equal-weight books to $100k when prices exist", () => {
    const tickers = ["JNJ", "PG", "KO", "PEP", "ABBV", "MRK", "HD", "MMM", "IBM", "VZ"];
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
    const positions = equalWeightPositions(tickers, prices);
    expect(positions).toHaveLength(10);
    const total = positions.reduce((sum, pos) => sum + pos.shares * prices[pos.ticker]!, 0);
    expect(total).toBeCloseTo(SAMPLE_BOOK_TARGET_VALUE, 0);
    for (const pos of positions) {
      expect(pos.shares * prices[pos.ticker]!).toBeCloseTo(SAMPLE_BOOK_TARGET_VALUE / 10, 0);
    }
  });

  it("sizes strategy books to their published target weights", () => {
    const prices: Record<string, number> = {
      VTI: 250,
      TLT: 90,
      IEF: 95,
      GLD: 180,
      DBC: 22,
      BND: 72,
      VXUS: 60,
      SGOV: 100,
      VZ: 40,
      IBM: 220,
      DOW: 55,
      CVX: 160,
      AMGN: 280,
      KO: 70,
      CSCO: 50,
      JPM: 200,
      MMM: 140,
      WBA: 12,
      JNJ: 160,
      PG: 170,
      PEP: 170,
      ABBV: 180,
      MRK: 110,
      HD: 380,
      AAPL: 190,
      MSFT: 420,
      NVDA: 120,
      AMZN: 180,
      GOOG: 160,
      META: 500,
      AVGO: 180,
      NFLX: 600,
      CRM: 280,
      COST: 800,
    };

    for (const bookId of STRATEGY_BOOK_IDS) {
      const book = SAMPLE_PORTFOLIO_BOOKS.find((item) => item.id === bookId)!;
      const positions = sizeSampleBookPositions(book, prices);
      expect(positions).toHaveLength(book.tickers.length);

      const total = positions.reduce((sum, pos) => sum + pos.shares * prices[pos.ticker]!, 0);
      expect(total).toBeCloseTo(SAMPLE_BOOK_TARGET_VALUE, 0);

      for (const pos of positions) {
        const weight = book.weights![pos.ticker]!;
        expect(pos.shares * prices[pos.ticker]!).toBeCloseTo(
          SAMPLE_BOOK_TARGET_VALUE * (weight / 100),
          0,
        );
      }
    }

    const allWeather = SAMPLE_PORTFOLIO_BOOKS.find((item) => item.id === "all-weather")!;
    expect(weightedPositions(allWeather.tickers, allWeather.weights!, prices)).toEqual(
      sizeSampleBookPositions(allWeather, prices),
    );
  });

  it("keeps a sample preview separate from the saved personal portfolio", () => {
    const personal = [{ ticker: "OXY", shares: 100, averageCost: 45 }];
    const sample = [{ ticker: "VTI", shares: 20, averageCost: 180 }];

    expect(resolveActivePortfolioPositions(personal, "sixty-forty", sample)).toEqual(sample);
    expect(resolveActivePortfolioPositions(personal, null, sample)).toEqual(personal);
    expect(resolveActivePortfolioPositions(personal, "sixty-forty", [])).toEqual(personal);
  });

  it("recognizes legacy sample positions without mistaking a personal book", () => {
    const book = SAMPLE_PORTFOLIO_BOOKS.find((item) => item.id === "sixty-forty")!;
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

  it("classifies dividend and Dogs-of-the-Dow names without falling through", () => {
    const dividend = ["JNJ", "PG", "KO", "PEP", "ABBV", "MRK", "HD", "MMM", "IBM", "VZ"];
    for (const ticker of dividend) {
      expect(getSectorForCompany(ticker)?.name).toBeTruthy();
    }
    expect(getSectorForCompany("JNJ")?.name).toBe("Health Care");
    expect(getSectorForCompany("PG")?.name).toBe("Consumer Staples");
    expect(getSectorForCompany("VZ")?.name).toBe("Communication Services");
    expect(getSectorForCompany("MMM")?.name).toBe("Industrials");
    expect(getSectorForCompany("AMGN")?.name).toBe("Health Care");
    expect(getSectorForCompany("CSCO")?.name).toBe("Technology");
    expect(getSectorForCompany("DOW")?.name).toBe("Materials");
    expect(getSectorForCompany("WBA")?.name).toBe("Consumer Staples");
  });
});
