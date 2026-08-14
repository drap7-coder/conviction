import type { InstitutionalMarketIdea } from "@/lib/sec/institutional";
import type { PoliticalTrade } from "@/lib/political-trades";
import { getMarketInstrument } from "@/lib/market/market-instruments";

export type SmartMoneyTone = "positive" | "negative" | "mixed" | "neutral" | "alert";

export interface SmartMoneyMetric {
  label: string;
  value: string;
  tone?: SmartMoneyTone;
}

export interface SmartMoneyBrief {
  eyebrow: string;
  headline: string;
  summary: string;
  tone: SmartMoneyTone;
  metrics: SmartMoneyMetric[];
}

export interface InstitutionalPriority {
  grade: "A" | "B" | "C";
  label: string;
  reason: string;
  tone: SmartMoneyTone;
}

export interface PoliticalTradeGroup {
  ticker: string;
  assetName: string;
  trades: PoliticalTrade[];
  filerCount: number;
  purchaseCount: number;
  saleCount: number;
  otherCount: number;
  estimatedPurchases: number;
  estimatedSales: number;
  estimatedTotal: number;
  lateCount: number;
  medianLag: number | null;
  latestFilingDate: string;
  directionLabel: string;
  tone: SmartMoneyTone;
  /** Index/ETF/broad-market sleeves — size without stock-level insight. */
  isBroadMarket: boolean;
}

function plural(value: number, singular: string, pluralForm = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralForm}`;
}

/**
 * Broad indexes and ETFs inflate midpoint size without naming a business.
 * Prefer single-name equities for political research leads.
 */
export function isBroadMarketPoliticalPlay(ticker: string, assetName = ""): boolean {
  const instrument = getMarketInstrument(ticker);
  if (instrument?.kind === "etf") return true;
  if (instrument?.kind === "crypto") return true;
  return /\b(ETF|ETN|index fund|S&P\s*500|Nasdaq|Russell|Dow Jones|Treasury|bond fund)\b/i.test(assetName);
}

export function formatCompactMoney(value: number): string {
  const amount = Math.abs(value);
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

export function classifyInstitutionalIdea(idea: InstitutionalMarketIdea): InstitutionalPriority {
  if (
    (idea.newPositionCount >= 2 && idea.increasedCount >= 2) ||
    idea.newPositionCount >= 3
  ) {
    return {
      grade: "A",
      label: "Research now",
      reason: `${plural(idea.newPositionCount, "new position")} · ${plural(idea.increasedCount, "add")}`,
      tone: "positive",
    };
  }

  if (idea.newPositionCount >= 1 || idea.increasedCount >= 2) {
    return {
      grade: "B",
      label: "Watch next",
      reason: idea.newPositionCount > 0
        ? `${plural(idea.newPositionCount, "new position")} · ${plural(idea.holderCount, "holder")}`
        : `${plural(idea.increasedCount, "fund add")} · ${plural(idea.holderCount, "holder")}`,
      tone: "mixed",
    };
  }

  return {
    grade: "C",
    label: "Filing only",
    reason: `${plural(idea.holderCount, "holder")} · no fresh convergence`,
    tone: "neutral",
  };
}

export function buildInstitutionalBrief(
  ideas: InstitutionalMarketIdea[],
  managerCount: number,
): SmartMoneyBrief {
  const top = ideas[0];
  if (!top) {
    return {
      eyebrow: "Institutional research queue",
      headline: "No filing signal clears the screen right now.",
      summary: "The latest 13F comparison has not produced a research-worthy ownership change.",
      tone: "neutral",
      metrics: [
        { label: "Research now", value: "0" },
        { label: "Fresh opens", value: "0" },
        { label: "Managers read", value: String(managerCount) },
      ],
    };
  }

  const priority = classifyInstitutionalIdea(top);
  const researchNow = ideas.filter((idea) => classifyInstitutionalIdea(idea).grade === "A").length;
  const freshOpens = ideas.reduce((sum, idea) => sum + idea.newPositionCount, 0);

  let headline = `${top.ticker} leads the institutional research queue.`;
  let summary = `${plural(top.holderCount, "tracked manager")} hold the company. This is a filing signal to investigate, not a live trade recommendation.`;

  if (priority.grade === "A") {
    headline = `Fresh fund buying converges on ${top.ticker}.`;
    summary = `${plural(top.newPositionCount, "manager")} opened positions and ${plural(top.increasedCount, "manager")} added, while ${top.holderCount} of ${managerCount} tracked managers hold it. The convergence earns deeper research.`;
  } else if (top.newPositionCount > 0) {
    headline = `A fresh position puts ${top.ticker} at the front of the queue.`;
    summary = `${plural(top.newPositionCount, "manager")} opened a position and ${plural(top.increasedCount, "manager")} added. Confirm the thesis and current valuation before treating the filing as actionable.`;
  }

  return {
    eyebrow: "Institutional research queue",
    headline,
    summary,
    tone: priority.tone,
    metrics: [
      { label: "Research now", value: String(researchNow), tone: researchNow > 0 ? "positive" : "neutral" },
      { label: "Fresh opens", value: String(freshOpens), tone: freshOpens > 0 ? "positive" : "neutral" },
      { label: "Managers read", value: String(managerCount) },
    ],
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function groupPoliticalTrades(trades: PoliticalTrade[]): PoliticalTradeGroup[] {
  const byTicker = new Map<string, PoliticalTrade[]>();
  for (const trade of trades) {
    const group = byTicker.get(trade.ticker) ?? [];
    group.push(trade);
    byTicker.set(trade.ticker, group);
  }

  return [...byTicker.entries()]
    .map(([ticker, groupTrades]): PoliticalTradeGroup => {
      const purchases = groupTrades.filter((trade) => trade.direction === "purchase");
      const sales = groupTrades.filter((trade) => trade.direction === "sale");
      const otherCount = groupTrades.length - purchases.length - sales.length;
      const estimatedPurchases = purchases.reduce((sum, trade) => sum + (trade.estimatedAmount ?? 0), 0);
      const estimatedSales = sales.reduce((sum, trade) => sum + (trade.estimatedAmount ?? 0), 0);
      const lateCount = groupTrades.filter((trade) => trade.isLate).length;
      const filerCount = new Set(groupTrades.map((trade) => trade.filerName)).size;
      const medianLag = median(groupTrades
        .map((trade) => trade.daysToFile)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value)));

      let directionLabel = "Mixed activity";
      let tone: SmartMoneyTone = "mixed";
      if (purchases.length > 0 && sales.length === 0) {
        directionLabel = purchases.length > 1 ? "Purchase cluster" : "Purchase";
        tone = "positive";
      } else if (sales.length > 0 && purchases.length === 0) {
        directionLabel = sales.length > 1 ? "Sale cluster" : "Sale";
        tone = "negative";
      } else if (purchases.length === 0 && sales.length === 0) {
        directionLabel = "Other disclosure";
        tone = "neutral";
      }

      return {
        ticker,
        assetName: groupTrades[0]?.assetName ?? ticker,
        trades: [...groupTrades].sort((a, b) => b.filingDate.localeCompare(a.filingDate)),
        filerCount,
        purchaseCount: purchases.length,
        saleCount: sales.length,
        otherCount,
        estimatedPurchases,
        estimatedSales,
        estimatedTotal: estimatedPurchases + estimatedSales + groupTrades
          .filter((trade) => trade.direction !== "purchase" && trade.direction !== "sale")
          .reduce((sum, trade) => sum + (trade.estimatedAmount ?? 0), 0),
        lateCount,
        medianLag,
        latestFilingDate: groupTrades.reduce(
          (latest, trade) => trade.filingDate > latest ? trade.filingDate : latest,
          groupTrades[0]?.filingDate ?? "",
        ),
        directionLabel,
        tone,
        isBroadMarket: isBroadMarketPoliticalPlay(ticker, groupTrades[0]?.assetName),
      };
    })
    .sort((a, b) =>
      Number(a.isBroadMarket) - Number(b.isBroadMarket) ||
      b.estimatedTotal - a.estimatedTotal ||
      b.trades.length - a.trades.length ||
      b.latestFilingDate.localeCompare(a.latestFilingDate),
    );
}

/** Single-name clusters only — used for decision brief and radar. */
export function insightPoliticalGroups(groups: PoliticalTradeGroup[]): PoliticalTradeGroup[] {
  return groups.filter((group) => !group.isBroadMarket);
}

export function buildPoliticalBrief(trades: PoliticalTrade[]): SmartMoneyBrief {
  const groups = groupPoliticalTrades(trades);
  const insightGroups = insightPoliticalGroups(groups);
  const top = insightGroups[0] ?? null;
  const insightTrades = insightGroups.flatMap((group) => group.trades);
  const briefTrades = insightTrades.length > 0 ? insightTrades : trades;
  const purchases = briefTrades.filter((trade) => trade.direction === "purchase");
  const sales = briefTrades.filter((trade) => trade.direction === "sale");
  const purchaseAmount = purchases.reduce((sum, trade) => sum + (trade.estimatedAmount ?? 0), 0);
  const saleAmount = sales.reduce((sum, trade) => sum + (trade.estimatedAmount ?? 0), 0);
  const overallLag = median(briefTrades
    .map((trade) => trade.daysToFile)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value)));
  const broadMarketCount = groups.length - insightGroups.length;

  if (!top) {
    return {
      eyebrow: "STOCK Act",
      headline: insightGroups.length === 0 && groups.length > 0
        ? "Mostly ETFs. No stock lead."
        : "No filings yet.",
      summary: insightGroups.length === 0 && groups.length > 0
        ? `${plural(broadMarketCount, "index/ETF cluster")} filed — none name a single business.`
        : "New disclosures will show up here.",
      tone: "neutral",
      metrics: insightGroups.length === 0 && groups.length > 0
        ? [
          { label: "Stock clusters", value: "0" },
          { label: "ETF / index", value: String(broadMarketCount) },
          { label: "Median lag", value: overallLag === null ? "—" : `${overallLag}d` },
        ]
        : [],
    };
  }

  let headline = `${top.ticker} leads the tape.`;
  let summary = `${plural(top.trades.length, "filing")} · ${plural(top.filerCount, "official")} · ${formatCompactMoney(top.estimatedTotal)} midpoint.`;
  let tone = top.tone;

  if (top.lateCount > 0) {
    headline = `${top.ticker} leads — filed late.`;
    summary = `${formatCompactMoney(top.estimatedTotal)} midpoint · ${plural(top.lateCount, "late filing")}. Size without timing.`;
    tone = "alert";
  } else if (top.purchaseCount > top.saleCount) {
    headline = `${top.ticker} leads buying.`;
    summary = `${plural(top.purchaseCount, "buy")} · ${plural(top.filerCount, "official")} · ${formatCompactMoney(top.estimatedPurchases)} midpoint. Research lead, not intent.`;
    tone = "positive";
  } else if (top.saleCount > top.purchaseCount) {
    headline = `${top.ticker} leads selling.`;
    summary = `${plural(top.saleCount, "sale")} · ${plural(top.filerCount, "official")} · ${formatCompactMoney(top.estimatedSales)} midpoint. Motive unknown — check context.`;
    tone = "negative";
  }

  if (broadMarketCount > 0) {
    summary += ` ${broadMarketCount} ETF${broadMarketCount === 1 ? "" : "s"} demoted.`;
  }

  return {
    eyebrow: "STOCK Act",
    headline,
    summary,
    tone,
    metrics: [
      { label: "Buys", value: formatCompactMoney(purchaseAmount), tone: "positive" },
      { label: "Sells", value: formatCompactMoney(saleAmount), tone: "negative" },
      { label: "Median lag", value: overallLag === null ? "—" : `${overallLag}d`, tone: overallLag !== null && overallLag > 45 ? "alert" : "neutral" },
    ],
  };
}
