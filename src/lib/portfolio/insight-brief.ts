import type { SampleBook } from "@/lib/portfolio/sample-books";
import type { PortfolioRiskFlags } from "@/lib/portfolio/types";

export type InsightFindingTone = "attention" | "watch" | "data";

export type InsightFinding = {
  id: string;
  label: string;
  title: string;
  detail: string;
  value: string;
  tone: InsightFindingTone;
  ticker?: string;
};

export type StrategyDesignBrief = {
  mode: "strategy";
  bookId: string;
  label: string;
  principle: string;
  design: string;
  stress: string;
  sleeves: Array<{ ticker: string; weight: number; role: string }>;
};

export type PersonalInsightBrief = {
  mode: "personal";
  headline: string;
  summary: string;
  findings: InsightFinding[];
};

export type PortfolioInsightBrief = StrategyDesignBrief | PersonalInsightBrief;

const STRATEGY_DESIGNS: Record<
  string,
  Omit<StrategyDesignBrief, "mode" | "bookId" | "label" | "sleeves"> & {
    roles: Record<string, string>;
  }
> = {
  "all-weather": {
    principle: "Balance risk across rising and falling growth and inflation — not dollars equally.",
    design: "Bonds get more capital because they contribute less volatility per dollar than stocks.",
    stress: "The hard climate is rising rates with rising inflation: stocks and bonds both suffer; gold and commodities are the offset.",
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
    roles: {
      VTI: "Growth engine",
      BND: "Ballast",
    },
  },
  "three-fund": {
    principle: "Own productive global capitalism. Keep fees, complexity, and ego near zero.",
    design: "US stocks, international stocks, and a bond sleeve — the whole market without stock-picking.",
    stress: "The hard climate is a global equity bear. Bonds help only when rates and credit cooperate.",
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

function weightLabel(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

/** Strategy books teach design. Do not grade intentional sleeve weights as “risk.” */
export function buildStrategyDesignBrief(book: SampleBook): StrategyDesignBrief | null {
  const design = STRATEGY_DESIGNS[book.id];
  if (!design || !book.weights) return null;

  return {
    mode: "strategy",
    bookId: book.id,
    label: book.label,
    principle: design.principle,
    design: design.design,
    stress: design.stress,
    sleeves: book.tickers.map((ticker) => ({
      ticker,
      weight: book.weights![ticker] ?? 0,
      role: design.roles[ticker] ?? "Sleeve",
    })),
  };
}

/**
 * Personal books get sparse pressure points — no score.
 * Keep only findings that change a decision; drop padded “all clear” theater.
 */
export function buildPersonalInsightBrief(flags: PortfolioRiskFlags): PersonalInsightBrief {
  const findings: InsightFinding[] = [];

  for (const position of flags.singleConcentration) {
    findings.push({
      id: `concentration-${position.ticker}`,
      label: "Position size",
      title: `${position.ticker} is carrying the book`,
      detail: `A 20% move in ${position.ticker} moves the portfolio by roughly ${(position.weight * 0.2).toFixed(1)}%.`,
      value: weightLabel(position.weight),
      tone: "attention",
      ticker: position.ticker,
    });
  }

  for (const sector of flags.sectorConcentration) {
    findings.push({
      id: `sector-${sector.sector}`,
      label: "Shared shock",
      title: `${sector.sector} is clustered`,
      detail: "These names can answer the same macro or earnings shock together.",
      value: weightLabel(sector.weight),
      tone: "attention",
    });
  }

  if (flags.topThreeExceedsSixty) {
    findings.push({
      id: "top-three",
      label: "Top three",
      title: "Most outcomes hinge on three names",
      detail: "Stress the largest positions as a group, not one ticker at a time.",
      value: weightLabel(flags.topThreeCombinedWeight),
      tone: "attention",
    });
  }

  // Elevated 12–20%: only if nothing louder already fired — keep the list short.
  if (findings.length === 0) {
    for (const position of flags.elevatedPositions.slice(0, 2)) {
      findings.push({
        id: `elevated-${position.ticker}`,
        label: "Watch",
        title: `${position.ticker} is becoming meaningful`,
        detail: "Not dominant yet — large enough that size should be a conscious choice.",
        value: weightLabel(position.weight),
        tone: "watch",
        ticker: position.ticker,
      });
    }
  }

  if (flags.missingPriceCount > 0) {
    findings.push({
      id: "missing-price",
      label: "Data",
      title: `${flags.missingPriceCount} price${flags.missingPriceCount === 1 ? "" : "s"} missing`,
      detail: "Totals ignore unmarked positions until quotes land.",
      value: "Fix",
      tone: "data",
    });
  }

  if (flags.missingCostCount > 0) {
    findings.push({
      id: "missing-cost",
      label: "Data",
      title: `${flags.missingCostCount} cost basis missing`,
      detail: "Unrealized return is incomplete without average cost.",
      value: "Add",
      tone: "data",
    });
  }

  const attention = findings.filter((item) => item.tone === "attention").length;
  if (attention > 0) {
    return {
      mode: "personal",
      headline: "A few names can break it.",
      summary: "Size is the risk. Fix what can dominate before adding complexity.",
      findings: findings.slice(0, 4),
    };
  }

  if (findings.length > 0) {
    return {
      mode: "personal",
      headline: "Mostly sound.",
      summary: "Nothing dominates. Close the remaining gaps.",
      findings: findings.slice(0, 4),
    };
  }

  return {
    mode: "personal",
    headline: "No name runs the book.",
    summary: "Position and sector weights stay inside the rails.",
    findings: [],
  };
}

export function buildPortfolioInsightBrief(
  flags: PortfolioRiskFlags,
  _sampleBook?: SampleBook | null,
): PortfolioInsightBrief {
  return buildPersonalInsightBrief(flags);
}
