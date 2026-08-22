import { sampleBookSleeves, type SampleBook } from "@/lib/portfolio/sample-books";

/** Illustrative study stats for sample books — not a live track record. */
export type StudyPerformance = {
  periodLabel: string;
  annualizedPct: number;
  bestYear: { year: number; pct: number };
  worstYear: { year: number; pct: number };
};

export type StudyBrief = {
  bookId: string;
  label: string;
  principle: string;
  design: string;
  stress: string;
  performance: StudyPerformance;
  sleeves: Array<{ ticker: string; weight: number; role: string }>;
};

const STUDY_BRIEFS: Record<
  string,
  Omit<StudyBrief, "bookId" | "label" | "sleeves"> & {
    roles: Record<string, string>;
  }
> = {
  "all-weather": {
    principle: "Balance risk across rising and falling growth and inflation — not dollars equally.",
    design: "Bonds get more capital because they contribute less volatility per dollar than stocks.",
    stress: "The hard climate is rising rates with rising inflation: stocks and bonds both suffer; gold and commodities are the offset.",
    performance: {
      periodLabel: "Illustrative 1984–2023 study",
      annualizedPct: 7.8,
      bestYear: { year: 1995, pct: 18.4 },
      worstYear: { year: 2022, pct: -14.2 },
    },
    roles: {
      VTI: "Growth risk",
      TLT: "Deflation / rate-cut ballast",
      IEF: "Intermediate rate ballast",
      GLD: "Inflation / currency hedge",
      DBC: "Inflation / supply shock",
    },
  },
  "sixty-forty": {
    principle: "One growth engine, one ballast. Simple enough to hold through a cycle.",
    design: "Stocks compound; bonds are there to reduce the depth and duration of drawdowns.",
    stress: "The hard climate is inflation-forced rate hikes — the 2022 pattern — when stocks and bonds fall together.",
    performance: {
      periodLabel: "Illustrative US 60/40, 1976–2023",
      annualizedPct: 9.1,
      bestYear: { year: 1995, pct: 31.5 },
      worstYear: { year: 2008, pct: -20.1 },
    },
    roles: {
      VTI: "Growth engine",
      BND: "Ballast",
    },
  },
  "three-fund": {
    principle: "Own productive global capitalism. Keep fees, complexity, and ego near zero.",
    design: "US stocks, international stocks, and a bond sleeve — the whole market without stock-picking.",
    stress: "The hard climate is a global equity bear. Bonds help only when rates and credit cooperate.",
    performance: {
      periodLabel: "Illustrative global three-fund, 1990–2023",
      annualizedPct: 8.4,
      bestYear: { year: 2009, pct: 28.6 },
      worstYear: { year: 2008, pct: -24.8 },
    },
    roles: {
      VTI: "US growth",
      VXUS: "International growth",
      BND: "Ballast",
    },
  },
  permanent: {
    principle: "Survive being wrong. Equal capital to four economic seasons.",
    design: "Twenty-five percent each in stocks, long bonds, gold, and cash — no prediction required.",
    stress: "The hard climate is a long equity bull: you will lag. The point is avoiding ruin, not winning every decade.",
    performance: {
      periodLabel: "Illustrative Permanent Portfolio, 1972–2023",
      annualizedPct: 8.0,
      bestYear: { year: 1979, pct: 23.1 },
      worstYear: { year: 2022, pct: -12.4 },
    },
    roles: {
      VTI: "Prosperity / growth",
      TLT: "Deflation / depression",
      GLD: "Inflation / crisis",
      SGOV: "Cash / flexibility",
    },
  },
  "dogs-of-the-dow": {
    principle: "Buy the Dow’s highest yields, equal-weight, and rebalance once a year — no forecasting.",
    design: "Ten familiar Dow businesses. Yield is the screen; equal weight is the risk control.",
    stress: "The hard climate is a structural dividend cut wave or a long growth bull where high yielders lag.",
    performance: {
      periodLabel: "Illustrative Dogs screen, 1990–2023",
      annualizedPct: 10.2,
      bestYear: { year: 2013, pct: 34.8 },
      worstYear: { year: 2008, pct: -33.2 },
    },
    roles: {
      VZ: "Telecom cash flow",
      IBM: "Enterprise services",
      DOW: "Materials cycle",
      CVX: "Energy cash return",
      AMGN: "Biotech cash return",
      KO: "Staples brand",
      CSCO: "Networking franchise",
      JPM: "Money-center bank",
      MMM: "Industrial conglomerate",
      WBA: "Retail distribution",
    },
  },
  dividend: {
    principle: "Own understandable cash machines. Get paid while you wait for the story to play out.",
    design: "Ten blue-chip payers across health care, staples, industrials, and communication — equal weight.",
    stress: "The hard climate is rising rates that reprice income stocks, or an earnings recession that forces cuts.",
    performance: {
      periodLabel: "Illustrative dividend basket, 1990–2023",
      annualizedPct: 9.6,
      bestYear: { year: 2013, pct: 29.4 },
      worstYear: { year: 2008, pct: -27.6 },
    },
    roles: {
      JNJ: "Health care franchise",
      PG: "Staples brand",
      KO: "Beverage cash flow",
      PEP: "Snacks and drinks",
      ABBV: "Pharma cash return",
      MRK: "Pharma pipeline",
      HD: "Home improvement",
      MMM: "Industrial cash",
      IBM: "Enterprise services",
      VZ: "Telecom yield",
    },
  },
  growth: {
    principle: "Compound with businesses whose earnings stories you can explain in a paragraph.",
    design: "Ten mega-cap compounders, equal-weighted so no single narrative owns the book.",
    stress: "The hard climate is rising discount rates or a growth-earnings miss cluster — these names move together.",
    performance: {
      periodLabel: "Illustrative mega-cap growth, 2010–2023",
      annualizedPct: 15.8,
      bestYear: { year: 2023, pct: 48.2 },
      worstYear: { year: 2022, pct: -36.4 },
    },
    roles: {
      AAPL: "Consumer platform",
      MSFT: "Enterprise software",
      NVDA: "Compute demand",
      AMZN: "Commerce and cloud",
      GOOG: "Search and ads",
      META: "Attention network",
      AVGO: "Semiconductor IP",
      NFLX: "Streaming demand",
      CRM: "Software platform",
      COST: "Membership retail",
    },
  },
};

/** Study templates teach design. Live books do not get this card. */
export function getStudyBrief(book: SampleBook): StudyBrief | null {
  const brief = STUDY_BRIEFS[book.id];
  if (!brief) return null;

  return {
    bookId: book.id,
    label: book.label,
    principle: brief.principle,
    design: brief.design,
    stress: brief.stress,
    performance: brief.performance,
    sleeves: sampleBookSleeves(book).map((sleeve) => ({
      ...sleeve,
      role: brief.roles[sleeve.ticker] ?? "Sleeve",
    })),
  };
}
