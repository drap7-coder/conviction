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

/** First-paint / empty hero — Institutions tab only. */
export const INSTITUTION_STAGE_IDLE: SmartMoneyStageSummary = {
  headline: "Read a disclosed 13F book.",
  summary: "Quarter-end holdings, filed up to 45 days late. A lead — not a live portfolio.",
  tone: "neutral",
  metrics: [
    { label: "Source", value: "13F" },
    { label: "Books", value: "Lagged" },
    { label: "Max lag", value: "45d", tone: "alert" },
  ],
};

/** First-paint / empty hero — Politicians tab only. */
export const POLITICIAN_STAGE_IDLE: SmartMoneyStageSummary = {
  headline: "Read the latest STOCK Act tape.",
  summary: "Reported trades can land after the transaction. Check the lag before you lean on size.",
  tone: "neutral",
  metrics: [
    { label: "Source", value: "STOCK Act" },
    { label: "Tape", value: "Reported" },
    { label: "Timing", value: "Lagged", tone: "alert" },
  ],
};

function formatFilingDate(value: string | null | undefined): string {
  if (!value) return "date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function directionalValue(
  value: string,
  tone: SmartMoneyStageMetric["tone"],
): string {
  if (tone !== "positive" && tone !== "negative") return value;
  if (value === "—" || /^[+−-]/.test(value)) return value;
  const numeric = Number(value.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(numeric) && numeric === 0) return value;
  return `${tone === "positive" ? "+" : "−"}${value}`;
}

export function buildInstitutionStageSummary(
  book: InstitutionalManagerBook,
): SmartMoneyStageSummary {
  const additions = book.newCount + book.increasedCount;
  const reductions = book.reducedCount + book.exitedCount;

  let headline = `${book.manager.displayName} matched additions with trims.`;
  let tone: SmartMoneyStageTone = "neutral";
  if (additions > reductions) {
    headline = `${book.manager.displayName} added more than it trimmed.`;
    tone = "positive";
  } else if (reductions > additions) {
    headline = `${book.manager.displayName} trimmed more than it added.`;
    tone = "negative";
  }

  return {
    headline,
    summary: `Quarter ended ${formatFilingDate(book.filingQuarter)} · filed ${formatFilingDate(book.filingDate)}. Position changes, not live trades.`,
    tone,
    metrics: [
      { label: "New / added", value: directionalValue(String(additions), "positive"), tone: "positive" },
      { label: "Trimmed / exited", value: directionalValue(String(reductions), "negative"), tone: "negative" },
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
    metrics: brief.metrics.map((metric) => {
      const metricTone = metric.tone === "positive"
        ? "positive"
        : metric.tone === "negative"
          ? "negative"
          : metric.tone === "alert"
            ? "alert"
            : undefined;
      return {
        label: metric.label,
        value: directionalValue(metric.value, metricTone),
        tone: metricTone,
      };
    }),
  };
}
