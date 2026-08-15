import type { PoliticalTrade } from "@/lib/political-trades";
import type { InstitutionalManagerBook } from "@/lib/sec/institutional";
import { buildPoliticalBrief } from "@/lib/market/smart-money-brief";

export type SmartMoneyStageTone = "positive" | "negative" | "watch" | "neutral";

export interface SmartMoneyStageMetric {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "alert";
}

export interface SmartMoneyStageSummary {
  headline: string;
  summary: string;
  tone: SmartMoneyStageTone;
  metrics: SmartMoneyStageMetric[];
}

function formatFilingDate(value: string | null | undefined): string {
  if (!value) return "date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function buildInstitutionStageSummary(
  book: InstitutionalManagerBook,
): SmartMoneyStageSummary {
  const additions = book.newCount + book.increasedCount;
  const reductions = book.reducedCount + book.exitedCount;

  let headline = `${book.manager.displayName} is mostly holding.`;
  let tone: SmartMoneyStageTone = "neutral";
  if (additions > reductions) {
    headline = `${book.manager.displayName} is adding.`;
    tone = "positive";
  } else if (reductions > additions) {
    headline = `${book.manager.displayName} is trimming.`;
    tone = "negative";
  }

  return {
    headline,
    summary: `Quarter ended ${formatFilingDate(book.filingQuarter)} · filed ${formatFilingDate(book.filingDate)}. Position changes, not live trades.`,
    tone,
    metrics: [
      { label: "New / added", value: String(additions), tone: "positive" },
      { label: "Trimmed / exited", value: String(reductions), tone: "negative" },
      { label: "Holdings", value: String(book.positionCount) },
    ],
  };
}

export function buildPoliticianStageSummary(
  trades: PoliticalTrade[],
): SmartMoneyStageSummary {
  const brief = buildPoliticalBrief(trades);
  const tone: SmartMoneyStageTone = brief.tone === "positive"
    ? "positive"
    : brief.tone === "negative"
      ? "negative"
      : brief.tone === "alert"
        ? "watch"
        : "neutral";

  return {
    headline: brief.headline,
    summary: brief.summary,
    tone,
    metrics: brief.metrics.map((metric) => ({
      label: metric.label,
      value: metric.value,
      tone: metric.tone === "positive"
        ? "positive"
        : metric.tone === "negative"
          ? "negative"
          : metric.tone === "alert"
            ? "alert"
            : undefined,
    })),
  };
}
