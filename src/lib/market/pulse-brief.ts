export type PulseBriefTone = "positive" | "negative" | "mixed" | "neutral";

export interface PulseBriefMetric {
  label: string;
  value: string;
  tone?: PulseBriefTone;
}

export interface PulseBrief {
  eyebrow: string;
  headline: string;
  summary: string;
  tone: PulseBriefTone;
  metrics: PulseBriefMetric[];
}

interface MarketMove {
  ticker: string;
  name: string;
  changePercent: number | null;
}

interface TrendingMove {
  ticker: string;
  companyName: string;
  changePercent: number | null;
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function signedPercent(value: number | null, digits = 1): string {
  if (!isNumber(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function metricTone(value: number): PulseBriefTone {
  if (value > 0.05) return "positive";
  if (value < -0.05) return "negative";
  return "neutral";
}

export function buildIndexTapeBrief(markets: MarketMove[]): PulseBrief {
  const ranked = markets
    .filter((market): market is MarketMove & { changePercent: number } => isNumber(market.changePercent))
    .sort((a, b) => b.changePercent - a.changePercent);

  if (ranked.length === 0) {
    return {
      eyebrow: "State of the tape",
      headline: "The market is waiting for a clean read.",
      summary: "Major-index participation is unavailable right now. Use the risk gauges and cross-asset map below for context.",
      tone: "neutral",
      metrics: [
        { label: "Leader", value: "—" },
        { label: "Breadth", value: "—" },
        { label: "Pressure", value: "—" },
      ],
    };
  }

  const leader = ranked[0];
  const laggard = ranked.at(-1) ?? leader;
  const advancing = ranked.filter((market) => market.changePercent > 0.05).length;
  const declining = ranked.filter((market) => market.changePercent < -0.05).length;
  const participation = advancing / ranked.length;
  const selling = declining / ranked.length;

  let headline = "The tape is split beneath the surface.";
  let summary = `${advancing} of ${ranked.length} major indexes are higher, with ${leader.name} leading and ${laggard.name} under the most pressure.`;
  let tone: PulseBriefTone = "mixed";

  if (participation >= 0.67) {
    headline = "Participation is broadening across the market.";
    summary = `${advancing} of ${ranked.length} major indexes are advancing, led by ${leader.name}. The move has more support than a single-index rally.`;
    tone = "positive";
  } else if (selling >= 0.67) {
    headline = "Selling pressure is broad across the tape.";
    summary = `${declining} of ${ranked.length} major indexes are lower. ${laggard.name} is weakest, and participation is not providing much shelter.`;
    tone = "negative";
  } else if (leader.changePercent > 0.25 && participation <= 0.5) {
    headline = "Leadership is narrow, not broad.";
    summary = `${leader.name} is carrying the strongest move, but only ${advancing} of ${ranked.length} major indexes are advancing. Treat the headline rally with some skepticism.`;
  } else if (advancing === 0 && declining === 0) {
    headline = "The tape is waiting for direction.";
    summary = "Major indexes are clustered near flat. Cross-asset leadership and volatility may offer the cleaner signal until participation changes.";
    tone = "neutral";
  }

  return {
    eyebrow: "State of the tape",
    headline,
    summary,
    tone,
    metrics: [
      { label: "Leader", value: `${leader.ticker} ${signedPercent(leader.changePercent)}`, tone: metricTone(leader.changePercent) },
      { label: "Breadth", value: `${advancing} / ${ranked.length} up`, tone: participation >= 0.67 ? "positive" : participation <= 0.33 ? "negative" : "mixed" },
      { label: "Pressure", value: `${laggard.ticker} ${signedPercent(laggard.changePercent)}`, tone: metricTone(laggard.changePercent) },
    ],
  };
}

export function buildTrendingBreadthBrief(
  equalWeightLead: number | null,
  smallCapLead: number | null,
): PulseBrief {
  const readings = [equalWeightLead, smallCapLead].filter(isNumber);
  const bothLeading = readings.length === 2 && readings.every((value) => value >= 0.25);
  const bothLagging = readings.length === 2 && readings.every((value) => value <= -0.25);
  const split = readings.length === 2 && Math.sign(readings[0]) !== Math.sign(readings[1]);

  let headline = "Participation is close to the benchmark.";
  let summary = "Equal-weight stocks and small caps are moving near the S&P 500. The active-name board below is the better place to look for emerging leadership.";
  let tone: PulseBriefTone = "neutral";
  let confirmation = "Neutral";

  if (readings.length === 0) {
    headline = "Breadth confirmation is temporarily unavailable.";
    summary = "Use the active-name board below to see which stocks are attracting the most liquidity and movement.";
    confirmation = "Unavailable";
  } else if (bothLeading) {
    headline = "Momentum has broad market confirmation.";
    summary = "Equal-weight stocks and small caps are both outrunning the S&P 500. Leadership is extending beyond the largest companies—a healthier backdrop for trending moves.";
    tone = "positive";
    confirmation = "Broad";
  } else if (bothLagging) {
    headline = "Momentum is concentrated at the top.";
    summary = "Equal-weight stocks and small caps are both lagging the S&P 500. Trending names may be powerful, but the broader market is not confirming them yet.";
    tone = "negative";
    confirmation = "Narrow";
  } else if (split) {
    headline = "Participation is sending a mixed signal.";
    summary = "Equal-weight stocks and small caps disagree on leadership. Favor moves with company-specific evidence instead of assuming a broad risk-on tape.";
    tone = "mixed";
    confirmation = "Split";
  } else if (readings.some((value) => value >= 0.25)) {
    headline = "Breadth is improving, but not fully confirmed.";
    summary = "One participation measure is leading the S&P 500 while the other remains near the benchmark. Momentum is broadening selectively, not decisively.";
    tone = "mixed";
    confirmation = "Partial";
  } else if (readings.some((value) => value <= -0.25)) {
    headline = "Breadth is softening beneath the leaders.";
    summary = "At least one participation measure is lagging the S&P 500. Look for durable evidence before chasing the most active names.";
    tone = "negative";
    confirmation = "Soft";
  }

  return {
    eyebrow: "Breadth check",
    headline,
    summary,
    tone,
    metrics: [
      { label: "Equal weight vs S&P", value: signedPercent(equalWeightLead, 2), tone: isNumber(equalWeightLead) ? metricTone(equalWeightLead) : "neutral" },
      { label: "Small caps vs S&P", value: signedPercent(smallCapLead, 2), tone: isNumber(smallCapLead) ? metricTone(smallCapLead) : "neutral" },
      { label: "Confirmation", value: confirmation, tone },
    ],
  };
}

export function buildMomentumBrief(moves: TrendingMove[]): PulseBrief {
  const ranked = moves
    .filter((move): move is TrendingMove & { changePercent: number } => isNumber(move.changePercent))
    .sort((a, b) => b.changePercent - a.changePercent);

  if (ranked.length === 0) {
    return {
      eyebrow: "In motion",
      headline: "Active-name momentum is unavailable.",
      summary: "The board will repopulate when fresh price and liquidity data return.",
      tone: "neutral",
      metrics: [],
    };
  }

  const winner = ranked[0];
  const loser = ranked.at(-1) ?? winner;
  const advancing = ranked.filter((move) => move.changePercent > 0.05).length;
  const declining = ranked.filter((move) => move.changePercent < -0.05).length;
  const upShare = advancing / ranked.length;

  let headline = "Momentum is split across active names.";
  let summary = `${winner.companyName} is leading while ${loser.companyName} is under the most pressure. Follow-through matters more than the first move.`;
  let tone: PulseBriefTone = "mixed";

  if (upShare >= 0.67) {
    headline = "Buying pressure is broad across active names.";
    summary = `${advancing} of ${ranked.length} high-activity stocks are higher, led by ${winner.companyName}. Breadth supports the move, but liquidity rank is not a recommendation.`;
    tone = "positive";
  } else if (declining / ranked.length >= 0.67) {
    headline = "Selling pressure is defining the active tape.";
    summary = `${declining} of ${ranked.length} high-activity stocks are lower, with ${loser.companyName} weakest. Separate forced attention from durable opportunity.`;
    tone = "negative";
  } else if (winner.changePercent > 2 && advancing <= declining) {
    headline = "A few winners are masking a divided tape.";
    summary = `${winner.companyName} has the strongest upside move, but advancing names do not outnumber decliners. Momentum is concentrated rather than pervasive.`;
  }

  return {
    eyebrow: "In motion",
    headline,
    summary,
    tone,
    metrics: [
      { label: "Top gainer", value: `${winner.ticker} ${signedPercent(winner.changePercent)}`, tone: metricTone(winner.changePercent) },
      { label: "Advancing", value: `${advancing} / ${ranked.length}`, tone: upShare >= 0.67 ? "positive" : upShare <= 0.33 ? "negative" : "mixed" },
      { label: "Weakest move", value: `${loser.ticker} ${signedPercent(loser.changePercent)}`, tone: metricTone(loser.changePercent) },
    ],
  };
}
